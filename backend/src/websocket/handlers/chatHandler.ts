/**
 * WebSocket Chat Handler
 * Processes incoming chat messages, routes to Master Agent, and streams responses
 */

import type { AuthenticatedWebSocket } from '../server.js';
import { wsManager } from '../server.js';
import { routeMessage, executeHandler } from '../../agents/master/router.js';
import { getRecentMessages, saveMessage, generateConversationTitle, needsTitle } from '../../services/conversation/conversationService.js';
import { BudgetService } from '../../services/llm/budget.js';
import { calculateLLMCost, countTokens } from '../../lib/utils.js';
import { log } from '../../lib/logger.js';
import { BudgetExceededError } from '../../lib/errors.js';
import { supabase } from '../../models/database.js';
import { processMessage, shouldExtractFromMessage } from '../../services/memory/memoryExtractor.js';
import type { ServerMessage } from '../types.js';

interface ChatSettings {
  disciplineLevel?: 'strict' | 'moderate' | 'exploration';
  minRelevanceScore?: number;
  ragOnlyMode?: boolean;
  fileTypes?: string[];
  dateRange?: {
    start: string | null;
    end: string | null;
  };
  topK?: number;
  useReranking?: boolean;
  hybridSearchBalance?: number;
}

interface ChatMessagePayload {
  kind: 'chat';
  conversationId: string;
  content: string;
  settings?: ChatSettings;
}

/**
 * Handle incoming chat message
 */
export async function handleChatMessage(
  ws: AuthenticatedWebSocket,
  message: ChatMessagePayload
): Promise<void> {
  const { conversationId, content, settings: chatSettings } = message;
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

    // Parallelize database queries and token counting
    const [conversationResult, settingsResult] = await Promise.all([
      supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('user_settings')
        .select('default_chat_model')
        .eq('user_id', userId)
        .single(),
    ]);

    const { data: conversation, error: convError } = conversationResult;
    const { data: settings } = settingsResult;

    if (convError || !conversation) {
      sendError(ws, 'Conversation not found', 'CONVERSATION_NOT_FOUND', conversationId);
      return;
    }

    const model = settings?.default_chat_model || 'claude-sonnet-4-5-20250929';
    const temperature = 0.7;

    // Skip pre-generation token counting - use conservative estimate
    const estimatedInputTokens = Math.ceil(content.length / 3); // ~3 chars per token
    const estimatedOutputTokens = 1000; // Conservative estimate
    const estimatedCost = calculateLLMCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      model
    );

    let budgetWarning;
    try {
      const budgetCheck = await BudgetService.checkBudget(userId, estimatedCost);
      budgetWarning = budgetCheck.warning;
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

    // Parallelize: save message, get history (independent operations)
    const [, history] = await Promise.all([
      saveMessage({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content,
      }),
      getRecentMessages(conversationId, 20),
    ]);

    const conversationHistory = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      created_at: msg.created_at,
    }));

    // Route message to appropriate agent
    console.log('\n========== ROUTING STAGE ==========');
    console.log('Input to router:', {
      content,
      userId,
      historyLength: conversationHistory.length,
      chatSettings
    });

    const routing = await routeMessage(content, userId, conversationHistory);

    console.log('Routing result:', {
      intent: routing.intent,
      handler: routing.handler,
      confidence: routing.confidence,
      reasoning: routing.reasoning
    });

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
    console.log('\n========== EXECUTION STAGE ==========');
    console.log('Executing handler:', routing.handler);
    console.log('Chat settings passed to handler:', chatSettings);

    let fullResponse = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let sourcesUsed: any = null;
    let imageUrl: string | undefined = undefined;
    let imageUrls: string[] | undefined = undefined;
    let imageMetadata: any = undefined;
    let chunkCount = 0;

    for await (const chunk of executeHandler(
      routing,
      content,
      userId,
      conversationHistory,
      model,
      temperature,
      chatSettings
    )) {
      chunkCount++;

      if (chunk.content) {
        fullResponse += chunk.content;
        console.log(`Chunk ${chunkCount}: ${chunk.content.substring(0, 50)}...`);

        // Send chunk to client
        sendMessage(ws, {
          kind: 'stream_chunk',
          messageId,
          chunk: chunk.content,
        });
      }

      // Capture sources metadata from final chunk
      if (chunk.sources) {
        sourcesUsed = chunk.sources;
        console.log('Sources found in chunk:', {
          sourcesCount: Array.isArray(chunk.sources) ? chunk.sources.length : 'not an array',
          sources: chunk.sources
        });
      }

      // Capture image data from chunk
      if (chunk.imageUrl) {
        imageUrl = chunk.imageUrl;
        console.log('Image URL found in chunk:', imageUrl);
      }

      if (chunk.imageUrls) {
        imageUrls = chunk.imageUrls;
        console.log('Image URLs found in chunk:', imageUrls);
      }

      if (chunk.metadata) {
        imageMetadata = chunk.metadata;
        console.log('Image metadata found in chunk:', imageMetadata);
      }

      if (chunk.done) {
        console.log('Stream completed. Total chunks:', chunkCount);
        break;
      }
    }

    console.log('\n========== RESPONSE COMPLETE ==========');
    console.log('Full response length:', fullResponse.length);
    console.log('Sources used:', sourcesUsed);
    console.log('Response preview:', fullResponse.substring(0, 200));

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

    // Save assistant message (with image URL if present)
    await saveMessage({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content: fullResponse,
      agent_used: routing.handler,
      model_used: model,
      tokens_used: totalInputTokens + totalOutputTokens,
      latency_ms: Date.now() - startTime,
      image_url: imageUrl,
      image_metadata: imageMetadata,
    } as any);

    // Send stream end with metadata (including image data)
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
        imageUrl,
        imageUrls,
        imageMetadata,
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

    // Generate conversation title if needed (async, don't wait)
    // Check if this is the first assistant response (conversation needs a title)
    if (await needsTitle(conversationId)) {
      log.info('Generating conversation title', { conversationId });
      generateConversationTitle(conversationId, userId).catch((error) => {
        log.error('Failed to generate conversation title in background', {
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    // Extract memories from user message (async, don't wait)
    // Only extract from user messages that are substantial enough
    if (shouldExtractFromMessage(content, 'user')) {
      log.info('Extracting memories from message', { messageId, userId });

      // Get recent conversation context for better extraction
      const contextMessages = conversationHistory.slice(-6); // Last 3 exchanges
      const contextText = contextMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      processMessage(
        messageId,
        conversationId,
        userId,
        content,
        contextText
      ).catch((error) => {
        log.error('Failed to extract memories in background', {
          messageId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
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
