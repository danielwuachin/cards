import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';
import { logger } from './logger';

export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        // RDS rejects unencrypted connections (pg_hba.conf "no encryption" error).
        // rejectUnauthorized: false skips CA chain validation of RDS's cert — the
        // channel is still encrypted, but the server identity isn't verified.
        // For full verification, bundle the RDS CA cert and pass it as `ca` here.
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Runs defensive schema migrations to ensure required tables, primary keys, and columns exist.
 * Drops legacy NOT NULL constraints on old table columns if present.
 */
export async function runMigrations(): Promise<void> {
  const sql = `
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

    ALTER TABLE cards ADD COLUMN IF NOT EXISTS encrypted_pan TEXT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS iv VARCHAR(32);
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS auth_tag VARCHAR(32);
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS last4 VARCHAR(4);
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS expiration_month INT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS expiration_year INT;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS holder_name VARCHAR(100);
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

    -- Drop legacy NOT NULL constraints if existing table was created by old migrations
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'pan_ciphertext') THEN
            ALTER TABLE cards ALTER COLUMN pan_ciphertext DROP NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'pan_hash') THEN
            ALTER TABLE cards ALTER COLUMN pan_hash DROP NOT NULL;
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) NOT NULL,
        request_hash VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
        status_code INT,
        response_body JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
    );

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_pkey'
        ) THEN
            ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);
        END IF;
    END $$;

    ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'in_progress';
    ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS status_code INT;
    ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS response_body JSONB;
    ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');

    CREATE INDEX IF NOT EXISTS idx_cards_last4 ON cards(last4);
    CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);
  `;
  try {
    await pool.query(sql);
    logger.info('Database migrations verified successfully');
  } catch (err) {
    logger.error({ err }, 'Error executing database migrations');
  }
}

/**
 * Executes a parameterized SQL query against PostgreSQL.
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<R>> {
  const start = Date.now();
  const res = await pool.query<R>(text, params);
  const duration = Date.now() - start;
  logger.debug({ text, duration, rows: res.rowCount }, 'Executed PostgreSQL query');
  return res;
}
