/**
 * Master Agent Intent Classifier
 * Classifies user queries into 5 categories for routing
 */

import { LLMFactory } from '../../services/llm/factory.js';
import { log } from '../../lib/logger.js';
import type { ChatMessage } from '../../services/llm/provider.js';

export type Intent =
  | 'general_chat'
  | 'rag_query'
  | 'sql_query'
  | 'research_request'
  | 'multi_step_workflow';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  reasoning: string;
}

const CLASSIFICATION_PROMPT = `You are an intent classifier for a personal AI assistant with multiple specialized capabilities.

The user has uploaded documents to their personal knowledge base. IMPORTANT: Any question that could potentially be answered from uploaded documents should be classified as "rag_query" to search their documents first.

Classify the user's message into ONE of these categories:

1. **general_chat**: Casual conversation, greetings, general questions about the AI assistant's capabilities
   Examples: "Hello", "How are you?", "What can you help me with?", "Tell me a joke"

2. **rag_query**: ANY question that could be answered from uploaded documents - definitions, explanations, summaries, facts, rules, procedures, etc.
   Examples:
   - "What does my contract say about termination?"
   - "Summarize the main findings in my research paper"
   - "Find mentions of X in my documents"
   - "What is a balk?" (if user has sports/rules documents)
   - "Define term X" (if user might have reference documents)
   - "Explain concept Y" (if user has educational/technical documents)
   - "What are the rules for Z?" (if user has policy/rules documents)

3. **sql_query**: Questions EXPLICITLY about EXTERNAL connected databases (PostgreSQL, MySQL, etc.)
   Examples: "Query my production database for users", "Connect to my MySQL database and show tables"

   NOTE: Questions about uploaded CSV/Excel files should be classified as "rag_query", NOT "sql_query"

4. **research_request**: Questions EXPLICITLY requesting web search, news, or current events that are clearly outside uploaded documents
   Examples:
   - "What's the latest news on AI?" (current events)
   - "Search the web for company X's recent announcements" (explicitly web search)
   - "What happened today in politics?" (current events)

5. **multi_step_workflow**: Complex requests requiring multiple steps or agent coordination
   Examples: "Research company X online, then find their financial reports in my documents, and analyze their revenue trends", "Search my documents for contracts, extract key terms, and create a summary report"

IMPORTANT DECISION RULES:
- If the user has documents uploaded, DEFAULT to "rag_query" for ANY informational question (definitions, explanations, facts, etc.)
- Only use "research_request" if the question EXPLICITLY mentions current events, news, or web search
- When in doubt between rag_query and research_request, choose rag_query

Respond in JSON format:
{
  "intent": "category_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

/**
 * Classify user intent using LLM
 */
export async function classifyIntent(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<IntentResult> {
  try {
    // Use fast model for classification (GPT-3.5-turbo or Claude Haiku)
    const provider = LLMFactory.getProvider('gpt-3.5-turbo');

    // Build context with recent history
    const contextMessages: ChatMessage[] = [
      { role: 'system', content: CLASSIFICATION_PROMPT },
    ];

    // Include last 3 turns for context
    const recentHistory = conversationHistory.slice(-6); // 3 user + 3 assistant
    for (const msg of recentHistory) {
      contextMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    contextMessages.push({
      role: 'user',
      content: userMessage,
    });

    // Get classification
    const result = await provider.chat(contextMessages, 'gpt-3.5-turbo', {
      temperature: 0.0, // Deterministic classification
      maxTokens: 200,
    });

    // Parse JSON response
    const parsed = parseClassificationResponse(result.content);

    log.info('Intent classified', { userMessage: userMessage.substring(0, 100), intent: parsed.intent, confidence: parsed.confidence });

    return parsed;
  } catch (error) {
    log.error('Intent classification failed', { error: error instanceof Error ? error.message : String(error), userMessage: userMessage.substring(0, 100) });

    // Default to general_chat on error
    return {
      intent: 'general_chat',
      confidence: 0.5,
      reasoning: 'Classification failed, defaulting to general chat',
    };
  }
}

/**
 * Fast heuristic-based intent classification (fallback)
 */
export function classifyIntentHeuristic(userMessage: string): IntentResult {
  const lowerMessage = userMessage.toLowerCase();

  // RAG query patterns
  const ragPatterns = [
    /what does (my|the) (document|file|paper|contract|report)/i,
    /in my (documents|files|uploads)/i,
    /according to (my|the) document/i,
    /find (in|from) (my|the) (document|file)/i,
    /summarize (my|the) (document|file|paper)/i,
  ];

  for (const pattern of ragPatterns) {
    if (pattern.test(userMessage)) {
      return {
        intent: 'rag_query',
        confidence: 0.8,
        reasoning: 'Message references uploaded documents',
      };
    }
  }

  // SQL query patterns
  const sqlPatterns = [
    /show me.*from (database|table|db)/i,
    /query (the|my) database/i,
    /select.*from/i,
    /(top|bottom) \d+ (customers|products|sales)/i,
    /(calculate|compute|sum|count|average).*revenue|sales|customers/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(userMessage)) {
      return {
        intent: 'sql_query',
        confidence: 0.8,
        reasoning: 'Message appears to request database query',
      };
    }
  }

  // Research patterns
  const researchPatterns = [
    /research (about|on|the)/i,
    /(latest|recent) news (about|on)/i,
    /find information (about|on)/i,
    /search (the )?(web|internet) for/i,
    /what('s| is) happening (with|in)/i,
  ];

  for (const pattern of researchPatterns) {
    if (pattern.test(userMessage)) {
      return {
        intent: 'research_request',
        confidence: 0.8,
        reasoning: 'Message requests web research',
      };
    }
  }

  // Multi-step patterns
  if (
    (lowerMessage.includes('and then') ||
      lowerMessage.includes('after that') ||
      lowerMessage.split(',').length > 2) &&
    lowerMessage.length > 100
  ) {
    return {
      intent: 'multi_step_workflow',
      confidence: 0.7,
      reasoning: 'Message contains multiple steps',
    };
  }

  // Default to general chat
  return {
    intent: 'general_chat',
    confidence: 0.9,
    reasoning: 'Message appears to be general conversation',
  };
}

/**
 * Parse LLM classification response
 */
function parseClassificationResponse(response: string): IntentResult {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate intent
    const validIntents: Intent[] = [
      'general_chat',
      'rag_query',
      'sql_query',
      'research_request',
      'multi_step_workflow',
    ];

    if (!validIntents.includes(parsed.intent)) {
      throw new Error(`Invalid intent: ${parsed.intent}`);
    }

    return {
      intent: parsed.intent,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.8)),
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    log.warn('Failed to parse classification response', { response: response.substring(0, 200), error });

    // Try heuristic fallback
    return {
      intent: 'general_chat',
      confidence: 0.5,
      reasoning: 'Failed to parse LLM response',
    };
  }
}
