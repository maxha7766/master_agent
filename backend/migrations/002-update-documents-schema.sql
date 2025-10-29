-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for full-text search (BM25-like)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add missing columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;

-- Ensure documents has all required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'documents' AND column_name = 'file_size') THEN
    ALTER TABLE public.documents ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'documents' AND column_name = 'file_type') THEN
    ALTER TABLE public.documents ADD COLUMN file_type TEXT NOT NULL DEFAULT 'application/octet-stream';
  END IF;
END $$;

-- Add missing columns to chunks table
ALTER TABLE public.chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536), -- OpenAI text-embedding-3-large dimensions
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS position INTEGER;

-- Update any existing chunks without position
UPDATE public.chunks SET position = 0 WHERE position IS NULL;

-- Make position NOT NULL after setting defaults
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'chunks' AND column_name = 'position' AND is_nullable = 'YES') THEN
    ALTER TABLE public.chunks ALTER COLUMN position SET NOT NULL;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents(created_at DESC);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON public.chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_user_id_idx ON public.chunks(user_id);

-- Vector similarity search index (IVFFlat for better performance)
-- Drop and recreate in case it exists with wrong configuration
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX chunks_embedding_idx ON public.chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index using GIN with pg_trgm
CREATE INDEX IF NOT EXISTS chunks_content_trgm_idx ON public.chunks
  USING gin (content gin_trgm_ops);

-- Update RLS policies if needed
-- Documents policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can read own documents'
  ) THEN
    CREATE POLICY "Users can read own documents" ON public.documents
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can insert own documents'
  ) THEN
    CREATE POLICY "Users can insert own documents" ON public.documents
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can update own documents'
  ) THEN
    CREATE POLICY "Users can update own documents" ON public.documents
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Users can delete own documents'
  ) THEN
    CREATE POLICY "Users can delete own documents" ON public.documents
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Chunks policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chunks' AND policyname = 'Users can read own chunks'
  ) THEN
    CREATE POLICY "Users can read own chunks" ON public.chunks
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chunks' AND policyname = 'Users can insert own chunks'
  ) THEN
    CREATE POLICY "Users can insert own chunks" ON public.chunks
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chunks' AND policyname = 'Users can delete own chunks'
  ) THEN
    CREATE POLICY "Users can delete own chunks" ON public.chunks
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at (drop first if exists)
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Hybrid search function combining vector similarity and keyword search
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text TEXT,
  match_user_id UUID,
  match_count INTEGER DEFAULT 5,
  vector_weight FLOAT DEFAULT 0.7,
  keyword_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity_score FLOAT,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      1 - (c.embedding <=> query_embedding) as cosine_similarity
    FROM chunks c
    WHERE c.user_id = match_user_id AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      similarity(c.content, query_text) as keyword_similarity
    FROM chunks c
    WHERE
      c.user_id = match_user_id
      AND c.content % query_text
    ORDER BY similarity(c.content, query_text) DESC
    LIMIT match_count * 2
  )
  SELECT
    COALESCE(v.id, k.id) as chunk_id,
    COALESCE(v.document_id, k.document_id) as document_id,
    COALESCE(v.content, k.content) as content,
    COALESCE(v.metadata, k.metadata) as metadata,
    COALESCE(v.cosine_similarity, 0) as similarity_score,
    (COALESCE(v.cosine_similarity, 0) * vector_weight + COALESCE(k.keyword_similarity, 0) * keyword_weight) as relevance_score
  FROM vector_search v
  FULL OUTER JOIN keyword_search k ON v.id = k.id
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
