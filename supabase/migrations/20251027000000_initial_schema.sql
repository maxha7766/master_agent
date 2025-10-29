-- ============================================
-- Personal AI Assistant - Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-10-27
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 2. TABLES
-- ============================================

-- Table: user_settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- LLM Model Preferences
  default_chat_model VARCHAR(100) DEFAULT 'claude-sonnet-4.5',
  default_rag_model VARCHAR(100) DEFAULT 'claude-sonnet-4.5',
  default_sql_model VARCHAR(100) DEFAULT 'gpt-4',
  default_research_model VARCHAR(100) DEFAULT 'claude-sonnet-4.5',

  -- Research Preferences
  default_research_depth VARCHAR(20) DEFAULT 'standard',  -- 'quick' | 'standard' | 'deep'

  -- UI Preferences
  theme VARCHAR(20) DEFAULT 'light',  -- 'light' | 'dark' | 'system'

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Table: conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(200),  -- Auto-generated from first message or user-defined

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,

  -- Metadata
  agent_used VARCHAR(50),  -- 'master' | 'rag' | 'sql' | 'research' | null for user messages
  model_used VARCHAR(100),
  tokens_used INTEGER,
  latency_ms INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (role IN ('user', 'assistant', 'system'))
);

-- Table: documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL,  -- 'pdf' | 'txt' | 'docx' | 'csv' | 'xlsx' | 'md'
  file_size INTEGER NOT NULL,  -- Bytes
  file_url TEXT NOT NULL,  -- Supabase Storage URL

  -- Processing status
  status VARCHAR(20) NOT NULL DEFAULT 'processing',  -- 'processing' | 'completed' | 'failed'
  error_message TEXT,

  -- Metadata
  page_count INTEGER,  -- For PDFs
  chunk_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,

  CHECK (status IN ('processing', 'completed', 'failed')),
  CHECK (file_size > 0)
);

-- Table: chunks
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-large dimension

  -- Full-text search
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  -- Position metadata
  chunk_index INTEGER NOT NULL,  -- Order within document (0-indexed)
  page_number INTEGER,  -- For PDFs
  start_char INTEGER,
  end_char INTEGER,

  -- Additional metadata
  token_count INTEGER NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (token_count > 0),
  CHECK (chunk_index >= 0)
);

-- Table: database_connections
CREATE TABLE database_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,  -- User-defined name
  db_type VARCHAR(50) NOT NULL DEFAULT 'postgresql',  -- 'postgresql' | 'mysql' | 'sqlite' (future)

  -- Connection details (encrypted at application layer)
  connection_string TEXT NOT NULL,  -- Encrypted

  -- Connection status
  status VARCHAR(20) NOT NULL DEFAULT 'validating',  -- 'validating' | 'active' | 'failed'
  last_validated_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  -- Schema snapshot (JSONB for flexibility)
  schema_snapshot JSONB,  -- { tables: [{ name, columns: [{ name, type }] }] }

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (status IN ('validating', 'active', 'failed'))
);

-- Table: research_reports
CREATE TABLE research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(500) NOT NULL,
  query TEXT NOT NULL,  -- Original user query

  depth VARCHAR(20) NOT NULL,  -- 'quick' | 'standard' | 'deep'

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed' | 'failed'
  progress_percent INTEGER DEFAULT 0,

  -- Report content (JSONB for structured data)
  content JSONB,  -- { summary, key_findings: [], sources: [], methodology }

  -- Metadata
  source_count INTEGER DEFAULT 0,
  model_used VARCHAR(100),
  total_tokens INTEGER,
  duration_seconds INTEGER,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  CHECK (depth IN ('quick', 'standard', 'deep')),
  CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

-- Table: search_sources
CREATE TABLE search_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source context
  research_report_id UUID REFERENCES research_reports(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,  -- If used as RAG citation

  url TEXT NOT NULL,
  title VARCHAR(1000),
  snippet TEXT,

  -- Credibility
  credibility_score INTEGER,  -- 0-100
  domain VARCHAR(500),
  publish_date TIMESTAMP WITH TIME ZONE,
  author VARCHAR(500),

  -- Provider
  provider VARCHAR(100),  -- 'tavily' | 'brave' | 'semantic_scholar' | 'arxiv' | etc.

  retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CHECK (credibility_score >= 0 AND credibility_score <= 100)
);

-- Table: user_usage
CREATE TABLE user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  month VARCHAR(7) NOT NULL,  -- YYYY-MM format

  total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,

  -- Token usage breakdown by model
  usage_by_model JSONB NOT NULL DEFAULT '{}',  -- { "gpt-4": { input: 1000, output: 500, cost: 0.12 }, ... }

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Budget tracking
  budget_warning_sent BOOLEAN DEFAULT FALSE,
  budget_limit_reached BOOLEAN DEFAULT FALSE,

  UNIQUE(user_id, month),
  CHECK (total_cost_usd >= 0)
);

-- ============================================
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- user_settings RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- conversations RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- messages RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (auth.uid() = user_id);

-- documents RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- chunks RLS
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks"
  ON chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
  ON chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
  ON chunks FOR DELETE
  USING (auth.uid() = user_id);

-- database_connections RLS
ALTER TABLE database_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own database connections"
  ON database_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own database connections"
  ON database_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own database connections"
  ON database_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own database connections"
  ON database_connections FOR DELETE
  USING (auth.uid() = user_id);

-- research_reports RLS
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own research reports"
  ON research_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own research reports"
  ON research_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research reports"
  ON research_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own research reports"
  ON research_reports FOR DELETE
  USING (auth.uid() = user_id);

-- search_sources RLS
ALTER TABLE search_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search sources"
  ON search_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search sources"
  ON search_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search sources"
  ON search_sources FOR DELETE
  USING (auth.uid() = user_id);

-- user_usage RLS
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON user_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. INDEXES
-- ============================================

-- conversations indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- messages indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- documents indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- chunks indexes
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_user_id ON chunks(user_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_content_tsv ON chunks USING GIN (content_tsv);

-- database_connections indexes
CREATE INDEX idx_db_connections_user_id ON database_connections(user_id);
CREATE INDEX idx_db_connections_status ON database_connections(status);

-- research_reports indexes
CREATE INDEX idx_research_reports_user_id ON research_reports(user_id);
CREATE INDEX idx_research_reports_status ON research_reports(status);
CREATE INDEX idx_research_reports_created_at ON research_reports(created_at DESC);
CREATE INDEX idx_research_reports_search ON research_reports USING GIN (
  to_tsvector('english', title || ' ' || query)
);

-- search_sources indexes
CREATE INDEX idx_search_sources_user_id ON search_sources(user_id);
CREATE INDEX idx_search_sources_research_report_id ON search_sources(research_report_id);
CREATE INDEX idx_search_sources_message_id ON search_sources(message_id);
CREATE INDEX idx_search_sources_domain ON search_sources(domain);

-- user_usage indexes
CREATE INDEX idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX idx_user_usage_month ON user_usage(month);
CREATE INDEX idx_user_usage_budget_limit ON user_usage(budget_limit_reached) WHERE budget_limit_reached = TRUE;

-- ============================================
-- 5. FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION check_user_budget(
  p_user_id UUID,
  p_estimated_cost DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage DECIMAL;
  v_budget_limit DECIMAL := 10.00;
BEGIN
  SELECT COALESCE(total_cost_usd, 0)
  INTO v_current_usage
  FROM user_usage
  WHERE user_id = p_user_id
    AND month = TO_CHAR(NOW(), 'YYYY-MM');

  RETURN (v_current_usage + p_estimated_cost) <= v_budget_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
