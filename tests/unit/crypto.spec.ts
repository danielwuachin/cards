import { encryptPan, decryptPan, maskPan } from '../../src/utils/crypto';
import { isOk, isErr } from '../../src/shared/result';

describe('AES-256-GCM Encryption with AAD & Masking (Unit Tests)', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const cardId = '019137e0-9111-7333-8bbb-123456789abc';
  const pan = '4532015112830366';

  it('should encrypt PAN using cardId as AAD and produce unique IV and authTag', () => {
    const enc1 = encryptPan(pan, cardId, testKey);
    const enc2 = encryptPan(pan, cardId, testKey);

    expect(isOk(enc1)).toBe(true);
    expect(isOk(enc2)).toBe(true);

    if (isOk(enc1) && isOk(enc2)) {
      expect(enc1.value.last4).toBe('0366');
      expect(enc1.value.iv).not.toBe(enc2.value.iv);
      expect(enc1.value.encryptedPan).not.toBe(enc2.value.encryptedPan);
    }
  });

  it('should decrypt encrypted PAN back to original value when correct AAD is provided', () => {
    const encResult = encryptPan(pan, cardId, testKey);
    expect(isOk(encResult)).toBe(true);

    if (isOk(encResult)) {
      const decResult = decryptPan(
        encResult.value.encryptedPan,
        encResult.value.iv,
        encResult.value.authTag,
        cardId,
        testKey,
      );

      expect(isOk(decResult)).toBe(true);
      if (isOk(decResult)) {
        expect(decResult.value).toBe(pan);
      }
    }
  });

  it('should fail decryption if a wrong cardId (AAD) is provided (prevents ciphertext transposition)', () => {
    const encResult = encryptPan(pan, cardId, testKey);
    expect(isOk(encResult)).toBe(true);

    if (isOk(encResult)) {
      const wrongCardId = '019137e0-9999-7999-8bbb-999999999999';
      const decResult = decryptPan(
        encResult.value.encryptedPan,
        encResult.value.iv,
        encResult.value.authTag,
        wrongCardId,
        testKey,
      );

      expect(isErr(decResult)).toBe(true);
    }
  });

  it('should fail decryption if the ciphertext is tampered with (authTag integrity check)', () => {
    const encResult = encryptPan(pan, cardId, testKey);
    expect(isOk(encResult)).toBe(true);

    if (isOk(encResult)) {
      // Flip one hex character in the ciphertext to simulate a compromised
      // row (e.g. attacker with raw DB write access). AES-GCM must reject
      // this at the authTag check instead of returning corrupted plaintext.
      const tampered =
        encResult.value.encryptedPan.slice(0, -1) +
        (encResult.value.encryptedPan.slice(-1) === '0' ? '1' : '0');

      const decResult = decryptPan(
        tampered,
        encResult.value.iv,
        encResult.value.authTag,
        cardId,
        testKey,
      );

      expect(isErr(decResult)).toBe(true);
    }
  });

  it('should fail decryption with a wrong encryption key (key rotation / mismatch safety)', () => {
    const encResult = encryptPan(pan, cardId, testKey);
    expect(isOk(encResult)).toBe(true);

    if (isOk(encResult)) {
      const wrongKey = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const decResult = decryptPan(
        encResult.value.encryptedPan,
        encResult.value.iv,
        encResult.value.authTag,
        cardId,
        wrongKey,
      );

      expect(isErr(decResult)).toBe(true);
    }
  });

  it('should mask PAN correctly as **** **** **** 0366', () => {
    expect(maskPan(pan)).toBe('**** **** **** 0366');
    expect(maskPan('0366')).toBe('**** **** **** 0366');
  });
});
