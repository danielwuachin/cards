import { Request, Response, NextFunction } from 'express';
import { AppError, InternalServerError, ERROR_MESSAGES } from '../shared/errors';
import { logger } from '../logger';

/**
 * Centralized Express error handler formatting error responses per RFC 7807 (application/problem+json).
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError =
    err instanceof AppError ? err : new InternalServerError(ERROR_MESSAGES.INTERNAL_ERROR);

  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      status: appError.status,
    },
    'Handled application HTTP error',
  );

  res.status(appError.status).type('application/problem+json').json(appError.toJSON());
}
