import { Result, ok, err } from '../shared/result';
import { BadRequestError, ERROR_MESSAGES } from '../shared/errors';

/**
 * Validates a Primary Account Number (PAN) using the Luhn checksum algorithm (Mod 10).
 */
export function validateLuhn(pan: string): boolean {
  const sanitized = pan.replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(sanitized)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Validates whether the card expiration month and year are valid and not in the past.
 */
export function validateExpiration(month: number, year: number): Result<true, BadRequestError> {
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return err(new BadRequestError(ERROR_MESSAGES.INVALID_EXPIRATION_FORMAT));
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return err(new BadRequestError(ERROR_MESSAGES.CARD_EXPIRED));
  }

  return ok(true);
}
