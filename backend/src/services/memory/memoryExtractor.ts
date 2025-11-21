/**
 * Memory Extraction Service
 * Orchestrates extraction of memories, entities, and relationships from conversations
 */

import { log } from '../../lib/logger.js';
import { extractFromConversation, extractFromMessage } from './entityExtractor.js';
import { storeMemoriesBatch } from './memoryManager.js';
import { upsertEntitiesBatch, upsertRelationship, findEntityByName } from './entityManager.js';
import type { MemoryInsert, EntityInsert, RelationshipInsert } from './types.js';

/**
 * Process conversation and extract all memories, entities, and relationships
 */
export async function processConversation(
  conversationId: string,
  userId: string,
  conversationText: string,
  messageIds: string[] = []
): Promise<{
  memoriesCreated: number;
  entitiesCreated: number;
  relationshipsCreated: number;
}> {
  try {
    // Extract using LLM
    const extraction = await extractFromConversation(conversationText, userId);

    // Store memories
    const memories: MemoryInsert[] = extraction.memories.map((mem) => ({
      user_id: userId,
      memory_type: mem.type,
      content: mem.content,
      source_conversation_id: conversationId,
      source_message_ids: messageIds,
      confidence_score: mem.confidence,
      importance_score: mem.importance,
      tags: mem.tags,
    }));

    const storedMemories = await storeMemoriesBatch(memories);

    // Store entities
    const entities: EntityInsert[] = extraction.entities.map((ent) => ({
      user_id: userId,
      entity_type: ent.type,
      name: ent.name,
      description: ent.description,
      attributes: ent.attributes,
    }));

    const storedEntities = await upsertEntitiesBatch(entities);

    // Store relationships
    let relationshipCount = 0;
    for (const rel of extraction.relationships) {
      // Find source and target entities
      const sourceEntity = await findEntityByName(rel.source, userId);
      const targetEntity = await findEntityByName(rel.target, userId);

      if (sourceEntity && targetEntity) {
        const relationship: RelationshipInsert = {
          user_id: userId,
          source_entity_id: sourceEntity.id,
          target_entity_id: targetEntity.id,
          relationship_type: rel.type,
          context: rel.context,
        };

        const stored = await upsertRelationship(relationship);
        if (stored) {
          relationshipCount++;
        }
      }
    }

    log.info('Conversation processed', {
      conversationId,
      userId,
      memoriesCreated: storedMemories.length,
      entitiesCreated: storedEntities.length,
      relationshipsCreated: relationshipCount,
    });

    return {
      memoriesCreated: storedMemories.length,
      entitiesCreated: storedEntities.length,
      relationshipsCreated: relationshipCount,
    };
  } catch (error) {
    log.error('Error processing conversation', {
      error: error instanceof Error ? error.message : String(error),
      conversationId,
      userId,
    });
    return {
      memoriesCreated: 0,
      entitiesCreated: 0,
      relationshipsCreated: 0,
    };
  }
}

/**
 * Process a single message and extract memories/entities
 * More lightweight than full conversation processing
 */
export async function processMessage(
  messageId: string,
  conversationId: string,
  userId: string,
  messageText: string,
  conversationContext?: string
): Promise<{
  memoriesCreated: number;
  entitiesCreated: number;
  relationshipsCreated: number;
}> {
  try {
    // Extract using LLM
    const extraction = await extractFromMessage(messageText, userId, conversationContext);

    // Store memories
    const memories: MemoryInsert[] = extraction.memories.map((mem) => ({
      user_id: userId,
      memory_type: mem.type,
      content: mem.content,
      source_conversation_id: conversationId,
      source_message_ids: [messageId],
      confidence_score: mem.confidence,
      importance_score: mem.importance,
      tags: mem.tags,
    }));

    const storedMemories = await storeMemoriesBatch(memories);

    // Store entities
    const entities: EntityInsert[] = extraction.entities.map((ent) => ({
      user_id: userId,
      entity_type: ent.type,
      name: ent.name,
      description: ent.description,
      attributes: ent.attributes,
    }));

    const storedEntities = await upsertEntitiesBatch(entities);

    // Store relationships
    let relationshipCount = 0;
    for (const rel of extraction.relationships) {
      const sourceEntity = await findEntityByName(rel.source, userId);
      const targetEntity = await findEntityByName(rel.target, userId);

      if (sourceEntity && targetEntity) {
        const relationship: RelationshipInsert = {
          user_id: userId,
          source_entity_id: sourceEntity.id,
          target_entity_id: targetEntity.id,
          relationship_type: rel.type,
          context: rel.context,
        };

        const stored = await upsertRelationship(relationship);
        if (stored) {
          relationshipCount++;
        }
      }
    }

    log.debug('Message processed', {
      messageId,
      userId,
      memoriesCreated: storedMemories.length,
      entitiesCreated: storedEntities.length,
      relationshipsCreated: relationshipCount,
    });

    return {
      memoriesCreated: storedMemories.length,
      entitiesCreated: storedEntities.length,
      relationshipsCreated: relationshipCount,
    };
  } catch (error) {
    log.error('Error processing message', {
      error: error instanceof Error ? error.message : String(error),
      messageId,
      userId,
    });
    return {
      memoriesCreated: 0,
      entitiesCreated: 0,
      relationshipsCreated: 0,
    };
  }
}

/**
 * Batch process multiple messages at once
 */
export async function processBatchMessages(
  messages: Array<{
    messageId: string;
    conversationId: string;
    userId: string;
    messageText: string;
  }>
): Promise<{
  totalMemories: number;
  totalEntities: number;
  totalRelationships: number;
}> {
  let totalMemories = 0;
  let totalEntities = 0;
  let totalRelationships = 0;

  for (const msg of messages) {
    const result = await processMessage(
      msg.messageId,
      msg.conversationId,
      msg.userId,
      msg.messageText
    );

    totalMemories += result.memoriesCreated;
    totalEntities += result.entitiesCreated;
    totalRelationships += result.relationshipsCreated;
  }

  log.info('Batch messages processed', {
    messageCount: messages.length,
    totalMemories,
    totalEntities,
    totalRelationships,
  });

  return {
    totalMemories,
    totalEntities,
    totalRelationships,
  };
}

/**
 * Should we extract from this message?
 * Skip very short messages or bot responses
 */
export function shouldExtractFromMessage(messageText: string, role: 'user' | 'assistant'): boolean {
  // Only extract from user messages
  if (role !== 'user') {
    return false;
  }

  // Skip very short messages
  if (messageText.trim().length < 20) {
    return false;
  }

  // Skip common short responses
  const lowercaseText = messageText.toLowerCase().trim();
  const skipPatterns = [
    /^(ok|okay|yes|no|thanks|thank you|sure|maybe|idk|lol|haha)$/,
    /^(got it|sounds good|alright|cool|nice)$/,
  ];

  if (skipPatterns.some((pattern) => pattern.test(lowercaseText))) {
    return false;
  }

  return true;
}
