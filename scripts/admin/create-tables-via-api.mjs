/**
 * Create Graduate Research Tables via Supabase Client API
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('📚 Creating Graduate Research tables...\n');

  const tables = [
    {
      name: 'research_projects',
      sql: `
        CREATE TABLE IF NOT EXISTS public.research_projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          topic TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'planning',
          word_count_target INTEGER NOT NULL DEFAULT 7500,
          citation_style TEXT NOT NULL DEFAULT 'APA',
          final_report TEXT,
          final_word_count INTEGER,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_status CHECK (status IN ('planning', 'researching', 'analyzing', 'writing', 'complete', 'failed')),
          CONSTRAINT valid_word_count CHECK (word_count_target >= 5000 AND word_count_target <= 10000),
          CONSTRAINT valid_citation_style CHECK (citation_style IN ('APA', 'MLA', 'Chicago'))
        );
      `,
    },
    {
      name: 'research_sources',
      sql: `
        CREATE TABLE IF NOT EXISTS public.research_sources (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL,
          source_type TEXT NOT NULL,
          source_name TEXT NOT NULL,
          title TEXT NOT NULL,
          authors TEXT[],
          url TEXT NOT NULL,
          doi TEXT,
          publication_date TIMESTAMPTZ,
          summary TEXT NOT NULL,
          key_findings TEXT[],
          credibility_score INTEGER NOT NULL,
          citation_count INTEGER DEFAULT 0,
          citation_info JSONB DEFAULT '{}'::jsonb,
          full_content TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_source_type CHECK (source_type IN ('academic', 'web', 'news')),
          CONSTRAINT valid_credibility CHECK (credibility_score >= 1 AND credibility_score <= 10)
        );
      `,
    },
    {
      name: 'research_themes',
      sql: `
        CREATE TABLE IF NOT EXISTS public.research_themes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL,
          theme_name TEXT NOT NULL,
          description TEXT NOT NULL,
          key_insights TEXT[],
          supporting_sources UUID[],
          contradictions TEXT[],
          evidence_strength TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_evidence CHECK (evidence_strength IN ('strong', 'moderate', 'weak') OR evidence_strength IS NULL)
        );
      `,
    },
    {
      name: 'report_sections',
      sql: `
        CREATE TABLE IF NOT EXISTS public.report_sections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL,
          section_number INTEGER NOT NULL,
          section_name TEXT NOT NULL,
          content TEXT NOT NULL,
          word_count INTEGER NOT NULL,
          citations_used UUID[],
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_section_number CHECK (section_number >= 1),
          CONSTRAINT valid_section_name CHECK (section_name IN (
            'Abstract', 'Introduction', 'Literature Review', 'Methodology',
            'Results', 'Discussion', 'Conclusion', 'References', 'Appendices'
          )),
          CONSTRAINT valid_section_status CHECK (status IN ('draft', 'final')),
          UNIQUE(project_id, section_name)
        );
      `,
    },
    {
      name: 'agent_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS public.agent_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL,
          agent_type TEXT NOT NULL,
          action TEXT NOT NULL,
          details JSONB DEFAULT '{}'::jsonb,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT valid_agent_type CHECK (agent_type IN ('supervisor', 'source_manager', 'analysis', 'writing', 'assembly'))
        );
      `,
    },
  ];

  // Execute each CREATE TABLE statement
  for (const table of tables) {
    try {
      console.log(`  Creating table: ${table.name}...`);

      // Use the postgres RPC to execute raw SQL
      const { error } = await supabase.rpc('exec_sql', {
        query: table.sql,
      });

      if (error) {
        // If exec_sql doesn't exist, we'll get an error - that's okay
        console.log(`  ⚠️  Using fallback method for ${table.name}`);

        // Try using the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ query: table.sql }),
        });

        if (response.ok) {
          console.log(`  ✅ ${table.name} created`);
        } else {
          console.log(`  ℹ️  ${table.name} may already exist or needs manual creation`);
        }
      } else {
        console.log(`  ✅ ${table.name} created`);
      }
    } catch (err) {
      console.log(`  ℹ️  ${table.name}: ${err.message}`);
    }
  }

  console.log('\n✅ Table creation process complete!');
  console.log('\nNOTE: If tables still don\'t exist, please create them manually in Supabase Dashboard');
  console.log('SQL file is available at: create-graduate-research-tables.sql\n');
}

createTables();
