-- Create videos table for storing generated and edited videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Prompts
  prompt TEXT NOT NULL,
  negative_prompt TEXT,

  -- Inputs/Outputs
  source_url TEXT, -- For image-to-video or video-to-video
  video_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT, -- Optional thumbnail

  -- Generation metadata
  model VARCHAR(100) NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- text-to-video, image-to-video, video-editing
  
  -- Parameters used
  parameters JSONB NOT NULL DEFAULT '{}',

  -- Cost tracking
  cost_usd DECIMAL(10, 6),

  -- Video properties
  duration DECIMAL(5, 2), -- Duration in seconds
  width INTEGER,
  height INTEGER,
  fps INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_conversation_id ON videos(conversation_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_operation_type ON videos(operation_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_updated_at();

-- Enable Row Level Security
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own videos
CREATE POLICY "Users can view their own videos"
  ON videos FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own videos
CREATE POLICY "Users can insert their own videos"
  ON videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own videos
CREATE POLICY "Users can update their own videos"
  ON videos FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own videos
CREATE POLICY "Users can delete their own videos"
  ON videos FOR DELETE
  USING (auth.uid() = user_id);
