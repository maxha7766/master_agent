-- Add image-related fields to messages table
-- This allows messages to include generated images

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- Create index for querying messages with images
CREATE INDEX IF NOT EXISTS idx_messages_image_url ON messages(image_url) WHERE image_url IS NOT NULL;

COMMENT ON COLUMN messages.image_url IS 'URL of generated image attached to this message';
COMMENT ON COLUMN messages.image_metadata IS 'Metadata about the generated image (operation type, model, dimensions, etc.)';
