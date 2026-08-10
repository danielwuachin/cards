# ROADMAP V2 — Express.js Credit Card Service ("Simple is Better")

> **Misión V2**: Construir el servicio REST de gestión de tarjetas de crédito en **Express.js + TypeScript**, con 100% de calidad Senior L3, arquitectura funcional (FP), cero sobre-ingeniería (KISS), cifrado AES-256-GCM PCI-DSS compliant con AAD, idempotencia atómica y paginación profesional por cursor.

---

## Estado del Proyecto

- [x] T01 — Configuración inicial del proyecto Express, TypeScript, ESLint, Prettier, Husky, Commitlint y `.env`
- [x] T02 — Logger Pino con redactor PCI-DSS y trazabilidad por `x-request-id` (`src/logger.ts`)
- [x] T03 — Módulo `Result<T, E>` y catálogo de errores RFC 7807 (`shared/result.ts`, `shared/errors.ts`)
- [x] T04 — Pool de conexión Postgres (`src/db.ts`) y script de migraciones (`cards`, `idempotency_keys`)
- [x] T05 — Utilidades puras: Validador de Luhn y Expiración MM/YY (`utils/luhn.ts`)
- [x] T06 — Utilidades puras: Módulo Crypto AES-256-GCM con AAD (`utils/crypto.ts`)
- [x] T07 — Utilidades puras: Encoding/Decoding de Cursor Base64 con UUIDv7 (`utils/cursor.ts`)
- [x] T08 — Servicio: `createCard` (validación Zod, cifrado AES-GCM con AAD, inserción en BD)
- [x] T09 — Servicio: `getCardById` (búsqueda y enmascaramiento de PAN)
- [x] T10 — Servicio: `listCards` (Paginación por cursor UUIDv7 `prevCursor`, `nextCursor`, `limit`, `order`)
- [x] T11 — Servicio: `searchByLast4` (Búsqueda por últimos 4 dígitos)
- [x] T12 — Middlewares HTTP: ErrorHandler RFC 7807, RateLimiter y RequestId (`middleware/*`)
- [x] T13 — Route & Controller: `/health` (Liveness para ALB) y `/health/ready` (Readiness con DB)
- [x] T14 — Routes & Controllers HTTP: `/cards` (`POST`, `GET /:id`, `GET /`, `GET /\\:search`)
- [x] T15 — Middleware de Idempotencia Atómica con Estados (`in_progress`/`completed`)
- [x] T16 — Dockerization: `Dockerfile` multi-stage + `docker-compose.yml` (App + Postgres)
- [x] T17 — Suite de Tests de Integración / E2E con Jest + Supertest (29 tests pasando)
- [ ] T18 — IaC Terraform (VPC, ALB HTTPS con dominio `danviviendo.com`, ECS Fargate 2 tasks, RDS, Secrets Manager)
- [ ] T19 — Entregable final: README.md completo con comandos curl, diagrama PNG y evidencia de balanceo

---

## Fichas Detalladas de Tareas

### T01 - T07: Fundamentos & Utilidades Puras
- **Estado**: ✅ COMPLETADO (17 tests unitarios pasando)

### T08 - T11: Capa de Servicios Pura (FP)
- **Estado**: ✅ COMPLETADO

### T12 - T17: HTTP, Controllers, Rate Limit, Idempotencia, Docker & Tests E2E
- **Estado**: ✅ COMPLETADO (29 tests unitarios y E2E Supertest pasando en 0.46s)
- **Logros**:
  - T12: Middlewares `requestIdMiddleware`, `searchRateLimiter` y `errorHandlerMiddleware` RFC 7807.
  - T13: Endpoints `/health` (Liveness para ALB) y `/health/ready` (Readiness con DB).
  - T14: Handlers HTTP para `/cards` (`POST`, `GET /:id`, `GET /`, `GET /\\:search`).
  - T15: Middleware `idempotencyMiddleware` con estados `in_progress` / `completed`.
  - T16: `Dockerfile` multi-stage (builder/runner node20-alpine) y `docker-compose.yml` para App + Postgres local.
  - T17: Suite de pruebas E2E con Supertest.
