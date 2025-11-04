-- Add missing columns to database_connections table for SQL Agent
-- This migration ensures all required columns exist

DO $$
BEGIN
  -- Add db_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'db_type') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN db_type TEXT NOT NULL DEFAULT 'postgresql' CHECK (db_type IN ('postgresql', 'mysql', 'sqlite'));
  END IF;

  -- Add encrypted connection detail columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'host_encrypted') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN host_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'port_encrypted') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN port_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'database_encrypted') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN database_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'username_encrypted') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN username_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'password_encrypted') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN password_encrypted TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'connection_string_encrypted') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN connection_string_encrypted TEXT;
  END IF;

  -- Add status column if doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'status') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error'));
  END IF;

  -- Add last_connected_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'last_connected_at') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN last_connected_at TIMESTAMPTZ;
  END IF;

  -- Add last_error column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'last_error') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN last_error TEXT;
  END IF;

  -- Add schema_cache column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'schema_cache') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN schema_cache JSONB;
  END IF;

  -- Add last_schema_refresh column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'last_schema_refresh') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN last_schema_refresh TIMESTAMPTZ;
  END IF;

  -- Add description column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'description') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN description TEXT;
  END IF;

  -- Add name column if doesn't exist (it should already exist)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'database_connections' AND column_name = 'name') THEN
    ALTER TABLE public.database_connections
    ADD COLUMN name TEXT NOT NULL DEFAULT 'Unnamed Connection';
  END IF;
END $$;

-- Create status index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_database_connections_status ON public.database_connections(status);

-- Comments
COMMENT ON COLUMN public.database_connections.db_type IS 'Database type: postgresql, mysql, or sqlite';
COMMENT ON COLUMN public.database_connections.status IS 'Connection status: active, inactive, or error';
COMMENT ON COLUMN public.database_connections.schema_cache IS 'Cached database schema (tables, columns, types, relationships)';
COMMENT ON COLUMN public.database_connections.host_encrypted IS 'AES-256-GCM encrypted database host';
COMMENT ON COLUMN public.database_connections.port_encrypted IS 'AES-256-GCM encrypted database port';
COMMENT ON COLUMN public.database_connections.database_encrypted IS 'AES-256-GCM encrypted database name';
COMMENT ON COLUMN public.database_connections.username_encrypted IS 'AES-256-GCM encrypted database username';
COMMENT ON COLUMN public.database_connections.password_encrypted IS 'AES-256-GCM encrypted database password';
COMMENT ON COLUMN public.database_connections.connection_string_encrypted IS 'AES-256-GCM encrypted full connection string (alternative to individual fields)';
