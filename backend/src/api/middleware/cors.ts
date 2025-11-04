/**
 * CORS Middleware
 * Restricted to frontend domain only
 */

import { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
]).map(origin => origin.trim());

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  // Set CORS headers if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  } else if (req.method === 'OPTIONS') {
    // Preflight from non-allowed origin
    console.warn(`[CORS] Blocked preflight from origin: ${origin}`);
    console.warn(`[CORS] Allowed origins:`, ALLOWED_ORIGINS);
    res.status(403).end();
    return;
  }

  next();
}
