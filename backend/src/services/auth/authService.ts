/**
 * Authentication Service
 * Handles user signup, login, and session management using Supabase Auth
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';

export interface SignupParams {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Register a new user
 */
export async function signup(params: SignupParams): Promise<AuthResult> {
  const { email, password, displayName } = params;

  // Validate email format
  if (!email || !email.includes('@')) {
    throw new ValidationError('Invalid email address');
  }

  // Validate password strength
  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  try {
    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) {
      log.error('Signup failed', { email, error: error.message });
      throw new ValidationError(error.message);
    }

    if (!data.user || !data.session) {
      throw new ValidationError('Signup failed: No user or session created');
    }

    // Initialize user settings and usage tracking
    await initializeUserData(data.user.id, email, displayName);

    log.info('User signed up successfully', {
      userId: data.user.id,
      email,
    });

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    log.error('Signup error', { email, error });
    throw new ValidationError('Failed to create account');
  }
}

/**
 * Authenticate user
 */
export async function login(params: LoginParams): Promise<AuthResult> {
  const { email, password } = params;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      log.warn('Login failed', { email, error: error.message });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedError('Login failed: No user or session');
    }

    // Check if user is active
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', data.user.id)
      .single();

    if (dbError || !userData?.is_active) {
      log.warn('Login attempt by inactive user', { userId: data.user.id });
      throw new UnauthorizedError('Account is inactive');
    }

    log.info('User logged in', { userId: data.user.id, email });

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    log.error('Login error', { email, error });
    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Sign out user (revoke session)
 */
export async function logout(accessToken: string): Promise<void> {
  try {
    const { error } = await supabase.auth.admin.signOut(accessToken);

    if (error) {
      log.warn('Logout failed', { error: error.message });
      // Don't throw - logout should be best-effort
    }

    log.info('User logged out');
  } catch (error) {
    log.error('Logout error', { error });
    // Don't throw - logout should be best-effort
  }
}

/**
 * Verify access token and get user
 */
export async function verifyToken(accessToken: string): Promise<{
  id: string;
  email: string;
}> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    return {
      id: user.id,
      email: user.email!,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Token verification failed');
  }
}

/**
 * Initialize user data after signup
 */
async function initializeUserData(
  userId: string,
  email: string,
  displayName?: string
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // Create user record
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      email,
      display_name: displayName || email.split('@')[0],
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (userError) {
      log.error('Failed to create user record', { userId, error: userError });
    }

    // Create default user settings
    const { error: settingsError } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        default_model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4096,
        enable_citations: true,
        enable_web_search: true,
      });

    if (settingsError) {
      log.error('Failed to create user settings', {
        userId,
        error: settingsError,
      });
    }

    // Initialize usage tracking for current month
    const { error: usageError } = await supabase.from('user_usage').insert({
      user_id: userId,
      month: currentMonth,
      total_messages: 0,
      total_tokens_input: 0,
      total_tokens_output: 0,
      total_cost_usd: 0,
      budget_limit_reached: false,
      budget_warning_sent: false,
    });

    if (usageError) {
      log.error('Failed to initialize usage tracking', {
        userId,
        error: usageError,
      });
    }

    log.info('User data initialized', { userId });
  } catch (error) {
    log.error('Error initializing user data', { userId, error });
    // Don't throw - user is already created in Auth
  }
}
