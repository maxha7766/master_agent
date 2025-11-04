-- Create database_connections table for SQL Agent
-- This table stores encrypted PostgreSQL connection strings for users

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS database_connections CASCADE;

-- Create the table
CREATE TABLE database_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  encrypted_connection_string TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create index on user_id for fast lookups
CREATE INDEX idx_database_connections_user_id ON database_connections(user_id);

-- Create partial index for active connections
CREATE INDEX idx_database_connections_user_active ON database_connections(user_id) WHERE active = true;

-- Add updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_database_connections_updated_at
  BEFORE UPDATE ON database_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE database_connections ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own connections
CREATE POLICY database_connections_user_policy ON database_connections
  FOR ALL
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE database_connections IS 'Stores encrypted PostgreSQL connection strings for SQL Agent queries';
