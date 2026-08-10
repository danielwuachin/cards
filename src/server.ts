import { app } from './app';
import { config } from './config';
import { logger } from './logger';
import { pool, runMigrations } from './db';

// -----------------------------------------------------------------------------
// Fail-Fast Check: Validate card encryption key length on startup
// -----------------------------------------------------------------------------
if (!config.security.cardEncryptionKey || config.security.cardEncryptionKey.length !== 64) {
  logger.fatal(
    'CARD_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). Process exiting.',
  );
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Run Database Migrations & Start Server
// -----------------------------------------------------------------------------
runMigrations().then(() => {
  server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        nodeEnv: config.nodeEnv,
        hostname: config.hostname,
      },
      'Credit Card Service Express V2 initialized successfully',
    );
  });
});

let server: ReturnType<typeof app.listen>;

// -----------------------------------------------------------------------------
// Graceful Shutdown (SIGTERM / SIGINT) for ECS Zero-Downtime Deploys
// -----------------------------------------------------------------------------
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal. Starting graceful shutdown...');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed. Draining database connection pool...');
      try {
        await pool.end();
        logger.info('PostgreSQL pool closed. Graceful shutdown complete.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during PostgreSQL pool shutdown');
        process.exit(1);
      }
    });
  }

  setTimeout(() => {
    logger.error('Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
