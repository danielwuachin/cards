/**
 * Baseline migration. Uses IF NOT EXISTS everywhere on purpose: this exact
 * DDL already ran once (via the hand-rolled script that lived in db.ts
 * before this migration tool existed), so on any database that already has
 * `cards`/`idempotency_keys` this is a verified no-op — node-pg-migrate
 * just records it as applied and moves on. On a brand new database it
 * creates the real schema. Either way, from here on this file is the only
 * source of truth; future schema changes are new migration files, never
 * edits to this one.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY,
        encrypted_pan TEXT NOT NULL,
        iv VARCHAR(32) NOT NULL,
        auth_tag VARCHAR(32) NOT NULL,
        last4 VARCHAR(4) NOT NULL,
        expiration_month INT NOT NULL,
        expiration_year INT NOT NULL,
        holder_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cards_last4 ON cards(last4);
    CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);

    CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        request_hash VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
        status_code INT,
        response_body JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS idempotency_keys;
    DROP TABLE IF EXISTS cards;
  `);
};
