/**
 * Authentication Routes
 * Handles user signup, login, and logout
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { signup, login, logout } from '../../services/auth/authService.js';
import { ValidationError, UnauthorizedError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';

export const authRouter = Router();

/**
 * POST /api/auth/signup
 * Register a new user
 */
authRouter.post(
  '/signup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      const result = await signup({ email, password });

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user
 */
authRouter.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      const result = await login({ email, password });

      res.json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/logout
 * Sign out user
 */
authRouter.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing authorization header');
      }

      const token = authHeader.substring(7);
      await logout(token);

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
);
