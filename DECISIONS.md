# Architecture Decision Records (ADR)

This document covers the core architectural, security, and PCI-DSS-relevant decisions behind the Cards API — what we chose, and why, with KISS as the tiebreaker whenever two options were both defensible.

## 1. Infrastructure & Hosting (AWS ECS Fargate)
**Context:** We needed a highly available REST service behind an Application Load Balancer (ALB) with at least 2 replicas.
**Decision:** We chose AWS ECS with AWS Fargate.
**Rationale:**
- **Serverless compute:** Fargate removes the operational overhead of managing underlying EC2 instances.
- **Rolling updates, zero downtime:** the ECS service has `deployment_circuit_breaker { enable = true, rollback = true }`. If a new task definition fails its ALB health check (`/health`), ECS automatically rolls back to the last healthy revision instead of leaving production degraded.
- **Private subnets:** all containers and the RDS instance live in private subnets. Only the ALB is exposed to the internet.

## 2. Infrastructure as Code (Terraform) & GitOps
**Context:** The deployment process needed to be automated, secure, and reproducible.
**Decision:** Terraform provisions all AWS resources; GitHub Actions runs CI/CD.
**Rationale:**
- **Single source of truth for secrets:** Terraform's `random` provider generates `db_password` and `CARD_ENCRYPTION_KEY` and injects them straight into AWS Secrets Manager and RDS. GitHub Actions never sees these values — no credential ever gets typed into a GitHub Secret by hand.
- **GitOps pipeline:** a push to `main` runs linters and tests against a real Postgres service container, applies Terraform, builds the image (multi-stage, `pnpm@9`, Node 24), pushes to ECR, and updates the ECS service.
- **HTTPS by default:** the ALB has an HTTPS listener (443, ACM-issued cert) and an HTTP listener (80) that only 301-redirects to it — there's no path where traffic reaches the app unencrypted.

## 3. Functional Core: `Result<T, E>` Instead of Thrown Exceptions
**Context:** We wanted business logic where every failure mode is visible in the function's type signature, not discovered by reading every line for a hidden `throw`.
**Decision:** Service and utility functions return `Result<T, E>` (`ok(value)` / `err(error)`, see `src/shared/result.ts`) instead of throwing. Input validation uses `zod` schemas, which map cleanly onto the same pattern.
**Rationale:**
- Errors become part of the return type, so `if (result.ok === false)` is a compile-time-enforced branch, not a `try/catch` you might forget.
- Testing is direct: feed inputs, assert on the returned `Result`, no exception-mocking required.
- The one deliberate exception: I/O boundaries (`pg` queries) still throw on connection-level failures — those get caught at the controller/middleware edge and translated into `Result`/RFC 7807, not purified away. Purity stops at the edge of the process, not before it.

## 4. Cryptography & Data Security (AES-256-GCM)
**Context:** The PAN must be stored in a way that's recoverable (not hashed) but never exposed in plaintext, per PCI-DSS.
**Decision:** Symmetric encryption with `AES-256-GCM` — encryption, not tokenization or hashing.
**Rationale:**
- **Why GCM:** Galois/Counter Mode gives confidentiality and authenticity together. It produces an `auth_tag` acting as a cryptographic checksum — if an attacker with DB write access modifies the ciphertext, decryption fails outright instead of silently returning corrupted data.
- **Why an IV, and why it isn't a "salt":** these solve different problems. A salt belongs to password *hashing* (bcrypt, PBKDF2) — it defeats precomputed rainbow-table attacks on a one-way function. We're encrypting something we need to read back later, not hashing, so salts don't apply. What we need is an IV (Initialization Vector — the random per-operation input a block cipher mixes in alongside the key), whose job is making sure encrypting the same PAN twice with the same key never produces the same ciphertext. A fresh 12-byte IV (`crypto.randomBytes(12)`) is generated on every `encryptPan` call and stored next to the ciphertext — it doesn't need to be secret, only unique per row.
- **AAD binds ciphertext to its row:** the card's UUID is passed as Additional Authenticated Data into the cipher. A ciphertext only decrypts successfully next to the exact `id` it was created with — copying `encrypted_pan`/`iv`/`auth_tag` from one row into another fails decryption instead of quietly returning the wrong card's number.
- **Fail-fast on a bad key:** on boot, the app checks `CARD_ENCRYPTION_KEY` is exactly 64 hex characters (32 bytes) and calls `process.exit(1)` if not — a misconfigured key fails the deploy immediately, not on the first `POST /cards`.
- **Key isolation:** the key never touches the database. Terraform generates it, Secrets Manager stores it, and it's injected into the container as an environment variable at boot. A stolen database dump alone is unreadable.

## 5. Zero-Log Policy for PAN
**Context:** A PAN reaching a log line — even in an error stack trace — is a PCI-DSS violation regardless of how well the database is protected.
**Decision:** Pino's `redact` config masks `pan`, `cardNumber`, `creditCard`, `authorization`, and their nested variants at the logger level, not by remembering to avoid logging them at each call site.
**Rationale:**
- Redaction at the logger means a developer can't accidentally leak a PAN by logging a request/response object carelessly — the censor rule is structural, not a discipline problem.
- Every request carries an `x-request-id` (generated if the client didn't send one, propagated if it did), attached to every log line for that request by `pino-http`. With 2+ replicas, that's what makes it possible to trace one request's full story across CloudWatch instead of guessing which instance handled it.
- `tests/unit/logger.spec.ts` asserts the redaction actually fires — this isn't a config block nobody's checked runs correctly.

## 6. Idempotency
**Context:** Payment and card creation endpoints must safely handle network retries without creating duplicate records. This matters more than usual here because the `cards` table deliberately has no uniqueness constraint on PAN — a global unique constraint would let an attacker probe `POST /cards` with guessed numbers and infer which ones exist from the response (a 409 on a duplicate leaks existence — see the anti-enumeration decision below). So the `Idempotency-Key` header is the *only* thing standing between a network retry and a duplicate card.
**Decision:** The header is required on `POST /cards`, not optional. A dedicated `idempotency_keys` table tracks each key's state (`in_progress` / `completed`) alongside a deterministic hash of the request body.
**Rationale:**
- **Required, not optional:** a request without the header is rejected with `400` before it reaches any business logic. Optional would mean the one safeguard against duplicate records could be skipped by simply not sending a header.
- **Deterministic hashing:** JSON keys are sorted before hashing, so `{"a":1,"b":2}` and `{"b":2,"a":1}` hash identically — a genuine retry is recognized as one regardless of how the client serialized it.
- **Atomic first-writer-wins:** `INSERT ... ON CONFLICT (key) DO NOTHING` decides the race at the database level. If a second identical request arrives while the first is still `in_progress`, it gets `409` (retry shortly) instead of racing the insert.
- **Hash mismatch on a reused key is `400`, not `409`:** reusing a key with a *different* body is a client error (`IDEMPOTENCY_KEY_CONFLICT`), not a transient race — there's nothing to retry, the client needs to fix the key or the payload.
- **Only a 2xx locks the key.** A successful response is cached and replayed on retry. Everything else releases the key immediately: `4xx` because the client sent bad input and should be free to retry the same key after fixing it; `5xx` because a server failure is transient by definition, and caching it would make every retry after an outage replay the same stale error forever instead of actually trying again. An earlier version of this cached `5xx` as final — fixed by only writing `status = 'completed'` on the 200–299 range.

## 7. Anti-Enumeration: No Unique Constraint on PAN, Rate Limiting on Search
**Context:** There's no `customer_id` or authentication scoping requests — anyone can call this API. Any endpoint that reveals "does this card exist" one guess at a time is a card-enumeration side channel.
**Decision:** No `UNIQUE` constraint on PAN (see the idempotency decision above for how duplicates are actually prevented). `GET /cards:search` — the endpoint most exposed to this, since `last4` is only 10,000 possible values — is rate-limited to 30 requests/minute per IP via `express-rate-limit`. No other endpoint carries this specific limiter; they don't share this exact brute-force shape.
**Known limitation:** the limiter's counter is in-memory per process. With 2 ECS replicas, each task counts independently, so the effective ceiling across the service is closer to 60/min than the configured 30/min depending on how the ALB happens to distribute a burst. A real fix means a shared store (Redis) — not done, since the endpoint doesn't expose anything more sensitive than "does this last-4 exist," and the assessment didn't call for a Redis dependency.

## 8. Health Checks: Liveness vs. Readiness
**Context:** A single health endpoint that touches the database is dangerous behind an ALB — if Postgres is briefly slow, the ALB can mark every healthy instance unhealthy and take the whole service down over a transient DB blip.
**Decision:** Two endpoints. `GET /health` (liveness) is shallow — no DB call, just `{ status: "OK", instanceId }` — and is the one wired to the ALB target group. `GET /health/ready` (readiness) additionally runs `SELECT 1` against Postgres, for verifying real end-to-end connectivity by hand.
**Rationale:** this separation means database latency can never cascade into the ALB killing containers that are otherwise fine. `instanceId` on both is also what makes the load-balancing evidence for this assessment possible — grouping repeated `/health` hits by `instanceId` shows whether the ALB is actually spreading traffic.

## 9. Graceful Shutdown (SIGTERM / SIGINT)
**Context:** ECS rolling deployments send `SIGTERM` to a task before killing it. Without handling that signal, in-flight requests get dropped mid-response on every single deploy.
**Decision:** `server.ts` catches `SIGTERM`/`SIGINT`, stops accepting new connections (`server.close()`), waits for in-flight requests to finish, closes the Postgres pool (`pool.end()`), then exits — with a 10-second hard timeout that force-exits if something hangs.
**Rationale:** this is what makes "zero-downtime rolling deploy" actually true instead of aspirational — without it, every deploy would drop whatever requests were in flight at the exact moment ECS decided to recycle a task.

## 10. Express Route Escaping for `/cards:search`
**Context:** The assessment spec asks for `GET /cards:search?last4=`. In Express 4's router (path-to-regexp), a bare colon in a route string means a named parameter — `/cards:search` would be parsed as `/cards` followed by a param named `search`, not a literal path segment.
**Decision:** The colon is escaped: `cardRouter.get('/cards\\:search', ...)`. A second route, `/cards/search` (regular slash), is registered identically for clients or proxies that mishandle the colon in a path.
**Rationale:** this is a gotcha specific to path-to-regexp, not obvious from reading the spec — worth documenting so nobody "fixes" the escaping later and silently breaks the route.

## 11. Database Migrations (node-pg-migrate, not a full ORM)
**Context:** We needed real schema history and rollback — not a change to how we write queries. Those are two separate problems.
**Decision:** [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate) runs numbered migration files from `/migrations` on every boot. `src/db.ts` still talks to Postgres with plain `pg` queries everywhere else — this tool only owns schema history.
**Rationale:**
- **Why not TypeORM/Prisma:** those solve migrations by first wrapping the entire data-access layer in an entity/decorator system — you can't get their migration generator without adopting their query layer too. That's a much bigger change than the actual problem (no schema history, no rollback), and it fights decision §3 above: entity classes with decorators are inherently OOP. `node-pg-migrate` is additive instead — a dependency whose only job is running/tracking SQL files, with zero opinion on how `card.service.ts` queries the database.
- **Numbered, tracked, reversible:** each migration exports `up`/`down`; node-pg-migrate records which ran in its own `pgmigrations` table. "What changed and when" is a real, queryable history instead of one growing SQL block with no memory of its own past. Rolling back a bad migration is `pnpm run migrate:down`, not writing the inverse SQL from scratch under pressure.
- **Concurrency-safe for free:** the runner holds a Postgres advisory lock for the run (`advisoryLockMode: 'wait'`), so when 2+ ECS tasks boot at once and both try to migrate, the second waits instead of racing the first.
- **Fails fast, on purpose:** if a migration errors, `runMigrations()` logs it and calls `process.exit(1)` instead of booting anyway. An earlier version swallowed migration errors and started serving traffic regardless — fixed, because with a real migration tool, continuing past a failed migration silently is worse than not booting. A task that fails to boot is exactly what the ECS circuit breaker (§1) is there to catch and roll back.
- **The baseline migration is intentionally boring:** `1786382231000_initial-schema.cjs` is the original `CREATE TABLE IF NOT EXISTS` DDL wrapped in `pgm.sql(...)`, not rewritten with the JS builder API. Against the already-running production database it's a verified no-op (the tables already exist); against a fresh one it creates them. Either way, from here on every schema change is a new file, never an edit to this one.
