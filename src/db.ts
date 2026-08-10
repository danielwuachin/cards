import path from 'path';
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
 * Same connection resolution logic as the Pool above, but as a URL string —
 * node-pg-migrate's runner takes a connection string, not a config object.
 */
function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const { host, port, name, user, password } = config.db;
  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * Runs pending migrations from /migrations via node-pg-migrate. Safe to call
 * from every ECS task on every boot: node-pg-migrate takes a Postgres
 * advisory lock for the duration of the run, so if two tasks start at once,
 * the second just waits for the first to finish instead of racing it.
 *
 * Deliberately does NOT swallow a failed migration — an unknown schema state
 * is worse than a task that fails to become healthy. Exiting lets the ECS
 * deployment circuit breaker roll back to the last good revision instead of
 * serving traffic against a broken database.
 */
export async function runMigrations(): Promise<void> {
  try {
    const { runner } = await import('node-pg-migrate');
    const applied = await runner({
      databaseUrl: buildDatabaseUrl(),
      dir: path.resolve(__dirname, '../migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      advisoryLockMode: 'wait',
      logger: {
        info: (msg: string) => logger.info(msg),
        warn: (msg: string) => logger.warn(msg),
        error: (msg: string) => logger.error(msg),
      },
    });
    logger.info(
      { applied: applied.map((m) => m.name) },
      'Database migrations applied successfully',
    );
  } catch (err) {
    logger.fatal(
      { err },
      'Database migration failed. Refusing to start with an unverified schema.',
    );
    process.exit(1);
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
