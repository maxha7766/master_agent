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
 * List user's conversations with optional date grouping
 */
conversationsRouter.get(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { grouped } = req.query;

      const conversations = await getConversations(userId);

      // If grouped=true, return conversations grouped by date
      if (grouped === 'true') {
        const grouped = groupConversationsByDate(conversations);
        res.json(grouped);
      } else {
        res.json(conversations);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper: Group conversations by date
 */
function groupConversationsByDate(conversations: any[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups = {
    today: [] as any[],
    yesterday: [] as any[],
    lastWeek: [] as any[],
    older: [] as any[],
  };

  conversations.forEach((conv) => {
    const updatedAt = new Date(conv.updated_at);

    if (updatedAt >= today) {
      groups.today.push(conv);
    } else if (updatedAt >= yesterday) {
      groups.yesterday.push(conv);
    } else if (updatedAt >= lastWeek) {
      groups.lastWeek.push(conv);
    } else {
      groups.older.push(conv);
    }
  });

  return groups;
}

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
