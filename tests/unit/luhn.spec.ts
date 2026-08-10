import { validateLuhn, validateExpiration } from '../../src/utils/luhn';
import { isOk, isErr } from '../../src/shared/result';
import { ERROR_MESSAGES } from '../../src/shared/errors';

describe('Luhn Algorithm & Expiration Validation (Unit Tests)', () => {
  describe('validateLuhn', () => {
    it('should return true for valid Visa PAN passing Luhn checksum', () => {
      expect(validateLuhn('4532015112830366')).toBe(true);
    });

    it('should return false for invalid PAN failing Luhn checksum', () => {
      expect(validateLuhn('4532015112830367')).toBe(false);
    });

    it('should return false for non-numeric characters or invalid length', () => {
      expect(validateLuhn('abc1234567890')).toBe(false);
      expect(validateLuhn('123')).toBe(false);
    });
  });

  describe('validateExpiration', () => {
    it('should return Ok for valid future expiration date', () => {
      const res = validateExpiration(12, 2030);
      expect(isOk(res)).toBe(true);
    });

    it('should return Err for past expiration date', () => {
      const res = validateExpiration(1, 2020);
      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.detail).toBe(ERROR_MESSAGES.CARD_EXPIRED);
      }
    });

    it('should return Err for out of range month/year format', () => {
      const res = validateExpiration(13, 2030);
      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error.detail).toBe(ERROR_MESSAGES.INVALID_EXPIRATION_FORMAT);
      }
    });
  });
});
