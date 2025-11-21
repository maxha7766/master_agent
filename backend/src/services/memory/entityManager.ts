/**
 * Entity Manager
 * Manages entities (people, places, organizations, etc.) and their relationships
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { generateEmbedding, generateEmbeddingsBatch } from './embeddingService.js';
import type {
  Entity,
  EntityInsert,
  EntityType,
  EntitySearchResult,
  EntityRetrievalOptions,
  EntityRelationship,
  RelationshipInsert,
} from './types.js';

/**
 * Store or update an entity
 * If entity exists, updates it; otherwise creates new
 */
export async function upsertEntity(entity: EntityInsert): Promise<Entity | null> {
  try {
    // Generate embedding for entity name + description
    const embeddingText = entity.description
      ? `${entity.name}: ${entity.description}`
      : entity.name;
    const embedding = entity.embedding || (await generateEmbedding(embeddingText));

    // Check if entity already exists
    const { data: existing } = await supabase
      .from('entities')
      .select('*')
      .eq('user_id', entity.user_id)
      .eq('name', entity.name)
      .eq('entity_type', entity.entity_type)
      .single();

    if (existing) {
      // Update existing entity
      const { data, error } = await supabase
        .from('entities')
        .update({
          description: entity.description || existing.description,
          embedding,
          attributes: { ...existing.attributes, ...entity.attributes },
          last_mentioned_at: new Date().toISOString(),
          mention_count: existing.mention_count + 1,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        log.error('Failed to update entity', { error, entityId: existing.id });
        return null;
      }

      log.info('Entity updated', { entityId: data.id, name: data.name });
      return data;
    } else {
      // Create new entity
      const { data, error } = await supabase
        .from('entities')
        .insert({
          user_id: entity.user_id,
          entity_type: entity.entity_type,
          name: entity.name,
          description: entity.description || null,
          embedding,
          attributes: entity.attributes || {},
          importance_score: entity.importance_score || 0.5,
        })
        .select()
        .single();

      if (error) {
        log.error('Failed to create entity', { error, entity });
        return null;
      }

      log.info('Entity created', { entityId: data.id, name: data.name, type: data.entity_type });
      return data;
    }
  } catch (error) {
    log.error('Error upserting entity', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Store multiple entities in batch
 */
export async function upsertEntitiesBatch(entities: EntityInsert[]): Promise<Entity[]> {
  if (entities.length === 0) {
    return [];
  }

  try {
    const results: Entity[] = [];

    // Process entities one by one (upsert logic requires individual handling)
    for (const entity of entities) {
      const result = await upsertEntity(entity);
      if (result) {
        results.push(result);
      }
    }

    log.info('Entities upserted in batch', {
      count: results.length,
      userId: entities[0]?.user_id,
    });

    return results;
  } catch (error) {
    log.error('Error upserting entities batch', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Find entity by name (case-insensitive)
 */
export async function findEntityByName(
  name: string,
  userId: string,
  entityType?: EntityType
): Promise<Entity | null> {
  try {
    let query = supabase
      .from('entities')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', name);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Retrieve entities using semantic search
 */
export async function retrieveRelevantEntities(
  query: string,
  userId: string,
  options: EntityRetrievalOptions = {}
): Promise<EntitySearchResult[]> {
  const { topK = 5, minSimilarity = 0.7, entityTypes, minImportance = 0 } = options;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Build the query
    let query_builder = supabase.from('entities').select('*').eq('user_id', userId);

    // Add filters
    if (entityTypes && entityTypes.length > 0) {
      query_builder = query_builder.in('entity_type', entityTypes);
    }

    if (minImportance > 0) {
      query_builder = query_builder.gte('importance_score', minImportance);
    }

    const { data: entities, error } = await query_builder;

    if (error || !entities) {
      log.error('Failed to retrieve entities', { error, userId });
      return [];
    }

    // Calculate similarity scores
    const entitiesWithScores: EntitySearchResult[] = entities
      .map((entity) => {
        if (!entity.embedding) {
          return null;
        }

        // Calculate cosine similarity
        const similarity = cosineSimilarity(queryEmbedding, entity.embedding);

        return {
          ...entity,
          similarity,
        };
      })
      .filter((e): e is EntitySearchResult => e !== null && e.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    log.info('Entities retrieved', {
      userId,
      query: query.substring(0, 50),
      resultsCount: entitiesWithScores.length,
    });

    return entitiesWithScores;
  } catch (error) {
    log.error('Error retrieving entities', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return [];
  }
}

/**
 * Helper function to calculate cosine similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Get all entities for a user
 */
export async function getAllEntities(userId: string, entityType?: EntityType): Promise<Entity[]> {
  try {
    let query = supabase
      .from('entities')
      .select('*')
      .eq('user_id', userId)
      .order('mention_count', { ascending: false });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error } = await query;

    if (error || !data) {
      log.error('Failed to get all entities', { error, userId });
      return [];
    }

    return data;
  } catch (error) {
    log.error('Error getting all entities', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Increment entity mention count
 */
export async function trackEntityMentions(entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) {
    return;
  }

  try {
    await supabase.rpc('increment_entity_mentions', {
      entity_ids: entityIds,
    });

    log.debug('Entity mentions tracked', { count: entityIds.length });
  } catch (error) {
    log.error('Failed to track entity mentions', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create or update a relationship between entities
 */
export async function upsertRelationship(
  relationship: RelationshipInsert
): Promise<EntityRelationship | null> {
  try {
    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('entity_relationships')
      .select('*')
      .eq('user_id', relationship.user_id)
      .eq('source_entity_id', relationship.source_entity_id)
      .eq('target_entity_id', relationship.target_entity_id)
      .eq('relationship_type', relationship.relationship_type)
      .single();

    if (existing) {
      // Update existing relationship
      const { data, error } = await supabase
        .from('entity_relationships')
        .update({
          strength: relationship.strength || existing.strength,
          context: relationship.context || existing.context,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        log.error('Failed to update relationship', { error, relationshipId: existing.id });
        return null;
      }

      log.info('Relationship updated', { relationshipId: data.id });
      return data;
    } else {
      // Create new relationship
      const { data, error } = await supabase
        .from('entity_relationships')
        .insert({
          user_id: relationship.user_id,
          source_entity_id: relationship.source_entity_id,
          target_entity_id: relationship.target_entity_id,
          relationship_type: relationship.relationship_type,
          strength: relationship.strength || 0.5,
          context: relationship.context || null,
        })
        .select()
        .single();

      if (error) {
        log.error('Failed to create relationship', { error, relationship });
        return null;
      }

      log.info('Relationship created', {
        relationshipId: data.id,
        type: data.relationship_type,
      });
      return data;
    }
  } catch (error) {
    log.error('Error upserting relationship', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get all relationships for an entity
 */
export async function getEntityRelationships(entityId: string): Promise<EntityRelationship[]> {
  try {
    const { data, error } = await supabase
      .from('entity_relationships')
      .select('*')
      .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
      .order('strength', { ascending: false });

    if (error || !data) {
      log.error('Failed to get entity relationships', { error, entityId });
      return [];
    }

    return data;
  } catch (error) {
    log.error('Error getting entity relationships', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get entity with its related entities
 */
export async function getEntityWithRelations(
  entityId: string
): Promise<{ entity: Entity; relationships: EntityRelationship[]; relatedEntities: Entity[] } | null> {
  try {
    // Get the entity
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', entityId)
      .single();

    if (entityError || !entity) {
      return null;
    }

    // Get relationships
    const relationships = await getEntityRelationships(entityId);

    // Get related entity IDs
    const relatedEntityIds = relationships.map((rel) =>
      rel.source_entity_id === entityId ? rel.target_entity_id : rel.source_entity_id
    );

    // Get related entities
    const { data: relatedEntities } = await supabase
      .from('entities')
      .select('*')
      .in('id', relatedEntityIds);

    return {
      entity,
      relationships,
      relatedEntities: relatedEntities || [],
    };
  } catch (error) {
    log.error('Error getting entity with relations', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
