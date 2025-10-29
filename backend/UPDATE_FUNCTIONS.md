# UPDATE REQUIRED: Fix Vector Search Function

## Problem Found
The `match_documents` function was only returning 3 results when it should return 20+.

**Root cause**:
1. Using `>` instead of `>=` in the WHERE clause
2. Wrong ORDER BY (was sorting by computed similarity DESC, should sort by distance ASC for efficiency)

## Solution
Run this SQL in Supabase SQL Editor:

```sql
-- 1. Vector search function (cosine similarity) - FIXED VERSION
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

-- 2. Full-text search function - FIXED VERSION
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
```

## What Changed:
1. Line 38: `>` → `>=` (include results equal to threshold)
2. Line 39: `ORDER BY similarity DESC` → `ORDER BY c.embedding <=> query_embedding ASC` (more efficient, pgvector can use index)
3. Line 79: `>` → `>=` (same fix for fulltext)

## After Running SQL:
Test with:
```bash
node test-search-simple.mjs
```

Expected: Should see 20 results, multiple containing "balk"
