/**
 * WebSocket Image Handler
 * Processes image generation, editing, and upload requests
 */

import type { AuthenticatedWebSocket } from '../server.js';
import { wsManager } from '../server.js';
import { ImageAgent } from '../../agents/image/agent.js';
import { BudgetService } from '../../services/llm/budget.js';
import { log } from '../../lib/logger.js';
import { BudgetExceededError } from '../../lib/errors.js';
import { supabase } from '../../models/database.js';
import type { ServerMessage } from '../types.js';

interface ImageGeneratePayload {
  kind: 'image_generate';
  conversationId?: string;
  operation: 'text-to-image' | 'image-to-image' | 'inpaint' | 'upscale' | 'variation';
  parameters: {
    prompt: string;
    negativePrompt?: string;
    sourceImage?: string;
    maskImage?: string;
    width?: number;
    height?: number;
    size?: string;
    creativityMode?: 'precise' | 'balanced' | 'creative';
    guidanceScale?: number;
    numInferenceSteps?: number;
    seed?: number;
    strength?: number;
    scaleFactor?: number;
    numVariations?: number;
  };
}

interface ImageListPayload {
  kind: 'image_list';
}

const imageAgent = new ImageAgent();

// Initialize the agent when the module loads
imageAgent.initialize().catch((error) => {
  log.error('Failed to initialize image agent', {
    error: error instanceof Error ? error.message : String(error),
  });
});

/**
 * Handle image generation request
 */
export async function handleImageGenerate(
  ws: AuthenticatedWebSocket,
  message: ImageGeneratePayload
): Promise<void> {
  const { conversationId, operation, parameters } = message;
  const userId = ws.userId!;

  const startTime = Date.now();
  const jobId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    log.info('Processing image generation request', {
      userId,
      conversationId,
      jobId,
      operation,
    });

    // Verify conversation exists if provided
    if (conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conversation) {
        sendError(ws, 'Conversation not found', 'CONVERSATION_NOT_FOUND', conversationId);
        return;
      }
    }

    // Estimate cost based on operation
    const estimatedCost = getEstimatedCost(operation);

    // Check budget
    let budgetWarning;
    try {
      const budgetCheck = await BudgetService.checkBudget(userId, estimatedCost);
      budgetWarning = budgetCheck.warning;
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        log.warn('Budget exceeded for image generation', { userId, estimatedCost });
        sendError(
          ws,
          `Monthly budget limit exceeded. Current: $${error.currentCost.toFixed(2)}, Limit: $${error.limit.toFixed(2)}`,
          'BUDGET_EXCEEDED',
          conversationId
        );
        return;
      }
      throw error;
    }

    // Send budget warning if threshold reached
    if (budgetWarning) {
      const warningMessage: ServerMessage = {
        kind: 'budget_warning',
        currentCost: budgetWarning.currentCost,
        limit: budgetWarning.limit,
        percentUsed: budgetWarning.percentUsed,
        threshold: budgetWarning.threshold,
      };
      ws.send(JSON.stringify(warningMessage));
      log.info('Budget warning sent to client', { userId, percentUsed: budgetWarning.percentUsed });
    }

    // Send progress start
    sendMessage(ws, {
      kind: 'progress',
      jobId,
      progressPercent: 0,
      status: 'Starting image generation...',
    });

    // Process image generation
    const result = await imageAgent.processRequest({
      userId,
      conversationId,
      operation,
      parameters,
    });

    if (!result.success || !result.data) {
      sendError(ws, result.error || 'Image generation failed', 'IMAGE_GENERATION_FAILED', conversationId);
      return;
    }

    // Track image generation cost
    if (result.costUsd) {
      await BudgetService.trackImageCost(userId, result.costUsd);
    }

    // Send progress complete
    sendMessage(ws, {
      kind: 'progress',
      jobId,
      progressPercent: 100,
      status: 'Image generation complete',
    });

    // Send the generated image result
    ws.send(JSON.stringify({
      kind: 'image_result',
      jobId,
      data: result.data,
      costUsd: result.costUsd,
      processingTimeMs: Date.now() - startTime,
    }));

    log.info('Image generation completed successfully', {
      jobId,
      userId,
      conversationId,
      operation,
      costUsd: result.costUsd,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    log.error('Image generation failed', {
      jobId,
      userId,
      conversationId,
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    sendError(
      ws,
      'Failed to generate image. Please try again.',
      'PROCESSING_ERROR',
      conversationId
    );
  }
}

/**
 * Handle image list request
 */
export async function handleImageList(
  ws: AuthenticatedWebSocket,
  message: ImageListPayload
): Promise<void> {
  const userId = ws.userId!;

  try {
    log.info('Processing image list request', { userId });

    const result = await imageAgent.processRequest({
      userId,
      operation: 'list-images',
      parameters: {},
    });

    if (!result.success || !result.data) {
      sendError(ws, result.error || 'Failed to list images', 'IMAGE_LIST_FAILED');
      return;
    }

    ws.send(JSON.stringify({
      kind: 'image_list_result',
      data: result.data,
    }));

    log.info('Image list retrieved successfully', {
      userId,
      count: Array.isArray(result.data) ? result.data.length : 0,
    });
  } catch (error) {
    log.error('Image list failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    sendError(ws, 'Failed to retrieve image list. Please try again.', 'PROCESSING_ERROR');
  }
}

/**
 * Get estimated cost for image operation
 */
function getEstimatedCost(operation: string): number {
  const costs: Record<string, number> = {
    'text-to-image': 0.004,
    'image-to-image': 0.004,
    'inpaint': 0.004,
    'upscale': 0.005,
    'variation': 0.012, // 3 variations at 0.004 each
  };
  return costs[operation] || 0.004;
}

/**
 * Send message to client
 */
function sendMessage(ws: AuthenticatedWebSocket, message: ServerMessage): void {
  wsManager.sendMessage(ws, message);
}

/**
 * Send error message to client
 */
function sendError(
  ws: AuthenticatedWebSocket,
  errorMessage: string,
  code: string,
  conversationId?: string
): void {
  sendMessage(ws, {
    kind: 'error',
    error: errorMessage,
    code,
    conversationId,
  });
}
