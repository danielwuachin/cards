import { AppError } from './errors';

/**
 * Result<T, E> pattern for explicit error handling (Go / Elixir style).
 * Eliminates unhandled runtime throw exceptions across business logic.
 */
export type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E extends AppError>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok === true;
}

export function isErr<T, E extends AppError>(r: Result<T, E>): r is { ok: false; error: E } {
  return r.ok === false;
}
