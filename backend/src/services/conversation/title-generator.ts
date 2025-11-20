/**
 * Conversation Title Generator Service
 * Generates concise 2-4 word titles for conversations based on message content
 */

import { log } from '../../lib/logger.js';
import { LLMFactory } from '../llm/factory.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface TitleGenerationResult {
  title: string;
  confidence: 'high' | 'medium' | 'low';
}

export class ConversationTitleGenerator {
  private readonly DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
  private readonly MAX_MESSAGES_TO_ANALYZE = 6; // First 3 exchanges

  /**
   * Generate a concise title for a conversation based on initial messages
   */
  async generateTitle(
    messages: Message[],
    conversationId?: string
  ): Promise<TitleGenerationResult> {
    try {
      log.info('Generating conversation title', {
        conversationId,
        messageCount: messages.length,
      });

      // Use only first few messages for title generation
      const messagesToAnalyze = messages.slice(0, this.MAX_MESSAGES_TO_ANALYZE);

      if (messagesToAnalyze.length === 0) {
        return this.fallbackTitle(messages);
      }

      const provider = LLMFactory.getProvider(this.DEFAULT_MODEL);

      const systemPrompt = `You are a conversation title generator. Your task is to create a concise, descriptive title for a conversation based on its initial messages.

**Your Task:**
1. Read the first few messages of the conversation
2. Identify the main topic or purpose of the conversation
3. Generate a clear, professional title

**Guidelines:**
- Keep it SHORT: 2-4 words maximum
- Be SPECIFIC: Capture the actual topic (e.g., "Sales Data Analysis" not "Data Question")
- Use TITLE CASE: Capitalize Major Words
- NO PUNCTUATION: No periods, quotes, or special characters
- NO GENERIC TITLES: Avoid "New Chat", "Question", "Help" etc.
- FOCUS ON TOPIC: Not the action (e.g., "Product Roadmap" not "Asking About Product")

**Examples:**
- User asks about sales trends → "Sales Trend Analysis"
- User uploads financial data → "Financial Report Review"
- User queries customer database → "Customer Data Query"
- User asks about Python code → "Python Code Help"
- Discussion about marketing strategy → "Marketing Strategy"

**Response Format (JSON):**
{
  "title": "The Generated Title",
  "confidence": "high" | "medium" | "low"
}`;

      const conversationText = messagesToAnalyze
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 500)}`)
        .join('\n\n');

      const userPrompt = `Generate a 2-4 word title for this conversation:

${conversationText}

What is the best title for this conversation?`;

      const response = await provider.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        this.DEFAULT_MODEL,
        { temperature: 0.3 } // Low temperature for consistency
      );

      // Extract JSON from markdown code blocks if present
      let jsonContent = response.content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```\s*/, '').replace(/```\s*$/, '');
      }

      const result = JSON.parse(jsonContent);

      // Validate title length (2-4 words)
      const wordCount = result.title.trim().split(/\s+/).length;
      if (wordCount > 6) {
        log.warn('Generated title too long, truncating', {
          conversationId,
          originalTitle: result.title,
        });

        // Take first 4 words
        result.title = result.title.split(/\s+/).slice(0, 4).join(' ');
      }

      log.info('Conversation title generated', {
        conversationId,
        title: result.title,
        confidence: result.confidence,
      });

      return {
        title: result.title,
        confidence: result.confidence || 'medium',
      };
    } catch (error) {
      log.error('Title generation failed', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.fallbackTitle(messages);
    }
  }

  /**
   * Generate fallback title from first user message
   */
  private fallbackTitle(messages: Message[]): TitleGenerationResult {
    // Find first user message
    const firstUserMessage = messages.find((m) => m.role === 'user');

    if (!firstUserMessage) {
      return {
        title: 'New Conversation',
        confidence: 'low',
      };
    }

    // Take first 3-4 words from message
    const words = firstUserMessage.content
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .slice(0, 4)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return {
      title: words || 'New Conversation',
      confidence: 'low',
    };
  }

  /**
   * Validate and sanitize a title
   */
  validateTitle(title: string): string {
    // Remove special characters, keep only letters, numbers, spaces
    let cleaned = title.replace(/[^\w\s]/g, '');

    // Limit to 100 characters
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100);
    }

    // Ensure title case
    cleaned = cleaned
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return cleaned.trim() || 'New Conversation';
  }
}

// Singleton instance
export const conversationTitleGenerator = new ConversationTitleGenerator();
