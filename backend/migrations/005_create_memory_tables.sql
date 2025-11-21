-- Migration: Create Memory System Tables
-- Description: Adds tables for semantic memory, entities, relationships, and conversation summaries
-- Created: 2025-11-19

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. USER MEMORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Memory content
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'insight', 'event')),
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-large

    -- Source tracking
    source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    source_message_ids UUID[] DEFAULT '{}',

    -- Scoring
    confidence_score FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    importance_score FLOAT NOT NULL DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,

    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0
);

-- Indexes for user_memories
CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX idx_user_memories_active ON user_memories(is_active);
CREATE INDEX idx_user_memories_importance ON user_memories(importance_score DESC);
CREATE INDEX idx_user_memories_created ON user_memories(created_at DESC);

-- Vector index for semantic search (HNSW is faster than IVFFlat for most cases)
CREATE INDEX idx_user_memories_embedding ON user_memories
USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- 2. ENTITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Entity information
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'place', 'organization', 'product', 'concept', 'event')),
    name TEXT NOT NULL,
    description TEXT,
    embedding vector(1536),

    -- Flexible attributes (JSON for custom key-value pairs)
    attributes JSONB DEFAULT '{}',

    -- Tracking
    first_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
    last_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
    mention_count INTEGER DEFAULT 1,
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate entities
    UNIQUE(user_id, entity_type, name)
);

-- Indexes for entities
CREATE INDEX idx_entities_user_id ON entities(user_id);
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_importance ON entities(importance_score DESC);
CREATE INDEX idx_entities_name ON entities(name);

-- Vector index for entity similarity search
CREATE INDEX idx_entities_embedding ON entities
USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- 3. ENTITY RELATIONSHIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Relationship
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- e.g., "works_at", "lives_in", "knows"

    -- Strength and context
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    context TEXT, -- Description of the relationship

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate relationships
    UNIQUE(user_id, source_entity_id, target_entity_id, relationship_type)
);

-- Indexes for entity_relationships
CREATE INDEX idx_entity_rel_user_id ON entity_relationships(user_id);
CREATE INDEX idx_entity_rel_source ON entity_relationships(source_entity_id);
CREATE INDEX idx_entity_rel_target ON entity_relationships(target_entity_id);
CREATE INDEX idx_entity_rel_type ON entity_relationships(relationship_type);

-- ============================================
-- 4. CONVERSATION SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Summary content
    summary TEXT NOT NULL,
    key_points TEXT[] DEFAULT '{}',
    entities_mentioned UUID[] DEFAULT '{}', -- References to entities table

    -- Message range covered by this summary
    message_range_start UUID, -- References messages(id)
    message_range_end UUID,   -- References messages(id)

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One summary per conversation
    UNIQUE(conversation_id)
);

-- Indexes for conversation_summaries
CREATE INDEX idx_conv_summaries_user_id ON conversation_summaries(user_id);
CREATE INDEX idx_conv_summaries_conv_id ON conversation_summaries(conversation_id);

-- ============================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================

-- Update updated_at timestamp for user_memories
CREATE OR REPLACE FUNCTION update_user_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memories_updated_at
BEFORE UPDATE ON user_memories
FOR EACH ROW
EXECUTE FUNCTION update_user_memories_updated_at();

-- Update updated_at timestamp for entities
CREATE OR REPLACE FUNCTION update_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW
EXECUTE FUNCTION update_entities_updated_at();

-- Update updated_at timestamp for entity_relationships
CREATE OR REPLACE FUNCTION update_entity_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entity_relationships_updated_at
BEFORE UPDATE ON entity_relationships
FOR EACH ROW
EXECUTE FUNCTION update_entity_relationships_updated_at();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Policies for user_memories
CREATE POLICY "Users can view their own memories"
ON user_memories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
ON user_memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
ON user_memories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
ON user_memories FOR DELETE
USING (auth.uid() = user_id);

-- Policies for entities
CREATE POLICY "Users can view their own entities"
ON entities FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entities"
ON entities FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entities"
ON entities FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entities"
ON entities FOR DELETE
USING (auth.uid() = user_id);

-- Policies for entity_relationships
CREATE POLICY "Users can view their own relationships"
ON entity_relationships FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own relationships"
ON entity_relationships FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own relationships"
ON entity_relationships FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own relationships"
ON entity_relationships FOR DELETE
USING (auth.uid() = user_id);

-- Policies for conversation_summaries
CREATE POLICY "Users can view their own summaries"
ON conversation_summaries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own summaries"
ON conversation_summaries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own summaries"
ON conversation_summaries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own summaries"
ON conversation_summaries FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
