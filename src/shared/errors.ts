/**
 * Base abstract class for application errors following RFC 7807 Problem Details.
 */
export abstract class AppError extends Error {
  abstract readonly type: string;
  abstract readonly title: string;
  abstract readonly status: number;
  readonly detail: string;
  readonly instance?: string;

  constructor(detail: string, instance?: string) {
    super(detail);
    this.detail = detail;
    this.instance = instance;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      ...(this.instance ? { instance: this.instance } : {}),
    };
  }
}

export class BadRequestError extends AppError {
  readonly type = 'https://api.danviviendo.com/errors/bad-request';
  readonly title = 'Bad Request';
  readonly status = 400;
}

export class NotFoundError extends AppError {
  readonly type = 'https://api.danviviendo.com/errors/not-found';
  readonly title = 'Not Found';
  readonly status = 404;
}

export class ConflictError extends AppError {
  readonly type = 'https://api.danviviendo.com/errors/conflict';
  readonly title = 'Conflict';
  readonly status = 409;
}

export class InternalServerError extends AppError {
  readonly type = 'https://api.danviviendo.com/errors/internal-error';
  readonly title = 'Internal Server Error';
  readonly status = 500;
}

/**
 * Centralized catalog of standardized error message details.
 */
export const ERROR_MESSAGES = {
  INVALID_PAN: 'The provided PAN failed the Luhn checksum validation algorithm',
  CARD_EXPIRED: 'The card expiration date is in the past',
  INVALID_EXPIRATION_FORMAT: 'Expiration month must be 1-12 and year must be 4 digits',
  HOLDER_NAME_REQUIRED: 'Holder name is required and cannot be empty',
  CARD_NOT_FOUND: 'Card not found with the requested identifier',
  INVALID_CURSOR: 'The pagination cursor provided is invalid or corrupted',
  INVALID_LAST4: 'last4 query parameter must be exactly 4 numeric digits',
  IDEMPOTENCY_KEY_REQUIRED: 'Idempotency-Key header is required for this operation',
  IDEMPOTENCY_KEY_CONFLICT: 'Idempotency key reused with a different request payload',
  ENCRYPTION_FAILURE: 'Failed to securely encrypt card data',
  INTERNAL_ERROR: 'An unexpected internal server error occurred',
} as const;
