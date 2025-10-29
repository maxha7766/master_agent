/**
 * Request Logging Middleware
 * Logs all API requests with structured context
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../../lib/logger';

/**
 * Middleware to log all incoming requests with timing
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach request ID to request for tracing
  (req as any).requestId = requestId;

  // Log incoming request
  log.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    res.send = originalSend; // Restore original send

    const duration = Date.now() - startTime;

    // Log response
    log.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id,
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error logging middleware (should be added after route handlers)
 */
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';

  log.error('Request failed', {
    requestId,
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack,
    userId: (req as any).user?.id,
  });

  next(error);
}
