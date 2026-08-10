import express, { Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { cardRouter } from './routes/card.routes';

export function createApp(): Express {
  const app = express();

  // 1. Security headers
  app.use(helmet());

  // 2. Body parsing
  app.use(express.json());

  // 3. Request ID propagation
  app.use(requestIdMiddleware);

  // 4. Pino HTTP logger
  app.use(
    pinoHttp({
      logger,
      customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
      },
    }),
  );

  // 5. Routes — bare paths only, matching the assessment spec exactly.
  // No /v1 prefix: there's no v2 to version against yet (YAGNI).
  app.use('/', healthRouter);
  app.use('/', cardRouter);

  // 6. RFC 7807 Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
