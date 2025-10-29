-- ============================================
-- RAG Search Functions
-- Migration: 002_add_search_functions
-- Created: 2025-10-28
-- ============================================

-- ============================================
-- Hybrid Search Function
-- Combines vector similarity with keyword search
-- ============================================

CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding TEXT,
  query_text TEXT,
  match_user_id UUID,
  match_count INTEGER DEFAULT 5,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3
) RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity_score FLOAT,
  relevance_score FLOAT
) AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  -- Parse the JSON string to vector
  query_vec := query_embedding::vector(1536);

  RETURN QUERY
  WITH vector_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      '{}'::jsonb as metadata,
      1 - (c.embedding <=> query_vec) AS similarity
    FROM chunks c
    WHERE c.user_id = match_user_id
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_vec
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      '{}'::jsonb as metadata,
      ts_rank(c.content_tsv, plainto_tsquery('english', query_text)) AS rank
    FROM chunks c
    WHERE c.user_id = match_user_id
      AND c.content_tsv @@ plainto_tsquery('english', query_text)
    ORDER BY rank DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.metadata, k.metadata) AS metadata,
      COALESCE(v.similarity, 0) AS vector_score,
      COALESCE(k.rank, 0) AS keyword_score
    FROM vector_search v
    FULL OUTER JOIN keyword_search k ON v.id = k.id
  )
  SELECT
    c.id::UUID AS chunk_id,
    c.document_id::UUID,
    c.content::TEXT,
    c.metadata::JSONB,
    c.vector_score::FLOAT AS similarity_score,
    (c.vector_score * vector_weight + c.keyword_score * keyword_weight)::FLOAT AS relevance_score
  FROM combined c
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Document-Specific Search Function
-- Search within a specific document
-- ============================================

CREATE OR REPLACE FUNCTION search_document(
  query_embedding TEXT,
  target_document_id UUID,
  target_user_id UUID,
  match_count INTEGER DEFAULT 5
) RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity_score FLOAT,
  relevance_score FLOAT
) AS $$
DECLARE
  query_vec vector(1536);
BEGIN
  -- Parse the JSON string to vector
  query_vec := query_embedding::vector(1536);

  RETURN QUERY
  SELECT
    c.id::UUID AS chunk_id,
    c.document_id::UUID,
    c.content::TEXT,
    '{}'::jsonb AS metadata,
    (1 - (c.embedding <=> query_vec))::FLOAT AS similarity_score,
    (1 - (c.embedding <=> query_vec))::FLOAT AS relevance_score
  FROM chunks c
  WHERE c.document_id = target_document_id
    AND c.user_id = target_user_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_vec
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION search_document TO authenticated;
