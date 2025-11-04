/**
 * LLM Response Cache
 * Simple in-memory LRU cache for LLM responses
 * Reduces latency for repeated queries
 */

import crypto from 'crypto';
import { log } from '../../lib/logger.js';

interface CacheEntry {
  response: string;
  timestamp: number;
}

class LRUCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate cache key from messages
   */
  private generateKey(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number
  ): string {
    const content = JSON.stringify({ messages, model, temperature });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached response
   */
  get(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number
  ): string | null {
    const key = this.generateKey(messages, model, temperature);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      log.info('Cache entry expired', { key: key.substring(0, 16) });
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    log.info('Cache hit', {
      key: key.substring(0, 16),
      age: Math.round((Date.now() - entry.timestamp) / 1000),
    });

    return entry.response;
  }

  /**
   * Set cached response
   */
  set(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number,
    response: string
  ): void {
    const key = this.generateKey(messages, model, temperature);

    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      log.info('Cache evicted oldest entry', { evictedKey: firstKey?.substring(0, 16) });
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });

    log.info('Cache set', {
      key: key.substring(0, 16),
      size: this.cache.size,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    log.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttl / 60000,
    };
  }
}

// Export singleton instance
export const llmCache = new LRUCache(1000, 60);
