/**
 * WebSocket Rate Limiting Middleware
 * Limits message rate to 10 messages per second per connection
 */

import { AuthenticatedWebSocket } from '../server';
import { log } from '../../lib/logger';

const MAX_MESSAGES_PER_SECOND = parseInt(
  process.env.WS_RATE_LIMIT || '10',
  10
);
const RATE_LIMIT_WINDOW = 1000; // 1 second in milliseconds

/**
 * Check if connection has exceeded rate limit
 * Returns error message if rate limit exceeded, null otherwise
 */
export function rateLimitMiddleware(
  ws: AuthenticatedWebSocket
): { message: string; retryAfter: number } | null {
  const now = Date.now();

  // Initialize tracking fields if not present
  if (!ws.lastMessageTime || !ws.messageCount) {
    ws.lastMessageTime = now;
    ws.messageCount = 1;
    return null;
  }

  // Check if we're in a new time window
  const timeSinceLastReset = now - ws.lastMessageTime;
  if (timeSinceLastReset >= RATE_LIMIT_WINDOW) {
    // Reset window
    ws.lastMessageTime = now;
    ws.messageCount = 1;
    return null;
  }

  // Increment message count
  ws.messageCount++;

  // Check if rate limit exceeded
  if (ws.messageCount > MAX_MESSAGES_PER_SECOND) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW - timeSinceLastReset) / 1000
    );

    log.warn('WebSocket rate limit exceeded', {
      userId: ws.userId,
      messageCount: ws.messageCount,
      limit: MAX_MESSAGES_PER_SECOND,
      window: RATE_LIMIT_WINDOW,
    });

    return {
      message: `Rate limit exceeded. Maximum ${MAX_MESSAGES_PER_SECOND} messages per second. Try again in ${retryAfter} second(s).`,
      retryAfter,
    };
  }

  return null;
}

/**
 * Get current rate limit status for a connection
 */
export function getRateLimitStatus(ws: AuthenticatedWebSocket): {
  messagesInWindow: number;
  limit: number;
  remaining: number;
  windowResetMs: number;
} {
  const now = Date.now();
  const lastMessageTime = ws.lastMessageTime || now;
  const messageCount = ws.messageCount || 0;
  const timeSinceLastReset = now - lastMessageTime;

  // If window expired, return fresh status
  if (timeSinceLastReset >= RATE_LIMIT_WINDOW) {
    return {
      messagesInWindow: 0,
      limit: MAX_MESSAGES_PER_SECOND,
      remaining: MAX_MESSAGES_PER_SECOND,
      windowResetMs: 0,
    };
  }

  return {
    messagesInWindow: messageCount,
    limit: MAX_MESSAGES_PER_SECOND,
    remaining: Math.max(0, MAX_MESSAGES_PER_SECOND - messageCount),
    windowResetMs: RATE_LIMIT_WINDOW - timeSinceLastReset,
  };
}
