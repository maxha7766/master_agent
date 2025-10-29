/**
 * WebSocket Authentication Middleware
 * Validates JWT token on WebSocket connection upgrade
 */

import { IncomingMessage } from 'http';
import { supabase } from '../../models/database';
import { log } from '../../lib/logger';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Extract and validate JWT token from WebSocket upgrade request
 * Token can be provided via:
 * 1. Authorization header: "Bearer <token>"
 * 2. Query parameter: ?token=<token>
 */
export async function authMiddleware(request: IncomingMessage): Promise<AuthUser | null> {
  try {
    let token: string | null = null;

    // Try to extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback to query parameter
    if (!token && request.url) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      token = url.searchParams.get('token');
    }

    if (!token) {
      log.warn('WebSocket auth failed: No token provided', {
        ip: request.socket.remoteAddress,
      });
      return null;
    }

    // Validate token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      log.warn('WebSocket auth failed: Invalid token', {
        error: error?.message,
        ip: request.socket.remoteAddress,
      });
      return null;
    }

    // Check if user is active (not banned)
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', user.id)
      .single();

    if (dbError || !userData?.is_active) {
      log.warn('WebSocket auth failed: User not active', {
        userId: user.id,
        error: dbError?.message,
      });
      return null;
    }

    log.info('WebSocket authenticated', {
      userId: user.id,
      email: user.email,
    });

    return {
      id: user.id,
      email: user.email || '',
    };
  } catch (error) {
    log.error('WebSocket auth error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract user ID from authenticated WebSocket request (for use in handlers)
 */
export function getUserFromRequest(request: IncomingMessage): string | null {
  // User ID is attached after successful auth in server.ts
  return (request as any).userId || null;
}
