/**
 * Entity Extraction Service
 * Extracts entities and relationships from conversation text using LLM
 */

import Anthropic from '@anthropic-ai/sdk';
import { log } from '../../lib/logger.js';
import type { EntityType, MemoryExtraction } from './types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ENTITY_EXTRACTION_PROMPT = `You are an expert at extracting entities and relationships from conversations.

Analyze the conversation and extract:
1. **Entities**: People, places, organizations, products, concepts, events mentioned
2. **Relationships**: How entities relate to each other
3. **Memories**: Facts, preferences, insights, and events about the user

Guidelines:
- Only extract concrete, specific information
- Don't infer or assume information not explicitly stated
- For entities, include attributes like roles, locations, characteristics
- For relationships, describe how entities connect
- Rate confidence (0.0-1.0) based on how explicitly stated the information is
- Rate importance (0.0-1.0) based on relevance to understanding the user

Return your analysis as JSON with this structure:
{
  "entities": [
    {
      "type": "person" | "place" | "organization" | "product" | "concept" | "event",
      "name": "Entity name",
      "description": "Brief description",
      "attributes": { "key": "value" }
    }
  ],
  "relationships": [
    {
      "source": "Entity name",
      "target": "Entity name",
      "type": "relationship_type",
      "context": "Description of relationship"
    }
  ],
  "memories": [
    {
      "type": "fact" | "preference" | "insight" | "event",
      "content": "Memory content as natural sentence",
      "confidence": 0.0-1.0,
      "importance": 0.0-1.0,
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

/**
 * Extract entities, relationships, and memories from conversation text
 */
export async function extractFromConversation(
  conversationText: string,
  userId: string
): Promise<MemoryExtraction> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${ENTITY_EXTRACTION_PROMPT}\n\nConversation:\n${conversationText}\n\nPlease analyze this conversation and extract entities, relationships, and memories as JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const extraction: MemoryExtraction = JSON.parse(jsonText);

    log.info('Extracted from conversation', {
      userId,
      entityCount: extraction.entities?.length || 0,
      relationshipCount: extraction.relationships?.length || 0,
      memoryCount: extraction.memories?.length || 0,
    });

    return extraction;
  } catch (error) {
    log.error('Failed to extract from conversation', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    // Return empty extraction on error
    return {
      entities: [],
      relationships: [],
      memories: [],
    };
  }
}

/**
 * Extract entities from a single message
 * Useful for real-time extraction as user chats
 */
export async function extractFromMessage(
  messageText: string,
  userId: string,
  conversationContext?: string
): Promise<MemoryExtraction> {
  try {
    const contextPrompt = conversationContext
      ? `\n\nRecent conversation context:\n${conversationContext}`
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `${ENTITY_EXTRACTION_PROMPT}${contextPrompt}\n\nUser message:\n"${messageText}"\n\nPlease analyze this message and extract any entities, relationships, and memories as JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const extraction: MemoryExtraction = JSON.parse(jsonText);

    log.debug('Extracted from message', {
      userId,
      entityCount: extraction.entities?.length || 0,
      relationshipCount: extraction.relationships?.length || 0,
      memoryCount: extraction.memories?.length || 0,
    });

    return extraction;
  } catch (error) {
    log.error('Failed to extract from message', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return {
      entities: [],
      relationships: [],
      memories: [],
    };
  }
}

/**
 * Determine entity type from description
 */
export function inferEntityType(name: string, description: string): EntityType {
  const text = `${name} ${description}`.toLowerCase();

  // Person indicators
  if (
    text.match(/\b(he|she|person|colleague|friend|family|manager|ceo|director|employee)\b/)
  ) {
    return 'person';
  }

  // Organization indicators
  if (
    text.match(/\b(company|corporation|organization|startup|business|firm|agency|department)\b/)
  ) {
    return 'organization';
  }

  // Place indicators
  if (
    text.match(/\b(city|country|office|building|restaurant|location|place|address|street)\b/)
  ) {
    return 'place';
  }

  // Product indicators
  if (text.match(/\b(product|software|app|tool|service|platform|system|device)\b/)) {
    return 'product';
  }

  // Event indicators
  if (text.match(/\b(meeting|conference|event|workshop|presentation|launch|release)\b/)) {
    return 'event';
  }

  // Default to concept
  return 'concept';
}
