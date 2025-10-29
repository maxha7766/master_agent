-- Add content_hash column to documents table for deduplication
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Create unique index on user_id + content_hash to prevent duplicate content per user
CREATE UNIQUE INDEX IF NOT EXISTS documents_user_content_hash_idx
  ON public.documents(user_id, content_hash)
  WHERE content_hash IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS documents_content_hash_idx
  ON public.documents(content_hash)
  WHERE content_hash IS NOT NULL;
