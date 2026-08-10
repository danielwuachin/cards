import path from 'path';
import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { logger } from './logger';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { cardRouter } from './routes/card.routes';

const openapiSpec: object = YAML.load(path.resolve(__dirname, '../openapi.yaml'));

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

  // 5.5. API docs (Swagger UI over openapi.yaml). Swagger UI's bootstrap
  // needs an inline <script>, which helmet's default CSP (script-src
  // 'self', no 'unsafe-inline') blocks — loosen the CSP for just this path
  // instead of weakening it globally.
  app.use(
    '/docs',
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
      );
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec),
  );

  // 6. RFC 7807 Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
