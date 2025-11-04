/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for database connection strings
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('DB_ENCRYPTION_KEY environment variable not set');
  }
  return Buffer.from(key, 'base64');
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64-encoded string with format: iv:authTag:encrypted
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  // Parse format: iv:authTag:encrypted
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt database connection details
 */
export interface ConnectionDetails {
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
}

export interface EncryptedConnectionDetails {
  host_encrypted?: string;
  port_encrypted?: string;
  database_encrypted: string;
  username_encrypted?: string;
  password_encrypted?: string;
  connection_string_encrypted?: string;
}

export function encryptConnectionDetails(details: ConnectionDetails): EncryptedConnectionDetails {
  const encrypted: EncryptedConnectionDetails = {
    database_encrypted: encrypt(details.database),
  };

  if (details.host) {
    encrypted.host_encrypted = encrypt(details.host);
  }

  if (details.port !== undefined) {
    encrypted.port_encrypted = encrypt(details.port.toString());
  }

  if (details.username) {
    encrypted.username_encrypted = encrypt(details.username);
  }

  if (details.password) {
    encrypted.password_encrypted = encrypt(details.password);
  }

  if (details.connectionString) {
    encrypted.connection_string_encrypted = encrypt(details.connectionString);
  }

  return encrypted;
}

/**
 * Decrypt database connection details
 */
export function decryptConnectionDetails(encrypted: EncryptedConnectionDetails): ConnectionDetails {
  const details: ConnectionDetails = {
    database: decrypt(encrypted.database_encrypted),
  };

  if (encrypted.host_encrypted) {
    details.host = decrypt(encrypted.host_encrypted);
  }

  if (encrypted.port_encrypted) {
    details.port = parseInt(decrypt(encrypted.port_encrypted), 10);
  }

  if (encrypted.username_encrypted) {
    details.username = decrypt(encrypted.username_encrypted);
  }

  if (encrypted.password_encrypted) {
    details.password = decrypt(encrypted.password_encrypted);
  }

  if (encrypted.connection_string_encrypted) {
    details.connectionString = decrypt(encrypted.connection_string_encrypted);
  }

  return details;
}
