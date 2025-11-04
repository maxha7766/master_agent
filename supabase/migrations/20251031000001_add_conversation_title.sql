-- Add title column to conversations table
-- This stores AI-generated conversation titles for sidebar display

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS title VARCHAR(100);

-- Create index for efficient querying of user conversations sorted by most recent
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
ON conversations(user_id, updated_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN conversations.title IS 'AI-generated 2-4 word title for conversation sidebar display';
