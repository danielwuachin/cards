import crypto from 'crypto';
import { Result, ok, err } from '../shared/result';
import { InternalServerError, ERROR_MESSAGES } from '../shared/errors';

export interface EncryptedPayload {
  readonly encryptedPan: string;
  readonly iv: string;
  readonly authTag: string;
  readonly last4: string;
}

/**
 * Encrypts a PAN using AES-256-GCM, incorporating the cardId as Additional Authenticated Data (AAD).
 * AAD binds the ciphertext cryptographically to the specific card ID row.
 */
export function encryptPan(
  pan: string,
  cardId: string,
  hexKey: string,
): Result<EncryptedPayload, InternalServerError> {
  try {
    const key = Buffer.from(hexKey, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    cipher.setAAD(Buffer.from(cardId, 'utf8'));

    let encrypted = cipher.update(pan, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    const last4 = pan.slice(-4);

    return ok({
      encryptedPan: encrypted,
      iv: iv.toString('hex'),
      authTag,
      last4,
    });
  } catch (_error) {
    return err(new InternalServerError(ERROR_MESSAGES.ENCRYPTION_FAILURE));
  }
}

/**
 * Decrypts an AES-256-GCM ciphertext while verifying the authTag and AAD (cardId) integrity.
 *
 * There is intentionally no HTTP route that calls this function — decrypting the
 * full PAN on demand would violate PCI-DSS 3.3 (mask PAN on display) for zero
 * business benefit, since every read path only needs the `last4` column.
 * Round-trip correctness (encrypt -> decrypt -> original value) and tamper
 * detection (wrong AAD / modified ciphertext must fail, not silently corrupt)
 * are proven in isolation instead:
 *
 *   pnpm exec jest tests/unit/crypto.spec.ts
 */
export function decryptPan(
  encryptedPan: string,
  ivHex: string,
  authTagHex: string,
  cardId: string,
  hexKey: string,
): Result<string, InternalServerError> {
  try {
    const key = Buffer.from(hexKey, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(cardId, 'utf8'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedPan, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return ok(decrypted);
  } catch (_error) {
    return err(new InternalServerError(ERROR_MESSAGES.ENCRYPTION_FAILURE));
  }
}

/**
 * Returns a masked PAN representation for public API responses (e.g. "**** **** **** 0366").
 */
export function maskPan(panOrLast4: string): string {
  const last4 = panOrLast4.slice(-4);
  return `**** **** **** ${last4}`;
}
