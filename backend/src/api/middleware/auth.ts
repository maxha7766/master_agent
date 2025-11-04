/**
 * JWT Authentication Middleware
 * Validates Supabase JWT tokens and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../models/database.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Middleware to validate JWT token and attach user to request
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    log.debug('Auth middleware', {
      hasAuthHeader: !!authHeader,
      authHeaderStart: authHeader?.substring(0, 20)
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.warn('Missing or invalid authorization header');
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    log.debug('Verifying token with Supabase', { tokenLength: token.length });

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      log.warn('Token validation failed', { error: error?.message });
      throw new UnauthorizedError('Invalid or expired token');
    }

    log.debug('Token validated successfully', { userId: user.id, email: user.email });

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email || '',
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ error: error.message });
    } else {
      log.error('Authentication error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email || '',
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without auth
    next();
  }
}
