/**
 * Conversation Summarization Service
 * Creates condensed summaries of conversations for long-term memory
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import type { ConversationSummary, SummaryInsert } from './types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SUMMARIZATION_PROMPT = `You are an expert at summarizing conversations. Create a concise summary of the conversation below.

Your summary should:
- Capture the main topics discussed
- Identify key decisions or conclusions
- Extract important facts or information shared
- List entities mentioned (people, places, organizations, etc.)
- Be factual and objective

Return your summary as JSON with this structure:
{
  "summary": "Brief 2-3 sentence summary of the conversation",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "entities_mentioned": ["Entity 1", "Entity 2"]
}`;

/**
 * Summarize a conversation
 */
export async function summarizeConversation(
  conversationId: string,
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string; id?: string }>
): Promise<ConversationSummary | null> {
  if (messages.length === 0) {
    return null;
  }

  try {
    // Format conversation for summarization
    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // Generate summary using Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `${SUMMARIZATION_PROMPT}\n\nConversation:\n${conversationText}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    // Store summary in database
    const summaryData: SummaryInsert = {
      conversation_id: conversationId,
      user_id: userId,
      summary: parsed.summary,
      key_points: parsed.key_points || [],
      entities_mentioned: parsed.entities_mentioned || [],
      message_range_start: messages[0]?.id || null,
      message_range_end: messages[messages.length - 1]?.id || null,
    };

    const { data, error } = await supabase
      .from('conversation_summaries')
      .insert(summaryData)
      .select()
      .single();

    if (error || !data) {
      log.error('Failed to store conversation summary', { error, conversationId });
      return null;
    }

    log.info('Conversation summarized', {
      conversationId,
      userId,
      messageCount: messages.length,
      keyPoints: parsed.key_points?.length || 0,
    });

    return data;
  } catch (error) {
    log.error('Failed to summarize conversation', {
      error: error instanceof Error ? error.message : String(error),
      conversationId,
      userId,
    });
    return null;
  }
}

/**
 * Get summaries for a conversation
 */
export async function getConversationSummaries(
  conversationId: string
): Promise<ConversationSummary[]> {
  try {
    const { data, error } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      log.error('Failed to get conversation summaries', { error, conversationId });
      return [];
    }

    return data;
  } catch (error) {
    log.error('Error getting conversation summaries', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get all summaries for a user
 */
export async function getUserSummaries(userId: string): Promise<ConversationSummary[]> {
  try {
    const { data, error } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      log.error('Failed to get user summaries', { error, userId });
      return [];
    }

    return data;
  } catch (error) {
    log.error('Error getting user summaries', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Should we summarize this conversation?
 * Summarize after every 20 messages
 */
export function shouldSummarize(messageCount: number): boolean {
  return messageCount > 0 && messageCount % 20 === 0;
}
