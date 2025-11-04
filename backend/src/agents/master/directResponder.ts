/**
 * Master Agent Direct Responder
 * Handles general_chat intent using LLM with conversation context
 */

import { LLMFactory } from '../../services/llm/factory.js';
import { log } from '../../lib/logger.js';
import { retryWithBackoff } from '../../lib/utils.js';
import { supabase } from '../../models/database.js';
import type { ChatMessage, StreamChunk } from '../../services/llm/provider.js';

const SYSTEM_PROMPT = `You are a helpful, knowledgeable, and friendly AI assistant with access to the user's uploaded documents. You provide clear, accurate, and concise responses to user queries.

**Document Access:**
- All user-uploaded documents are stored in the documents table and have been processed into searchable chunks with embeddings
- When users ask about their documents or information that might be in their uploaded files, acknowledge that you have access to their document library
- You can reference that documents are available and searchable through the RAG (Retrieval Augmented Generation) system
- If a user asks what documents they've uploaded or what information you have access to, let them know that their uploaded documents are available in the system

Guidelines:
- Be conversational and engaging while remaining professional
- Provide accurate information when you know it
- Admit when you don't know something rather than guessing
- Be concise but thorough - aim for clarity over brevity
- Use markdown formatting when appropriate (lists, code blocks, etc.)
- When users ask about specific content in their documents, explain that the RAG system can search through their uploaded files

You have access to conversation history to maintain context across messages.`;

/**
 * Get user's document list for context
 */
async function getUserDocumentContext(userId: string): Promise<string> {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, file_name, file_type, summary, chunk_count, row_count, column_count, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !documents || documents.length === 0) {
      return '\n\n**User Documents:** No documents have been uploaded yet.';
    }

    const docList = documents
      .map((doc, i) => {
        const summary = doc.summary ? ` - ${doc.summary.substring(0, 100)}` : '';

        // Show different info for tabular vs text documents
        let details = '';
        if (doc.row_count && doc.column_count) {
          // Tabular data (CSV/Excel)
          details = ` (${doc.row_count} rows, ${doc.column_count} columns)`;
        } else if (doc.chunk_count) {
          // Text document (PDF/TXT)
          details = ` (${doc.chunk_count} chunks)`;
        }

        return `${i + 1}. ${doc.file_name}${details}${summary}`;
      })
      .join('\n');

    return `\n\n**User Documents (${documents.length} available):**\n${docList}`;
  } catch (error) {
    log.error('Failed to fetch user documents for context', { userId, error });
    return '';
  }
}

/**
 * Generate direct response for general chat
 */
export async function generateDirectResponse(
  userMessage: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string = 'gpt-4',
  temperature: number = 0.7
): Promise<{
  content: string;
  model: string;
  tokensUsed: { input: number; output: number; total: number };
  costUsd: number;
}> {
  try {
    const provider = LLMFactory.getProvider(model);

    // Get user's document context
    const documentContext = await getUserDocumentContext(userId);

    // Build message context (last 20 messages = 10 turns)
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + documentContext },
    ];

    // Add recent history (max 20 messages for context window)
    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Generate response with retry logic
    const result = await retryWithBackoff(
      () => provider.chat(messages, model, { temperature }),
      3, // 3 attempts
      1000 // 1 second base delay
    );

    log.info('Direct response generated', {
      model: result.model,
      tokensUsed: result.tokensUsed.total,
      costUsd: result.finishReason,
    });

    return {
      content: result.content,
      model: result.model,
      tokensUsed: result.tokensUsed,
      costUsd: 0, // Will be calculated by budget service
    };
  } catch (error) {
    log.error('Direct response generation failed', {
      error: error instanceof Error ? error.message : String(error),
      model,
      userMessage: userMessage.substring(0, 100),
    });
    throw error;
  }
}

/**
 * Generate streaming direct response for general chat
 */
export async function* generateDirectResponseStream(
  userMessage: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  model: string = 'gpt-4',
  temperature: number = 0.7
): AsyncGenerator<StreamChunk> {
  try {
    const provider = LLMFactory.getProvider(model);

    // Get user's document context
    const documentContext = await getUserDocumentContext(userId);

    // Build message context
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + documentContext },
    ];

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    log.info('Starting direct response stream', { model });

    // Stream response
    for await (const chunk of provider.chatStream(messages, model, {
      temperature,
    })) {
      yield chunk;
    }

    log.info('Direct response stream completed', { model });
  } catch (error) {
    log.error('Direct response stream failed', {
      error: error instanceof Error ? error.message : String(error),
      model,
    });
    throw error;
  }
}
