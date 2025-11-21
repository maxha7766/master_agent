/**
 * Memory System Types
 * Type definitions for the advanced memory management system
 */

export type MemoryType = 'fact' | 'preference' | 'insight' | 'event';
export type EntityType = 'person' | 'place' | 'organization' | 'product' | 'concept' | 'event';

/**
 * User Memory
 * Represents a semantic memory stored with embeddings
 */
export interface UserMemory {
  id: string;
  user_id: string;
  memory_type: MemoryType;
  content: string;
  embedding: number[] | null;
  source_conversation_id: string | null;
  source_message_ids: string[];
  confidence_score: number;
  importance_score: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  access_count: number;
}

/**
 * Memory Insert
 * Data required to create a new memory
 */
export interface MemoryInsert {
  user_id: string;
  memory_type: MemoryType;
  content: string;
  embedding?: number[];
  source_conversation_id?: string;
  source_message_ids?: string[];
  confidence_score?: number;
  importance_score?: number;
  tags?: string[];
}

/**
 * Memory Update
 * Fields that can be updated on existing memories
 */
export interface MemoryUpdate {
  content?: string;
  embedding?: number[];
  confidence_score?: number;
  importance_score?: number;
  tags?: string[];
  is_active?: boolean;
}

/**
 * Entity
 * Represents a person, place, organization, etc.
 */
export interface Entity {
  id: string;
  user_id: string;
  entity_type: EntityType;
  name: string;
  description: string | null;
  embedding: number[] | null;
  attributes: Record<string, any>;
  first_mentioned_at: string;
  last_mentioned_at: string;
  mention_count: number;
  importance_score: number;
  created_at: string;
  updated_at: string;
}

/**
 * Entity Insert
 */
export interface EntityInsert {
  user_id: string;
  entity_type: EntityType;
  name: string;
  description?: string;
  embedding?: number[];
  attributes?: Record<string, any>;
  importance_score?: number;
}

/**
 * Entity Relationship
 */
export interface EntityRelationship {
  id: string;
  user_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  strength: number;
  context: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Relationship Insert
 */
export interface RelationshipInsert {
  user_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  strength?: number;
  context?: string;
}

/**
 * Conversation Summary
 */
export interface ConversationSummary {
  id: string;
  conversation_id: string;
  user_id: string;
  summary: string;
  key_points: string[];
  entities_mentioned: string[];
  message_range_start: string | null;
  message_range_end: string | null;
  created_at: string;
}

/**
 * Summary Insert
 */
export interface SummaryInsert {
  conversation_id: string;
  user_id: string;
  summary: string;
  key_points?: string[];
  entities_mentioned?: string[];
  message_range_start?: string;
  message_range_end?: string;
}

/**
 * Memory Search Result
 * Memory with similarity score from vector search
 */
export interface MemorySearchResult extends UserMemory {
  similarity: number;
}

/**
 * Entity Search Result
 */
export interface EntitySearchResult extends Entity {
  similarity: number;
}

/**
 * Memory Extraction Result
 * Output from LLM memory extraction
 */
export interface MemoryExtraction {
  memories: Array<{
    type: MemoryType;
    content: string;
    confidence: number;
    importance: number;
    tags: string[];
  }>;
  entities: Array<{
    type: EntityType;
    name: string;
    description: string;
    attributes: Record<string, any>;
  }>;
  relationships: Array<{
    source: string; // Entity name
    target: string; // Entity name
    type: string;
    context: string;
  }>;
}

/**
 * Memory Retrieval Options
 */
export interface MemoryRetrievalOptions {
  topK?: number;
  minSimilarity?: number;
  memoryTypes?: MemoryType[];
  tags?: string[];
  includeInactive?: boolean;
}

/**
 * Entity Retrieval Options
 */
export interface EntityRetrievalOptions {
  topK?: number;
  minSimilarity?: number;
  entityTypes?: EntityType[];
  minImportance?: number;
}
