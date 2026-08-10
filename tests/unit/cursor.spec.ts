import { encodeCursor, decodeCursor } from '../../src/utils/cursor';
import { isOk, isErr } from '../../src/shared/result';

describe('Base64 Cursor Encoding & Decoding (Unit Tests)', () => {
  const samplePayload = { id: '019137e0-9111-7333-8bbb-123456789abc' };

  it('should encode cursor payload to valid base64url string and decode it back', () => {
    const encoded = encodeCursor(samplePayload);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decodedResult = decodeCursor(encoded);
    expect(isOk(decodedResult)).toBe(true);

    if (isOk(decodedResult)) {
      expect(decodedResult.value.id).toBe(samplePayload.id);
    }
  });

  it('should return BadRequestError when decoding an invalid or corrupted cursor', () => {
    const invalidResult = decodeCursor('invalid_base64_string_!!!');
    expect(isErr(invalidResult)).toBe(true);
  });
});
