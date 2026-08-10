import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query as defaultQuery } from '../db';
import { ConflictError, BadRequestError, ERROR_MESSAGES } from '../shared/errors';

export interface IdempotencyRow {
  key: string;
  request_hash: string;
  status: 'in_progress' | 'completed';
  status_code: number | null;
  response_body: Record<string, unknown> | null;
  created_at: Date;
  expires_at: Date;
}

/**
 * Computes a deterministic SHA-256 hash of a JSON payload regardless of key insertion order.
 */
function hashPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return crypto
      .createHash('sha256')
      .update(String(payload || ''))
      .digest('hex');
  }

  const keys = Object.keys(payload as object).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const k of keys) {
    sortedObj[k] = (payload as Record<string, unknown>)[k];
  }
  return crypto.createHash('sha256').update(JSON.stringify(sortedObj)).digest('hex');
}

/**
 * Creates atomic idempotency middleware following IETF RFC 9530 & Stripe payment standards.
 */
export function createIdempotencyMiddleware(dbQuery = defaultQuery) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'];

    // Idempotency-Key is required to prevent duplicate records on retries.
    if (!key || typeof key !== 'string' || !key.trim()) {
      return next(new BadRequestError(ERROR_MESSAGES.IDEMPOTENCY_KEY_REQUIRED));
    }

    const requestHash = hashPayload(req.body);

    try {
      const insertSql = `
        INSERT INTO idempotency_keys (key, request_hash, status)
        VALUES ($1, $2, 'in_progress')
        ON CONFLICT (key) DO NOTHING
        RETURNING *
      `;

      const insertResult = await dbQuery<IdempotencyRow>(insertSql, [key, requestHash]);

      if (insertResult.rows.length === 0) {
        const selectSql = `SELECT * FROM idempotency_keys WHERE key = $1`;
        const selectResult = await dbQuery<IdempotencyRow>(selectSql, [key]);

        if (selectResult.rows.length > 0) {
          const existing = selectResult.rows[0];

          if (existing.status === 'in_progress') {
            return next(
              new ConflictError('A request with this Idempotency-Key is currently in progress'),
            );
          }

          if (existing.request_hash !== requestHash) {
            return next(new BadRequestError(ERROR_MESSAGES.IDEMPOTENCY_KEY_CONFLICT));
          }

          if (existing.status_code && existing.response_body) {
            res.status(existing.status_code).json(existing.response_body);
            return;
          }
        }
      }

      const originalJson = res.json.bind(res);

      res.json = function (body: unknown): Response {
        const statusCode = res.statusCode;

        // Only successful (2xx) responses are cached for replay.
        if (statusCode >= 200 && statusCode < 300) {
          const updateSql = `
            UPDATE idempotency_keys
            SET status = 'completed', status_code = $1, response_body = $2
            WHERE key = $3
          `;
          dbQuery(updateSql, [statusCode, JSON.stringify(body), key]).catch(() => { });
        } else {
          const deleteSql = `DELETE FROM idempotency_keys WHERE key = $1`;
          dbQuery(deleteSql, [key]).catch(() => { });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const idempotencyMiddleware = createIdempotencyMiddleware();
