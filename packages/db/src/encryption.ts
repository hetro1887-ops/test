import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives or decodes the 32-byte AES-256 encryption key from the
 * ENCRYPTION_KEY environment variable.
 *
 * - If the env var is a 64-character hex string it is decoded directly
 *   (64 hex chars = 32 bytes).
 * - Otherwise the value is treated as a passphrase and a key is derived
 *   using scrypt with a fixed application salt.
 *
 * @returns A 32-byte Buffer suitable for AES-256-GCM.
 * @throws If ENCRYPTION_KEY is not set.
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // If the key is hex-encoded (64 chars = 32 bytes), decode it
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  // Otherwise derive a key from the passphrase
  const salt = Buffer.from('finance-dashboard-salt', 'utf8');
  return scryptSync(key, salt, 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * The returned ciphertext is formatted as `iv:authTag:ciphertext` where
 * each component is hex-encoded. The IV is randomly generated per call
 * ensuring unique ciphertext even for identical plaintexts.
 *
 * @param plaintext - The string to encrypt.
 * @returns The encrypted string in `iv:authTag:ciphertext` hex format.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string produced by {@link encrypt}.
 *
 * Expects the `iv:authTag:ciphertext` hex format. Verifies the GCM
 * authentication tag to ensure data integrity.
 *
 * @param encryptedData - The encrypted string in `iv:authTag:ciphertext` format.
 * @returns The original plaintext string.
 * @throws If the encrypted data format is invalid or the auth tag fails verification.
 */
export function decrypt(encryptedData: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
