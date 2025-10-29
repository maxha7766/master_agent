-- Step 1: Drop ALL existing hybrid_search functions to start fresh
DROP FUNCTION IF EXISTS public.hybrid_search CASCADE;

-- Step 2: Create the correct hybrid_search function using RRF (Reciprocal Rank Fusion)
-- Based on official Supabase documentation
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  full_text_weight FLOAT DEFAULT 1,
  semantic_weight FLOAT DEFAULT 1,
  rrf_k INT DEFAULT 50
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity_score FLOAT,
  relevance_score FLOAT
)
LANGUAGE SQL
AS $$
  WITH full_text AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      c.embedding,
      ROW_NUMBER() OVER(ORDER BY ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
    FROM chunks c
    WHERE
      c.user_id = match_user_id
      AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', query_text)
    ORDER BY rank_ix
    LIMIT LEAST(match_count, 30) * 2
  ),
  semantic AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      c.embedding,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank_ix
    FROM chunks c
    WHERE
      c.user_id = match_user_id
      AND c.embedding IS NOT NULL
    ORDER BY rank_ix
    LIMIT LEAST(match_count, 30) * 2
  )
  SELECT
    COALESCE(full_text.id, semantic.id) AS chunk_id,
    COALESCE(full_text.document_id, semantic.document_id) AS document_id,
    COALESCE(full_text.content, semantic.content) AS content,
    COALESCE(full_text.metadata, semantic.metadata) AS metadata,
    COALESCE(1 - (semantic.embedding <=> query_embedding), 0)::FLOAT AS similarity_score,
    (
      COALESCE(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
      COALESCE(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
    )::FLOAT AS relevance_score
  FROM full_text
  FULL OUTER JOIN semantic ON full_text.id = semantic.id
  ORDER BY relevance_score DESC
  LIMIT LEAST(match_count, 30);
$$;
