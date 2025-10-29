/**
 * WebSocket Chat Handler
 * Processes incoming chat messages, routes to Master Agent, and streams responses
 */

import type { AuthenticatedWebSocket } from '../server.js';
import { wsManager } from '../server.js';
import { routeMessage, executeHandler } from '../../agents/master/router.js';
import { getRecentMessages, saveMessage } from '../../services/conversation/conversationService.js';
import { BudgetService } from '../../services/llm/budget.js';
import { calculateLLMCost, countTokens } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { BudgetExceededError } from '../../lib/errors.js';
import { supabase } from '../../models/database.js';
import type { ServerMessage } from '../types.js';

interface ChatMessagePayload {
  kind: 'chat';
  conversationId: string;
  content: string;
}

/**
 * Handle incoming chat message
 */
export async function handleChatMessage(
  ws: AuthenticatedWebSocket,
  message: ChatMessagePayload
): Promise<void> {
  const { conversationId, content } = message;
  const userId = ws.userId!;

  const startTime = Date.now();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    log.info('Processing chat message', {
      userId,
      conversationId,
      messageId,
      contentLength: content.length,
    });

    // Validate conversation belongs to user
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

    // Get user settings for model preference
    const { data: settings } = await supabase
      .from('user_settings')
      .select('default_chat_model')
      .eq('user_id', userId)
      .single();

    const model = settings?.default_chat_model || 'claude-sonnet-4-20250514';
    const temperature = 0.7;

    // Estimate cost and check budget
    const estimatedInputTokens = await countTokens(content, model);
    const estimatedOutputTokens = 1000; // Conservative estimate
    const estimatedCost = calculateLLMCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      model
    );

    try {
      await BudgetService.checkBudget(userId, estimatedCost);
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        log.warn('Budget exceeded', { userId, estimatedCost });
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

    // Save user message
    await saveMessage({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content,
    });

    // Get conversation history for context
    const history = await getRecentMessages(conversationId, 20);
    const conversationHistory = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Route message to appropriate agent
    const routing = await routeMessage(content, userId, conversationHistory);

    log.info('Message routed', {
      messageId,
      intent: routing.intent,
      handler: routing.handler,
      confidence: routing.confidence,
    });

    // Send stream start
    sendMessage(ws, {
      kind: 'stream_start',
      messageId,
      agent: routing.handler,
      model,
    });

    // Execute handler and stream response
    let fullResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for await (const chunk of executeHandler(
      routing,
      content,
      userId,
      conversationHistory,
      model,
      temperature
    )) {
      if (chunk.content) {
        fullResponse += chunk.content;

        // Send chunk to client
        sendMessage(ws, {
          kind: 'stream_chunk',
          messageId,
          chunk: chunk.content,
        });
      }

      if (chunk.done) {
        break;
      }
    }

    // Calculate actual token usage and cost
    totalInputTokens = await countTokens(
      JSON.stringify(conversationHistory) + content,
      model
    );
    totalOutputTokens = await countTokens(fullResponse, model);
    const actualCost = calculateLLMCost(totalInputTokens, totalOutputTokens, model);

    // Track usage
    await BudgetService.trackUsage(
      userId,
      model,
      totalInputTokens,
      totalOutputTokens
    );

    // Save assistant message
    await saveMessage({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content: fullResponse,
      agent_used: routing.handler,
      model_used: model,
      tokens_used: totalInputTokens + totalOutputTokens,
      latency_ms: Date.now() - startTime,
    });

    // Send stream end with metadata
    const latencyMs = Date.now() - startTime;
    sendMessage(ws, {
      kind: 'stream_end',
      messageId,
      metadata: {
        tokensUsed: {
          input: totalInputTokens,
          output: totalOutputTokens,
          total: totalInputTokens + totalOutputTokens,
        },
        costUsd: actualCost,
        latencyMs,
        finishReason: 'stop',
      },
    });

    log.info('Chat message processed successfully', {
      messageId,
      userId,
      conversationId,
      tokensUsed: totalInputTokens + totalOutputTokens,
      costUsd: actualCost,
      latencyMs,
    });
  } catch (error) {
    log.error('Chat message processing failed', {
      messageId,
      userId,
      conversationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    sendError(
      ws,
      'Failed to process message. Please try again.',
      'PROCESSING_ERROR',
      conversationId
    );
  }
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
