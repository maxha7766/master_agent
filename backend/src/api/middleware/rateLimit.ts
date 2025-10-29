/**
 * Rate Limiting Middleware
 * 100 requests per minute per user
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../../lib/errors';
import { log } from '../../lib/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_REQUESTS = parseInt(process.env.API_RATE_LIMIT || '100', 10);

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Rate limiting middleware for API endpoints
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract user ID from request (set by auth middleware)
  const userId = (req as any).user?.id || req.ip || 'anonymous';
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
    rateLimitStore.set(userId, entry);
  }

  // Increment request count
  entry.count++;

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

  // Check if rate limit exceeded
  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());

    log.warn('Rate limit exceeded', {
      userId,
      count: entry.count,
      limit: MAX_REQUESTS,
      path: req.path,
    });

    const error = new RateLimitError(
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    );
    res.status(error.statusCode).json({
      error: {
        name: error.name,
        message: error.message,
        retryAfter,
      },
    });
    return;
  }

  next();
}

/**
 * Get current rate limit status for a user
 */
export function getRateLimitStatus(userId: string): {
  count: number;
  limit: number;
  remaining: number;
  resetTime: Date;
} {
  const entry = rateLimitStore.get(userId);
  const now = Date.now();

  if (!entry || now > entry.resetTime) {
    return {
      count: 0,
      limit: MAX_REQUESTS,
      remaining: MAX_REQUESTS,
      resetTime: new Date(now + RATE_LIMIT_WINDOW),
    };
  }

  return {
    count: entry.count,
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
    resetTime: new Date(entry.resetTime),
  };
}
