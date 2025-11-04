/**
 * File hashing utilities for deduplication
 */

import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

/**
 * Compute SHA-256 hash of a file
 * @param filePath Absolute path to the file
 * @returns Hex-encoded SHA-256 hash
 */
export async function hashFile(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Compute SHA-256 hash of a buffer
 * @param buffer File buffer
 * @returns Hex-encoded SHA-256 hash
 */
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA-256 hash of a string
 * @param content String content
 * @returns Hex-encoded SHA-256 hash
 */
export function hashString(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
