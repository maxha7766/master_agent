-- Add title column to documents table
-- This stores the AI-extracted document title (different from filename)

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- Set default title to filename for existing documents
UPDATE documents
SET title = file_name
WHERE title IS NULL;
