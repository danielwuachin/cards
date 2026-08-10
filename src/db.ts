import path from 'path';
import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';
import { logger } from './logger';

// Same config object feeds the Pool below and the migration runner further
// down, so there's one place that knows how to reach the database, not two.
function connectionConfig(): PoolConfig {
  return process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // RDS requires TLS; we skip CA pinning
      }
    : {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
      };
}

export const pool = new Pool({
  ...connectionConfig(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

// Runs pending migrations from /migrations on every boot. node-pg-migrate
// holds a Postgres advisory lock, so concurrent tasks queue instead of racing.
export async function runMigrations(): Promise<void> {
  try {
    const { runner } = await import('node-pg-migrate');
    const applied = await runner({
      databaseUrl: connectionConfig(),
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
    logger.info({ applied: applied.map((m) => m.name) }, 'Migrations applied');
  } catch (err) {
    // A broken schema is worse than a task that never starts — let ECS's
    // circuit breaker roll back instead of serving traffic against it.
    logger.fatal({ err }, 'Migration failed, refusing to boot');
    process.exit(1);
  }
}

export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<R>> {
  const start = Date.now();
  const res = await pool.query<R>(text, params);
  logger.debug({ text, duration: Date.now() - start, rows: res.rowCount }, 'Query executed');
  return res;
}
