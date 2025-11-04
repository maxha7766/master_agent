-- Graduate-Level Research System
-- Database schema for comprehensive academic research projects

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. RESEARCH PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS research_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'researching', 'analyzing', 'writing', 'complete', 'failed')),
  word_count_target INTEGER DEFAULT 7500 CHECK (word_count_target >= 5000 AND word_count_target <= 10000),
  citation_style TEXT DEFAULT 'APA' CHECK (citation_style IN ('APA', 'MLA', 'Chicago')),
  final_report TEXT,
  final_word_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_research_projects_user_id ON research_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON research_projects(status);

-- ============================================================================
-- 2. RESEARCH SOURCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS research_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('academic_paper', 'preprint', 'news', 'web', 'government', 'community')),
  source_name TEXT NOT NULL, -- 'Semantic Scholar', 'arXiv', 'OpenAlex', 'Brave', 'Tavily', etc.
  title TEXT NOT NULL,
  authors TEXT[], -- Array of author names
  url TEXT,
  doi TEXT, -- Digital Object Identifier (for academic papers)
  publication_date DATE,
  summary TEXT, -- Abstract or snippet
  key_findings TEXT[], -- Extracted key points
  credibility_score INTEGER CHECK (credibility_score >= 1 AND credibility_score <= 10),
  citation_count INTEGER DEFAULT 0, -- Number of times cited (for papers)
  citation_info JSONB DEFAULT '{}', -- Structured citation data (journal, volume, pages, etc.)
  full_content TEXT, -- Full text if available
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_research_sources_project_id ON research_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_source_type ON research_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_research_sources_credibility ON research_sources(credibility_score DESC);

-- ============================================================================
-- 3. RESEARCH THEMES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS research_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  theme_name TEXT NOT NULL,
  description TEXT,
  supporting_sources UUID[], -- Array of source IDs from research_sources
  key_insights TEXT[], -- Main insights from this theme
  contradictions TEXT[], -- Noted contradictions or debates
  evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'moderate', 'weak')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for project lookups
CREATE INDEX IF NOT EXISTS idx_research_themes_project_id ON research_themes(project_id);

-- ============================================================================
-- 4. REPORT SECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'abstract', 'introduction', 'literature_review', 'methodology',
    'results', 'discussion', 'conclusion', 'references', 'appendices'
  )),
  section_number INTEGER NOT NULL, -- Order in report (1, 2, 3, etc.)
  content TEXT, -- Markdown content
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'final')),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, section_type)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_report_sections_project_id ON report_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_section_number ON report_sections(section_number);

-- ============================================================================
-- 5. AGENT LOGS TABLE (for debugging and monitoring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES research_projects(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('supervisor', 'research', 'analysis', 'writing', 'citation', 'assembler')),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for project logs
CREATE INDEX IF NOT EXISTS idx_agent_logs_project_id ON agent_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own research projects
CREATE POLICY "Users can view own research projects"
  ON research_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own research projects"
  ON research_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research projects"
  ON research_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own research projects"
  ON research_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Users can access sources for their projects
CREATE POLICY "Users can view sources for own projects"
  ON research_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_sources.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sources for own projects"
  ON research_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_sources.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can access themes for their projects
CREATE POLICY "Users can view themes for own projects"
  ON research_themes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_themes.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert themes for own projects"
  ON research_themes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = research_themes.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can access report sections for their projects
CREATE POLICY "Users can view sections for own projects"
  ON report_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = report_sections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sections for own projects"
  ON report_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = report_sections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sections for own projects"
  ON report_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = report_sections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can access agent logs for their projects
CREATE POLICY "Users can view logs for own projects"
  ON agent_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM research_projects
      WHERE research_projects.id = agent_logs.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_research_projects_updated_at
  BEFORE UPDATE ON research_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_sections_updated_at
  BEFORE UPDATE ON report_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate total word count for a project
CREATE OR REPLACE FUNCTION calculate_project_word_count(project_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(word_count), 0)::INTEGER
  FROM report_sections
  WHERE project_id = project_uuid
  AND status = 'final';
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE research_projects IS 'Stores graduate-level research projects initiated by users';
COMMENT ON TABLE research_sources IS 'Stores all sources gathered for research projects from various APIs';
COMMENT ON TABLE research_themes IS 'Stores identified themes and patterns across research sources';
COMMENT ON TABLE report_sections IS 'Stores individual sections of the research report';
COMMENT ON TABLE agent_logs IS 'Stores agent activity logs for debugging and monitoring';

COMMENT ON COLUMN research_projects.status IS 'Current phase: planning, researching, analyzing, writing, complete, failed';
COMMENT ON COLUMN research_sources.credibility_score IS 'Score from 1-10 based on publication venue, citations, recency';
COMMENT ON COLUMN research_themes.evidence_strength IS 'How strongly the evidence supports this theme';
