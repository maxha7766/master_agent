/**
 * Analysis Agent
 * Analyzes research sources to identify themes, patterns, and contradictions
 * Uses LLM for intelligent synthesis
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { AnthropicProvider } from '../../services/llm/anthropic.js';

export interface ResearchTheme {
  theme_name: string;
  description: string;
  supporting_sources: string[]; // Source titles
  key_insights: string[];
  contradictions: string[];
  evidence_strength: 'strong' | 'moderate' | 'weak';
}

export class AnalysisAgent {
  private llmProvider: AnthropicProvider;

  constructor() {
    this.llmProvider = new AnthropicProvider();
  }

  /**
   * Analyze all sources for a project and identify themes
   */
  async analyzeResearch(projectId: string): Promise<ResearchTheme[]> {
    log.info('Starting research analysis', { projectId });

    // Log start
    await this.logAction(projectId, 'analysis_started');

    // Retrieve all sources for the project
    const { data: sources, error } = await supabase
      .from('research_sources')
      .select('*')
      .eq('project_id', projectId)
      .order('credibility_score', { ascending: false });

    if (error || !sources || sources.length === 0) {
      throw new Error('No sources found for analysis');
    }

    log.info('Retrieved sources for analysis', {
      projectId,
      sourceCount: sources.length,
    });

    // Identify themes using LLM
    const themes = await this.identifyThemes(sources);

    log.info('Themes identified', {
      projectId,
      themeCount: themes.length,
    });

    // Store themes in database
    await this.storeThemes(projectId, themes, sources);

    await this.logAction(projectId, 'analysis_completed', {
      themesIdentified: themes.length,
    });

    return themes;
  }

  /**
   * Use LLM to identify major themes across all sources
   */
  private async identifyThemes(sources: any[]): Promise<ResearchTheme[]> {
    // Prepare source summaries for LLM
    const sourceSummaries = sources.map((source, index) => ({
      index: index + 1,
      title: source.title,
      authors: source.authors?.join(', ') || 'Unknown',
      type: source.source_type,
      summary: source.summary.substring(0, 500), // Limit to 500 chars
      credibility: source.credibility_score,
    }));

    const prompt = `You are an academic researcher analyzing multiple sources for a research project.

SOURCES:
${JSON.stringify(sourceSummaries, null, 2)}

TASK:
Analyze these ${sources.length} sources and identify 3-6 major themes that emerge across the literature.

For each theme:
1. **Name**: Clear, concise theme name (3-8 words)
2. **Description**: What this theme covers (2-3 sentences)
3. **Supporting Sources**: List source titles that support this theme
4. **Key Insights**: 2-4 main insights from this theme
5. **Contradictions**: Any debates or contradictory findings (if any)
6. **Evidence Strength**: Rate as "strong", "moderate", or "weak" based on:
   - Number of high-credibility sources supporting it
   - Consistency across sources
   - Quality of evidence

Guidelines:
- Themes should be distinct but can have some overlap
- Focus on the most important and well-supported themes
- Be specific and academic in your analysis
- Identify genuine contradictions or debates, not just different perspectives

Output ONLY valid JSON in this exact format:
{
  "themes": [
    {
      "theme_name": "...",
      "description": "...",
      "supporting_sources": ["Title 1", "Title 2"],
      "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
      "contradictions": ["Contradiction 1 if any"],
      "evidence_strength": "strong|moderate|weak"
    }
  ]
}`;

    const result = await this.llmProvider.chat(
      [{ role: 'user', content: prompt }],
      'claude-sonnet-4-5-20250929',
      {
        maxTokens: 3000,
        temperature: 0.3, // Lower temperature for more consistent analysis
      }
    );

    const response = result.content;

    try {
      // Extract JSON from response - handle markdown code blocks
      let jsonString = response.trim();

      // Remove markdown code block if present
      if (jsonString.startsWith('```')) {
        const lines = jsonString.split('\n');
        // Remove first line (```json or ```)
        lines.shift();
        // Remove last line (```)
        if (lines[lines.length - 1].trim() === '```') {
          lines.pop();
        }
        jsonString = lines.join('\n').trim();
      }

      // Try to find JSON object if there's other text
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonString);
      return parsed.themes || [];
    } catch (error) {
      log.error('Failed to parse theme analysis', { response, error: error instanceof Error ? error.message : String(error) });
      throw new Error('LLM returned invalid JSON for theme analysis');
    }
  }

  /**
   * Store identified themes in database
   */
  private async storeThemes(
    projectId: string,
    themes: ResearchTheme[],
    sources: any[]
  ): Promise<void> {
    // Map source titles to IDs for supporting_sources
    const sourceMap = new Map(sources.map(s => [s.title, s.id]));

    const themeRecords = themes.map(theme => ({
      project_id: projectId,
      theme_name: theme.theme_name,
      description: theme.description,
      supporting_sources: theme.supporting_sources
        .map(title => sourceMap.get(title))
        .filter(Boolean) as string[], // Convert titles to UUIDs
      key_insights: theme.key_insights,
      contradictions: theme.contradictions,
      evidence_strength: theme.evidence_strength,
    }));

    const { error } = await supabase
      .from('research_themes')
      .insert(themeRecords);

    if (error) {
      throw new Error(`Failed to store themes: ${error.message}`);
    }

    log.info('Themes stored in database', {
      projectId,
      count: themes.length,
    });
  }

  /**
   * Find contradictions and debates across sources
   */
  async findContradictions(projectId: string): Promise<string[]> {
    const { data: sources } = await supabase
      .from('research_sources')
      .select('title, summary')
      .eq('project_id', projectId);

    if (!sources || sources.length < 2) {
      return [];
    }

    const prompt = `Analyze these research sources and identify any contradictions or debates:

${sources.map((s, i) => `${i + 1}. ${s.title}\n${s.summary.substring(0, 300)}`).join('\n\n')}

List any contradictions or debates you find. Return as JSON array:
{ "contradictions": ["Contradiction 1", "Contradiction 2"] }`;

    const result = await this.llmProvider.chat(
      [{ role: 'user', content: prompt }],
      'claude-sonnet-4-5-20250929',
      {
        maxTokens: 1000,
        temperature: 0.3,
      }
    );

    const response = result.content;

    try {
      const parsed = JSON.parse(response);
      return parsed.contradictions || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Log agent action
   */
  private async logAction(
    projectId: string,
    action: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await supabase.from('agent_logs').insert({
      project_id: projectId,
      agent_type: 'analysis',
      action,
      details,
      success: true,
    });
  }
}
