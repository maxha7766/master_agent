/**
 * Master Agent Router
 * Routes requests to appropriate sub-agents based on intent
 */

import { classifyIntent, type Intent, type IntentResult } from './intentClassifier.js';
import { generateDirectResponseStream } from './directResponder.js';
import { ragAgent } from '../rag/index.js';
import { log } from '../../lib/logger.js';
import type { StreamChunk } from '../../services/llm/provider.js';

export interface RoutingResult {
  intent: Intent;
  confidence: number;
  reasoning: string;
  handler: 'direct' | 'rag' | 'sql' | 'research' | 'workflow';
}

/**
 * Route user message to appropriate agent
 */
export async function routeMessage(
  userMessage: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<RoutingResult> {
  try {
    // Check if user has documents (needed for RAG routing decision)
    const hasDocuments = await ragAgent.hasDocuments(userId);

    // Classify intent
    const intentResult: IntentResult = await classifyIntent(
      userMessage,
      conversationHistory
    );

    // Map intent to handler
    let handler = mapIntentToHandler(intentResult.intent);

    // Override RAG routing if user has no documents
    if (handler === 'rag' && !hasDocuments) {
      log.info('RAG intent detected but no documents available, using direct handler', {
        userId,
      });
      handler = 'direct';
    }

    log.info('Message routed', {
      intent: intentResult.intent,
      handler,
      confidence: intentResult.confidence,
      hasDocuments,
    });

    return {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      reasoning: intentResult.reasoning,
      handler,
    };
  } catch (error) {
    log.error('Routing failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Default to direct handler on error
    return {
      intent: 'general_chat',
      confidence: 0.5,
      reasoning: 'Routing error, defaulting to general chat',
      handler: 'direct',
    };
  }
}

/**
 * Execute handler based on routing result
 */
export async function* executeHandler(
  routingResult: RoutingResult,
  userMessage: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string = 'gpt-4',
  temperature: number = 0.7
): AsyncGenerator<StreamChunk> {
  const { handler, intent } = routingResult;

  switch (handler) {
    case 'direct':
      // Handle general chat directly
      yield* generateDirectResponseStream(
        userMessage,
        userId,
        conversationHistory,
        model,
        temperature
      );
      break;

    case 'rag':
      // Use RAG agent to search documents and generate response
      log.info('Executing RAG handler', { intent, userId });

      try {
        // Stream RAG response
        for await (const chunk of ragAgent.generateStreamingResponse(
          userMessage,
          userId,
          {
            topK: 5,
            minRelevanceScore: 0.3,
            model,
            temperature,
            includeSources: true,
          }
        )) {
          yield { content: chunk, done: false };
        }

        yield { content: '', done: true };
      } catch (error) {
        log.error('RAG handler failed', {
          error: error instanceof Error ? error.message : String(error),
          userId,
        });
        yield {
          content: 'Sorry, I encountered an error searching your documents. Please try again.',
          done: true,
        };
      }
      break;

    case 'sql':
      // TODO: Implement in Phase 5 (User Story 3)
      log.warn('SQL handler not yet implemented', { intent });
      yield {
        content: "I can help you query databases, but that feature isn't fully implemented yet. For now, I can answer general questions!",
        done: true,
      };
      break;

    case 'research':
      // TODO: Implement in Phase 6 (User Story 4)
      log.warn('Research handler not yet implemented', { intent });
      yield {
        content: "I can help you research topics online, but that feature isn't fully implemented yet. For now, I can answer general questions based on my training data!",
        done: true,
      };
      break;

    case 'workflow':
      // TODO: Implement in Phase 7 (User Story 5)
      log.warn('Workflow handler not yet implemented', { intent });
      yield {
        content: "I can help with multi-step tasks, but that feature isn't fully implemented yet. Try breaking your request into simpler steps for now!",
        done: true,
      };
      break;

    default:
      log.error('Unknown handler', { handler });
      yield {
        content: 'Sorry, I encountered an error processing your request.',
        done: true,
      };
  }
}

/**
 * Map intent to handler name
 */
function mapIntentToHandler(
  intent: Intent
): 'direct' | 'rag' | 'sql' | 'research' | 'workflow' {
  switch (intent) {
    case 'general_chat':
      return 'direct';
    case 'rag_query':
      return 'rag';
    case 'sql_query':
      return 'sql';
    case 'research_request':
      return 'research';
    case 'multi_step_workflow':
      return 'workflow';
    default:
      log.warn('Unknown intent, defaulting to direct', { intent });
      return 'direct';
  }
}
