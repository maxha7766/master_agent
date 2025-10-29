/**
 * Conversations Routes
 * Manages conversations and messages
 */

import { Router, type Response, type NextFunction } from 'express';
import {
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
} from '../../services/conversation/conversationService.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { ValidationError } from '../../lib/errors.js';

export const conversationsRouter = Router();

// Apply auth middleware to all routes
conversationsRouter.use(authMiddleware);

/**
 * GET /api/conversations
 * List user's conversations
 */
conversationsRouter.get(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const conversations = await getConversations(userId);

      res.json(conversations);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/conversations
 * Create new conversation
 */
conversationsRouter.post(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { title } = req.body;

      const conversation = await createConversation(userId, title);

      res.status(201).json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/conversations/:id
 * Get conversation with messages
 */
conversationsRouter.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id;

      const conversation = await getConversation(conversationId, userId);

      res.json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/conversations/:id
 * Update conversation
 */
conversationsRouter.patch(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id;
      const { title } = req.body;

      if (title === undefined) {
        throw new ValidationError('No updates provided');
      }

      const conversation = await updateConversation(conversationId, userId, {
        title,
      });

      res.json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/conversations/:id
 * Delete conversation
 */
conversationsRouter.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.id;

      await deleteConversation(conversationId, userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
