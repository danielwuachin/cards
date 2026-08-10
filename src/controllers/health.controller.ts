import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { query } from '../db';

/**
 * GET /health (Liveness / Shallow):
 * Returns instance status for AWS Application Load Balancer (ALB) health checks.
 */
export function healthLivenessHandler(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'OK',
    instanceId: config.hostname,
  });
}

/**
 * GET /health/ready (Readiness / Deep):
 * Verifies active database connection with PostgreSQL.
 */
export async function healthReadinessHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await query('SELECT 1');
    res.status(200).json({
      status: 'OK',
      database: 'connected',
      instanceId: config.hostname,
    });
  } catch (err) {
    next(err);
  }
}
