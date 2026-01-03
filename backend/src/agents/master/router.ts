/**
 * Master Agent Router
 * All queries go through the master orchestrator
 * Master agent uses sub-agents (RAG, Tabular, SQL) as tools
 */

import { handleUserQuery } from './orchestrator.js';
import { sqlAgent } from '../sql/index.js';
import { ragAgent } from '../rag/index.js';
import { classifyIntent, type Intent, type IntentResult } from './intentClassifier.js';
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
    // Fast heuristic check for SQL queries (external databases)
    // Most queries go to orchestrator which handles RAG/Tabular decisions
    const lowerMessage = userMessage.toLowerCase();
    const sqlPatterns = [
      /connect to.*database/i,
      /query (the|my) (postgres|mysql|external) database/i,
      /(postgres|mysql|external).*connection/i,
    ];

    const isSqlQuery = sqlPatterns.some(pattern => pattern.test(userMessage));

    if (isSqlQuery) {
      // Check if user has database connections
      const hasConnections = await sqlAgent.hasConnections(userId);

      if (hasConnections) {
        log.info('SQL query detected with connections', { userId });
        return {
          intent: 'sql_query',
          confidence: 0.9,
          reasoning: 'External database query pattern detected',
          handler: 'sql',
        };
      } else {
        log.info('SQL intent detected but no database connections, using direct handler', {
          userId,
        });
      }
    }

    // All other queries go to orchestrator (RAG/Tabular/Direct)
    // Orchestrator will make the intelligent decision about which sub-agents to use
    log.info('Message routed to orchestrator', {
      userId,
      handler: 'rag',
    });

    return {
      intent: 'rag_query',
      confidence: 1.0,
      reasoning: 'Routing to orchestrator for intelligent agent selection',
      handler: 'rag',
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
 * Execute handler - now simplified to just call master orchestrator
 * Master agent handles all document queries (RAG + Tabular)
 * SQL agent still separate for external database queries
 */
export interface ChatSettings {
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

export async function* executeHandler(
  routingResult: RoutingResult,
  userMessage: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string = 'claude-3-haiku-20240307',
  temperature: number = 0.7,
  chatSettings?: ChatSettings,
  attachedImageUrl?: string
): AsyncGenerator<StreamChunk> {
  const { handler, intent } = routingResult;

  // SQL queries to external databases still go to SQL agent
  if (handler === 'sql') {
    log.info('Executing SQL handler for external database', { intent, userId });

    try {
      for await (const chunk of sqlAgent.generateStreamingResponse(
        userMessage,
        userId,
        {
          model,
          temperature,
        }
      )) {
        yield chunk;
      }
    } catch (error) {
      log.error('SQL handler failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      yield {
        content: 'Sorry, I encountered an error querying your database. Please try again.',
        done: true,
      };
    }
    return;
  }

  // ALL other queries go through master orchestrator
  // Master decides if it needs RAG, Tabular, or neither
  log.info('Routing to master orchestrator', { userId, intent });

  try {
    yield* handleUserQuery(userMessage, userId, conversationHistory, model, temperature, chatSettings, attachedImageUrl);
  } catch (error) {
    log.error('Master orchestrator failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    yield {
      content: 'Sorry, I encountered an error processing your request. Please try again.',
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
