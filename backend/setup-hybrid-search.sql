-- Master Agent Hybrid Search Setup
-- Following master-rag pattern: separate vector and fulltext functions
-- Combined in TypeScript using RRF (Reciprocal Rank Fusion)

-- Drop any existing conflicting functions
DROP FUNCTION IF EXISTS public.hybrid_search CASCADE;

-- 1. Vector search function (cosine similarity)
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    target_user_id uuid
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    chunk_index int,
    page_number int,
    metadata jsonb,
    similarity float
)
LANGUAGE SQL STABLE
AS $$
SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.page_number,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
FROM chunks c
WHERE
    c.user_id = target_user_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
ORDER BY c.embedding <=> query_embedding ASC
LIMIT match_count;
$$;

-- 2. Full-text search function (PostgreSQL tsquery)
CREATE OR REPLACE FUNCTION search_documents_fulltext(
    search_query text,
    match_threshold float,
    match_count int,
    target_user_id uuid
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    chunk_index int,
    page_number int,
    metadata jsonb,
    rank float
)
LANGUAGE SQL STABLE
AS $$
SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.page_number,
    c.metadata,
    ts_rank_cd(
        to_tsvector('english', c.content),
        websearch_to_tsquery('english', search_query)
    ) as rank
FROM chunks c
WHERE
    c.user_id = target_user_id
    AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', search_query)
    AND ts_rank_cd(
        to_tsvector('english', c.content),
        websearch_to_tsquery('english', search_query)
    ) >= match_threshold
ORDER BY rank DESC
LIMIT match_count;
$$;

-- 3. Helper function for SQL execution (for testing/setup)
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE query;
    RETURN 'Success';
EXCEPTION
    WHEN OTHERS THEN
        RETURN SQLERRM;
END;
$$;

-- Verify functions were created
SELECT
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('match_documents', 'search_documents_fulltext', 'exec_sql')
ORDER BY routine_name;
