import { Result, ok, err } from '../shared/result';
import { BadRequestError, ERROR_MESSAGES } from '../shared/errors';

export interface CursorPayload {
  readonly id: string;
}

/**
 * Encodes a cursor payload object into a URL-safe Base64 opaque string.
 */
export function encodeCursor(payload: CursorPayload): string {
  const jsonStr = JSON.stringify(payload);
  return Buffer.from(jsonStr, 'utf8').toString('base64url');
}

/**
 * Decodes a URL-safe Base64 opaque cursor string back into its original payload.
 * Enforces opaque cursor decoding strictly (KISS).
 */
export function decodeCursor(cursorStr: string): Result<CursorPayload, BadRequestError> {
  try {
    const jsonStr = Buffer.from(cursorStr.trim(), 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed.id !== 'string') {
      return err(new BadRequestError(ERROR_MESSAGES.INVALID_CURSOR));
    }

    return ok({ id: parsed.id });
  } catch (_error) {
    return err(new BadRequestError(ERROR_MESSAGES.INVALID_CURSOR));
  }
}
