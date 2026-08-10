import rateLimit from 'express-rate-limit';
import { BadRequestError } from '../shared/errors';

/**
 * Rate limiter middleware to prevent brute-force attacks on card search endpoints.
 * Limits IP requests to a maximum of 30 requests per minute.
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new BadRequestError(
        'Too many search requests from this IP. Please try again after 1 minute.',
      ),
    );
  },
});
