-- Create images table for storing generated and edited images
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Prompts
  prompt TEXT NOT NULL,
  negative_prompt TEXT,

  -- Images
  source_image_url TEXT, -- For image-to-image operations
  generated_image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,

  -- Generation metadata
  model VARCHAR(100) NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- text-to-image, image-to-image, inpaint, outpaint, variation, upscale

  -- Parameters used
  parameters JSONB NOT NULL DEFAULT '{}',

  -- Cost tracking
  cost_usd DECIMAL(10, 6),

  -- Image dimensions
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_conversation_id ON images(conversation_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_operation_type ON images(operation_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER images_updated_at
  BEFORE UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_images_updated_at();

-- Enable Row Level Security
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own images
CREATE POLICY "Users can view their own images"
  ON images FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own images
CREATE POLICY "Users can insert their own images"
  ON images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own images
CREATE POLICY "Users can update their own images"
  ON images FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete their own images"
  ON images FOR DELETE
  USING (auth.uid() = user_id);
