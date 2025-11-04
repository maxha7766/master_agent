/**
 * Database Connection Encryption Service
 * Uses AES-256-GCM to securely encrypt/decrypt PostgreSQL connection strings
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment or generate one
 * In production, this MUST be set via environment variable
 */
function getEncryptionKey(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'DB_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"'
    );
  }

  // Convert base64 key to buffer
  const keyBuffer = Buffer.from(key, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error('DB_ENCRYPTION_KEY must be 32 bytes (256 bits) when base64 decoded');
  }

  return keyBuffer;
}

/**
 * Encrypted data format:
 * [salt:64][iv:16][authTag:16][ciphertext:variable]
 */
interface EncryptedData {
  encrypted: string; // base64 encoded: salt + iv + authTag + ciphertext
}

/**
 * Encrypt a database connection string
 * @param connectionString - PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/db)
 * @returns Encrypted data as base64 string
 */
export function encryptConnectionString(connectionString: string): string {
  try {
    const key = getEncryptionKey();

    // Generate random IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate random salt (for key derivation in future if needed)
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(connectionString, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);

    // Return as base64
    return combined.toString('base64');
  } catch (error) {
    throw new Error(
      `Failed to encrypt connection string: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Decrypt a database connection string
 * @param encryptedString - Base64 encoded encrypted data
 * @returns Decrypted connection string
 */
export function decryptConnectionString(encryptedString: string): string {
  try {
    const key = getEncryptionKey();

    // Decode from base64
    const combined = Buffer.from(encryptedString, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(
      `Failed to decrypt connection string: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate that a connection string is properly formatted
 * @param connectionString - PostgreSQL connection string to validate
 * @returns true if valid, throws error otherwise
 */
export function validateConnectionString(connectionString: string): boolean {
  // Basic validation - must start with postgresql:// or postgres://
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error('Connection string must start with postgresql:// or postgres://');
  }

  // Must contain @ symbol (for host)
  if (!connectionString.includes('@')) {
    throw new Error('Connection string must include host (@)');
  }

  // Try parsing as URL
  try {
    const url = new URL(connectionString);

    if (!url.hostname) {
      throw new Error('Connection string must include hostname');
    }

    // Port should be a number if present
    if (url.port && isNaN(parseInt(url.port, 10))) {
      throw new Error('Connection string port must be a number');
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Connection string')) {
      throw error;
    }
    throw new Error(`Invalid connection string format: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a secure encryption key
 * This is a utility function for generating keys - output should be saved to DB_ENCRYPTION_KEY
 * @returns Base64 encoded 256-bit key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}
