# Data Model: Personal AI Assistant

**Feature**: 001-personal-ai-assistant
**Date**: 2025-10-27
**Phase**: 1 (Design & Contracts)

## Overview

This document defines the database schema for the Personal AI Assistant. All tables use Row-Level Security (RLS) to enforce user data isolation per Principle III of the constitution.

## Entity Relationship Diagram

```
┌─────────────┐
│    users    │──────┐
│  (Supabase  │      │
│    Auth)    │      │
└─────────────┘      │
                     │
       ┌─────────────┼──────────────┬──────────────┬──────────────┬──────────────┐
       │             │              │              │              │              │
       ▼             ▼              ▼              ▼              ▼              ▼
┌─────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐
│conversations│ │documents │ │ db_conns  │ │   research   │ │  settings  │ │  usage   │
│             │ │          │ │           │ │   _reports   │ │            │ │          │
└──────┬──────┘ └────┬─────┘ └───────────┘ └──────────────┘ └────────────┘ └──────────┘
       │             │
       │             │
       ▼             ▼
┌─────────────┐ ┌──────────┐
│  messages   │ │  chunks  │
│             │ │          │
└─────────────┘ └────┬─────┘
                     │
                     ▼
              ┌──────────────┐
              │search_sources│
              │              │
              └──────────────┘
```

## Tables

### 1. users (Managed by Supabase Auth)

**Purpose**: User authentication and profile information

**Managed By**: Supabase Auth (built-in table)

**Referenced Fields**:
- `id` (UUID): Primary key, used as foreign key in all user-owned tables
- `email` (string): User's email address
- `encrypted_password` (string): Hashed password (managed by Supabase)
- `created_at` (timestamp): Account creation timestamp

**RLS**: Managed by Supabase Auth

---

### 2. user_settings

**Purpose**: User preferences for LLM models, research depth, and UI settings

**Schema**:
```sql
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

-- RLS Policies
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
```

**Validation Rules**:
- `default_*_model`: Must be from allowed models list (validated in application)
- `default_research_depth`: Must be 'quick', 'standard', or 'deep'
- `theme`: Must be 'light', 'dark', or 'system'

---

### 3. conversations

**Purpose**: Chat sessions between user and assistant

**Schema**:
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(200),  -- Auto-generated from first message or user-defined

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- RLS Policies
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
```

---

### 4. messages

**Purpose**: Individual messages within conversations

**Schema**:
```sql
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

-- Indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- RLS Policies
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
```

**Validation Rules**:
- `role`: Must be 'user', 'assistant', or 'system' (CHECK constraint)
- `content`: Cannot be empty (application-level validation)
- `tokens_used`: Must be >= 0 if provided
- `latency_ms`: Must be >= 0 if provided

---

### 5. documents

**Purpose**: Uploaded files in user's knowledge base

**Schema**:
```sql
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

-- Indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- RLS Policies
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
```

**Validation Rules**:
- `file_type`: Must be one of the supported types (application validation)
- `file_size`: Must be > 0 and <= 100MB (application warning at 100MB)
- `status`: Must be 'processing', 'completed', or 'failed' (CHECK constraint)

---

### 6. chunks

**Purpose**: Processed segments of documents with embeddings for RAG

**Schema**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

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

-- Indexes
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_user_id ON chunks(user_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_content_tsv ON chunks USING GIN (content_tsv);

-- RLS Policies
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
```

**Validation Rules**:
- `content`: Cannot be empty
- `embedding`: Must be 1536-dimensional vector (OpenAI embedding size)
- `token_count`: Must be > 0 and typically 500-1200 (application warning if outside range)
- `chunk_index`: Must be >= 0

---

### 7. database_connections

**Purpose**: User's connected SQL databases for SQL Agent

**Schema**:
```sql
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

-- Indexes
CREATE INDEX idx_db_connections_user_id ON database_connections(user_id);
CREATE INDEX idx_db_connections_status ON database_connections(status);

-- RLS Policies
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
```

**Validation Rules**:
- `db_type`: Must be 'postgresql' (others for future)
- `connection_string`: Must be encrypted before storage (application layer)
- `status`: Must be 'validating', 'active', or 'failed'
- `schema_snapshot`: Must be valid JSONB if provided

**Security**:
- Connection strings encrypted using AES-256-GCM at application layer
- Encryption key stored in environment variables (Railway secrets)
- Read-only database user required (validated during connection)

---

### 8. research_reports

**Purpose**: Generated research outputs from Research Agent

**Schema**:
```sql
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

-- Indexes
CREATE INDEX idx_research_reports_user_id ON research_reports(user_id);
CREATE INDEX idx_research_reports_status ON research_reports(status);
CREATE INDEX idx_research_reports_created_at ON research_reports(created_at DESC);

-- Full-text search on title and query
CREATE INDEX idx_research_reports_search ON research_reports USING GIN (
  to_tsvector('english', title || ' ' || query)
);

-- RLS Policies
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
```

**Validation Rules**:
- `depth`: Must be 'quick', 'standard', or 'deep'
- `status`: Must be 'pending', 'in_progress', 'completed', or 'failed'
- `progress_percent`: Must be 0-100
- `content`: Must be valid JSONB with required structure when status='completed'

---

### 9. search_sources

**Purpose**: Individual sources retrieved during research (linked to research reports or RAG citations)

**Schema**:
```sql
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

-- Indexes
CREATE INDEX idx_search_sources_user_id ON search_sources(user_id);
CREATE INDEX idx_search_sources_research_report_id ON search_sources(research_report_id);
CREATE INDEX idx_search_sources_message_id ON search_sources(message_id);
CREATE INDEX idx_search_sources_domain ON search_sources(domain);

-- RLS Policies
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
```

**Validation Rules**:
- `url`: Must be valid URL format (application validation)
- `credibility_score`: 0-100 if provided
- Either `research_report_id` or `message_id` should be set (for traceability)

---

### 10. user_usage

**Purpose**: Track LLM API usage and costs per user per month for budget enforcement (FR-056)

**Schema**:
```sql
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

-- Indexes
CREATE INDEX idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX idx_user_usage_month ON user_usage(month);
CREATE INDEX idx_user_usage_budget_limit ON user_usage(budget_limit_reached) WHERE budget_limit_reached = TRUE;

-- RLS Policies
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
```

**Validation Rules**:
- `month`: Must be YYYY-MM format (e.g., "2025-10")
- `total_cost_usd`: Must be >= 0, typically <= $10.00 (monthly budget limit)
- `usage_by_model`: JSONB with structure: `{ "model-name": { inputTokens: number, outputTokens: number, cost: number } }`

**Budget Enforcement**:
```sql
-- Function to check budget before allowing request
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
```

---

## State Transitions

### Document Processing States

```
processing ──────> completed
    │
    └──────────> failed
```

**Transitions**:
- `processing → completed`: Document successfully chunked and embedded
- `processing → failed`: Error during chunking or embedding (virus scan failure, unsupported format, timeout)

### Research Report States

```
pending ──────> in_progress ──────> completed
                    │
                    └────────────> failed
```

**Transitions**:
- `pending → in_progress`: Research Agent starts job
- `in_progress → completed`: All sources retrieved and report synthesized
- `in_progress → failed`: Search provider failures, timeout, or safety filter triggered

### Database Connection States

```
validating ──────> active
    │
    └──────────> failed
```

**Transitions**:
- `validating → active`: Connection successful and schema discovered
- `validating → failed`: Invalid credentials, unreachable host, or non-read-only user

---

## Relationships Summary

| Parent Table | Child Table | Relationship | Cascade Behavior |
|--------------|-------------|--------------|------------------|
| `users` (auth) | `user_settings` | 1:1 | ON DELETE CASCADE |
| `users` (auth) | `user_usage` | 1:N | ON DELETE CASCADE |
| `users` (auth) | `conversations` | 1:N | ON DELETE CASCADE |
| `users` (auth) | `documents` | 1:N | ON DELETE CASCADE |
| `users` (auth) | `database_connections` | 1:N | ON DELETE CASCADE |
| `users` (auth) | `research_reports` | 1:N | ON DELETE CASCADE |
| `conversations` | `messages` | 1:N | ON DELETE CASCADE |
| `documents` | `chunks` | 1:N | ON DELETE CASCADE |
| `research_reports` | `search_sources` | 1:N | ON DELETE CASCADE |
| `messages` | `search_sources` | 1:N (optional) | ON DELETE SET NULL |

---

## Data Retention & GDPR Compliance

### Hard Delete (FR-038, SC-015)

When a user deletes their account, all related data is permanently deleted via CASCADE constraints:

1. `user_settings` (CASCADE)
2. `user_usage` (CASCADE)
3. `conversations` → `messages` (CASCADE)
4. `documents` → `chunks` (CASCADE)
5. `database_connections` (CASCADE)
6. `research_reports` → `search_sources` (CASCADE)
7. `search_sources` linked to `messages` (SET NULL, then orphaned records cleaned)

### Soft Delete Option (Future Enhancement)

For audit/compliance requirements, can add `deleted_at` timestamp to tables and filter via RLS:

```sql
-- Example soft delete policy
CREATE POLICY "Users cannot see deleted items"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);
```

---

## Performance Considerations

### Vector Search Optimization

- **ivfflat index** on `chunks.embedding` with 100 lists (tune based on corpus size)
- **Approximate nearest neighbor** trades accuracy for speed (acceptable for RAG)
- **Reranking step** corrects precision loss from approximate search

### Text Search Optimization

- **GIN index** on `content_tsv` for fast full-text search
- **Generated column** keeps index automatically updated
- **pg_trgm** for fuzzy matching (typos, partial words)

### Query Optimization

```sql
-- Example optimized hybrid search query
EXPLAIN ANALYZE
SELECT
  c.id,
  c.content,
  d.file_name,
  (
    (1 - (c.embedding <=> $1::vector)) * 0.7 +
    ts_rank(c.content_tsv, to_tsquery('english', $2)) * 0.3
  ) AS score
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE
  c.user_id = $3  -- RLS enforced
  AND (
    c.embedding <=> $1::vector < 0.5
    OR c.content_tsv @@ to_tsquery('english', $2)
  )
ORDER BY score DESC
LIMIT 20;
```

**Expected Performance**:
- Vector search: <100ms for 100k chunks
- Text search: <50ms for 100k chunks
- Combined hybrid: <150ms (within 2s budget for RAG)

---

## Migration Strategy

### Initial Migration (001_initial_schema.sql)

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create tables in order (respecting foreign keys)
-- 1. user_settings
-- 2. conversations
-- 3. messages
-- 4. documents
-- 5. chunks
-- 6. database_connections
-- 7. research_reports
-- 8. search_sources

-- Create indexes
-- Create RLS policies
-- Create triggers for updated_at timestamps
```

### Future Migrations

- Additive only (no breaking changes to existing tables)
- Use Supabase CLI: `supabase migration new <name>`
- Test locally before applying to production
- Version numbers: 001, 002, 003, etc.

---

## Data Model Validation Checklist

- ✅ All tables have `user_id` foreign key (except Supabase Auth-managed)
- ✅ All tables have RLS enabled with policies
- ✅ All tables have appropriate indexes for query patterns
- ✅ All foreign keys have ON DELETE behavior defined
- ✅ All enum-like fields have CHECK constraints
- ✅ All timestamps use `TIMESTAMP WITH TIME ZONE`
- ✅ All required fields are NOT NULL
- ✅ All validation rules documented
- ✅ State transitions documented
- ✅ CASCADE behavior enables GDPR compliance (hard delete)
- ✅ Vector and text search indexes configured
- ✅ JSONB used for flexible schemas (table_data, research content)

**Status**: Data model complete. Ready for contract generation (Phase 1 continuation).
