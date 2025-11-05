-- Migration: Add Topic Research Feature
-- Extends research_projects table to support both graduate and topic research types

-- Add research_type column to distinguish between graduate papers and topic research
ALTER TABLE research_projects
ADD COLUMN IF NOT EXISTS research_type TEXT DEFAULT 'graduate'
CHECK (research_type IN ('graduate', 'topic'));

-- Add topic-specific metadata fields
ALTER TABLE research_projects
ADD COLUMN IF NOT EXISTS num_sources_requested INTEGER;

ALTER TABLE research_projects
ADD COLUMN IF NOT EXISTS search_engines_used TEXT[];

ALTER TABLE research_projects
ADD COLUMN IF NOT EXISTS content_extraction_count INTEGER DEFAULT 0;

-- Create index for research_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_research_projects_type ON research_projects(research_type);

-- Add helpful comments
COMMENT ON COLUMN research_projects.research_type IS 'Type of research: graduate (full academic paper) or topic (web knowledge synthesis)';
COMMENT ON COLUMN research_projects.num_sources_requested IS 'Number of sources user requested for topic research (5-30)';
COMMENT ON COLUMN research_projects.search_engines_used IS 'Array of search engines used: duckduckgo, brave, tavily';
COMMENT ON COLUMN research_projects.content_extraction_count IS 'Number of sources successfully extracted with Firecrawl';

-- Update existing records to have research_type = 'graduate' (already set by DEFAULT, but explicit for clarity)
UPDATE research_projects SET research_type = 'graduate' WHERE research_type IS NULL;
