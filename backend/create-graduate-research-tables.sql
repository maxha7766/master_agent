-- ============================================
-- Graduate Research System - Database Schema
-- ============================================
-- Creates tables for multi-agent research system that generates
-- 5,000-10,000 word graduate-level research reports
-- ============================================

-- ============================================
-- 1. RESEARCH PROJECTS
-- ============================================
-- Main table tracking each research project
CREATE TABLE IF NOT EXISTS public.research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (char_length(topic) > 0),
  status TEXT NOT NULL CHECK (status IN ('planning', 'researching', 'analyzing', 'writing', 'complete', 'failed')),
  word_count_target INTEGER NOT NULL DEFAULT 7500 CHECK (word_count_target >= 5000 AND word_count_target <= 10000),
  citation_style TEXT NOT NULL DEFAULT 'APA' CHECK (citation_style IN ('APA', 'MLA', 'Chicago')),
  final_report TEXT,
  final_word_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_projects_user_id ON public.research_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON public.research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_projects_created_at ON public.research_projects(created_at DESC);

-- Row Level Security
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;

-- Users can only access their own projects
DROP POLICY IF EXISTS "Users can view their own research projects" ON public.research_projects;
CREATE POLICY "Users can view their own research projects"
  ON public.research_projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own research projects" ON public.research_projects;
CREATE POLICY "Users can insert their own research projects"
  ON public.research_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own research projects" ON public.research_projects;
CREATE POLICY "Users can update their own research projects"
  ON public.research_projects FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own research projects" ON public.research_projects;
CREATE POLICY "Users can delete their own research projects"
  ON public.research_projects FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. RESEARCH SOURCES
-- ============================================
-- Stores all gathered sources (academic papers + web)
CREATE TABLE IF NOT EXISTS public.research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('academic', 'academic_paper', 'preprint', 'web', 'news')),
  source_name TEXT NOT NULL, -- e.g., 'Semantic Scholar', 'Brave Search'
  title TEXT NOT NULL,
  authors TEXT[], -- Array of author names
  url TEXT NOT NULL,
  doi TEXT, -- For academic papers
  publication_date TIMESTAMPTZ,
  summary TEXT NOT NULL,
  key_findings TEXT[],
  credibility_score INTEGER NOT NULL CHECK (credibility_score >= 1 AND credibility_score <= 10),
  citation_count INTEGER DEFAULT 0,
  citation_info JSONB DEFAULT '{}'::jsonb, -- Store citation metadata
  full_content TEXT, -- Full text if available
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_sources_project_id ON public.research_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_source_type ON public.research_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_research_sources_credibility ON public.research_sources(credibility_score DESC);

-- RLS (inherit from parent project)
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sources for their projects" ON public.research_sources;
CREATE POLICY "Users can view sources for their projects"
  ON public.research_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = research_sources.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert sources for their projects" ON public.research_sources;
CREATE POLICY "Users can insert sources for their projects"
  ON public.research_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = research_sources.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. RESEARCH THEMES
-- ============================================
-- Stores themes identified during analysis phase
CREATE TABLE IF NOT EXISTS public.research_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  theme_name TEXT NOT NULL,
  description TEXT NOT NULL,
  key_insights TEXT[],
  supporting_sources UUID[], -- Array of source IDs
  contradictions TEXT[],
  evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'moderate', 'weak')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_themes_project_id ON public.research_themes(project_id);

-- RLS
ALTER TABLE public.research_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view themes for their projects" ON public.research_themes;
CREATE POLICY "Users can view themes for their projects"
  ON public.research_themes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = research_themes.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert themes for their projects" ON public.research_themes;
CREATE POLICY "Users can insert themes for their projects"
  ON public.research_themes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = research_themes.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. REPORT SECTIONS
-- ============================================
-- Stores individual sections of the final report
CREATE TABLE IF NOT EXISTS public.report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL CHECK (section_number >= 1),
  section_name TEXT NOT NULL CHECK (section_name IN (
    'Abstract', 'Introduction', 'Literature Review', 'Methodology',
    'Results', 'Discussion', 'Conclusion', 'References', 'Appendices'
  )),
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  citations_used UUID[], -- Array of source IDs cited
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, section_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_sections_project_id ON public.report_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_status ON public.report_sections(status);

-- RLS
ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sections for their projects" ON public.report_sections;
CREATE POLICY "Users can view sections for their projects"
  ON public.report_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = report_sections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert sections for their projects" ON public.report_sections;
CREATE POLICY "Users can insert sections for their projects"
  ON public.report_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = report_sections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update sections for their projects" ON public.report_sections;
CREATE POLICY "Users can update sections for their projects"
  ON public.report_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = report_sections.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. AGENT LOGS
-- ============================================
-- Logs all agent actions for debugging and transparency
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('supervisor', 'source_manager', 'analysis', 'writing', 'assembly')),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_logs_project_id ON public.agent_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_type ON public.agent_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON public.agent_logs(created_at DESC);

-- RLS
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view logs for their projects" ON public.agent_logs;
CREATE POLICY "Users can view logs for their projects"
  ON public.agent_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = agent_logs.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert logs for their projects" ON public.agent_logs;
CREATE POLICY "Users can insert logs for their projects"
  ON public.agent_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.research_projects
      WHERE research_projects.id = agent_logs.project_id
      AND research_projects.user_id = auth.uid()
    )
  );

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Graduate Research System tables created successfully';
  RAISE NOTICE '   - research_projects';
  RAISE NOTICE '   - research_sources';
  RAISE NOTICE '   - research_themes';
  RAISE NOTICE '   - report_sections';
  RAISE NOTICE '   - agent_logs';
END $$;
