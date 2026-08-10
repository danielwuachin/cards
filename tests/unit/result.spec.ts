import { ok, err, isOk, isErr } from '../../src/shared/result';
import { BadRequestError, NotFoundError, ERROR_MESSAGES } from '../../src/shared/errors';

describe('Result<T, E> Pattern (Unit Tests)', () => {
  it('should create an Ok result and identify it with isOk', () => {
    const res = ok({ id: '123', maskedPan: '**** **** **** 0366' });

    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
    if (isOk(res)) {
      expect(res.value.maskedPan).toBe('**** **** **** 0366');
    }
  });

  it('should create an Err result and identify it with isErr', () => {
    const errorObj = new BadRequestError(ERROR_MESSAGES.INVALID_PAN);
    const res = err(errorObj);

    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.status).toBe(400);
      expect(res.error.detail).toBe(ERROR_MESSAGES.INVALID_PAN);
      expect(res.error.toJSON()).toEqual({
        type: 'https://api.cards.local/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: ERROR_MESSAGES.INVALID_PAN,
      });
    }
  });

  it('should serialize NotFoundError to RFC 7807 JSON properly', () => {
    const notFound = new NotFoundError(ERROR_MESSAGES.CARD_NOT_FOUND, '/cards/abc');
    expect(notFound.toJSON()).toEqual({
      type: 'https://api.cards.local/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: ERROR_MESSAGES.CARD_NOT_FOUND,
      instance: '/cards/abc',
    });
  });
});
