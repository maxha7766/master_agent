/**
 * Writing Agent
 * Drafts each section of the graduate-level research report
 * Uses LLM with specific prompts for academic writing
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { AnthropicProvider } from '../../services/llm/anthropic.js';

export type SectionType =
  | 'abstract'
  | 'introduction'
  | 'literature_review'
  | 'methodology'
  | 'results'
  | 'discussion'
  | 'conclusion'
  | 'appendices';

export interface WritingContext {
  topic: string;
  sources: any[];
  themes: any[];
  wordCountTarget: number;
  citationStyle: 'APA' | 'MLA' | 'Chicago';
}

export class WritingAgent {
  private llmProvider: AnthropicProvider;

  constructor() {
    this.llmProvider = new AnthropicProvider();
  }

  /**
   * Write all sections for a research project
   */
  async writeAllSections(projectId: string): Promise<void> {
    log.info('Starting report writing', { projectId });

    await this.logAction(projectId, 'writing_started');

    // Get project details
    const { data: project } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      throw new Error('Project not found');
    }

    // Get sources
    const { data: sources } = await supabase
      .from('research_sources')
      .select('*')
      .eq('project_id', projectId)
      .order('credibility_score', { ascending: false });

    // Get themes
    const { data: themes } = await supabase
      .from('research_themes')
      .select('*')
      .eq('project_id', projectId);

    if (!sources || sources.length === 0) {
      throw new Error('No sources found for writing');
    }

    const context: WritingContext = {
      topic: project.topic,
      sources: sources || [],
      themes: themes || [],
      wordCountTarget: project.word_count_target,
      citationStyle: project.citation_style,
    };

    // Write sections sequentially (order matters)
    const sections: { type: SectionType; number: number; targetWords: number }[] = [
      { type: 'abstract', number: 1, targetWords: 300 },
      { type: 'introduction', number: 2, targetWords: 1000 },
      { type: 'literature_review', number: 3, targetWords: 2500 },
      { type: 'methodology', number: 4, targetWords: 1000 },
      { type: 'results', number: 5, targetWords: 2000 },
      { type: 'discussion', number: 6, targetWords: 2000 },
      { type: 'conclusion', number: 7, targetWords: 800 },
      { type: 'appendices', number: 8, targetWords: 200 },
    ];

    for (const section of sections) {
      try {
        log.info(`Writing section: ${section.type}`, { projectId });
        await this.writeSection(projectId, section.type, section.number, section.targetWords, context);
      } catch (error: any) {
        log.error(`Failed to write section: ${section.type}`, { projectId, error: error.message });
        throw error;
      }
    }

    await this.logAction(projectId, 'writing_completed', {
      sectionsWritten: sections.length,
    });

    log.info('All sections written', { projectId });
  }

  /**
   * Write a specific section
   */
  async writeSection(
    projectId: string,
    sectionType: SectionType,
    sectionNumber: number,
    targetWords: number,
    context: WritingContext
  ): Promise<string> {
    log.info(`Drafting ${sectionType}`, { projectId, targetWords });

    // Generate section content using LLM
    const content = await this.generateSectionContent(sectionType, targetWords, context);

    // Count words
    const wordCount = this.countWords(content);

    // Map section type to database format
    const sectionNameMap: Record<SectionType, string> = {
      abstract: 'Abstract',
      introduction: 'Introduction',
      literature_review: 'Literature Review',
      methodology: 'Methodology',
      results: 'Results',
      discussion: 'Discussion',
      conclusion: 'Conclusion',
      appendices: 'Appendices',
    };

    // Store in database
    const { error } = await supabase
      .from('report_sections')
      .insert({
        project_id: projectId,
        section_name: sectionNameMap[sectionType],
        section_number: sectionNumber,
        content,
        word_count: wordCount,
        status: 'final', // Mark as final so ReportAssembler can find it
        citations_used: [], // Will be populated during citation insertion
      });

    if (error) {
      throw new Error(`Failed to store section: ${error.message}`);
    }

    log.info(`Section ${sectionType} drafted`, {
      projectId,
      wordCount,
      targetWords,
    });

    return content;
  }

  /**
   * Generate content for a specific section type
   */
  private async generateSectionContent(
    sectionType: SectionType,
    targetWords: number,
    context: WritingContext
  ): Promise<string> {
    const prompt = this.buildPrompt(sectionType, targetWords, context);

    const result = await this.llmProvider.chat(
      [{ role: 'user', content: prompt }],
      'claude-sonnet-4-5-20250929',
      {
        maxTokens: Math.ceil(targetWords * 1.5), // ~1.5 tokens per word
        temperature: 0.7, // Balanced creativity and consistency
      }
    );

    const response = result.content;

    return response.trim();
  }

  /**
   * Build LLM prompt for each section type
   */
  private buildPrompt(
    sectionType: SectionType,
    targetWords: number,
    context: WritingContext
  ): string {
    const { topic, sources, themes, citationStyle } = context;

    // Prepare source list
    const sourceSummary = sources.slice(0, 10).map((s, i) =>
      `${i + 1}. ${s.title} (${s.authors?.join(', ') || 'Unknown'}, ${s.publication_date || 'n.d.'})\n   ${s.summary.substring(0, 200)}...`
    ).join('\n\n');

    // Prepare theme list
    const themeSummary = themes.map((t, i) =>
      `${i + 1}. ${t.theme_name}: ${t.description}\n   Key insights: ${t.key_insights.join('; ')}`
    ).join('\n\n');

    switch (sectionType) {
      case 'abstract':
        return this.buildAbstractPrompt(topic, targetWords, themeSummary);

      case 'introduction':
        return this.buildIntroductionPrompt(topic, targetWords, sourceSummary, themeSummary);

      case 'literature_review':
        return this.buildLiteratureReviewPrompt(topic, targetWords, sources, themes);

      case 'methodology':
        return this.buildMethodologyPrompt(topic, targetWords, sources.length);

      case 'results':
        return this.buildResultsPrompt(topic, targetWords, themes);

      case 'discussion':
        return this.buildDiscussionPrompt(topic, targetWords, themes);

      case 'conclusion':
        return this.buildConclusionPrompt(topic, targetWords, themes);

      case 'appendices':
        return this.buildAppendicesPrompt(topic, sources);

      default:
        throw new Error(`Unknown section type: ${sectionType}`);
    }
  }

  // ==========================================================================
  // SECTION-SPECIFIC PROMPTS
  // ==========================================================================

  private buildAbstractPrompt(topic: string, targetWords: number, themeSummary: string): string {
    return `You are writing the ABSTRACT for a graduate-level research report.

TOPIC: ${topic}

IDENTIFIED THEMES:
${themeSummary}

TASK:
Write a comprehensive abstract (~${targetWords} words) that includes:

1. **Background** (2-3 sentences): Establish the importance and context of this research topic
2. **Objectives** (1-2 sentences): What this research aims to accomplish
3. **Methods** (1-2 sentences): Brief overview of the research approach (literature review, synthesis)
4. **Key Findings** (3-4 sentences): Summarize the main themes and insights discovered
5. **Conclusions** (1-2 sentences): Significance and implications of the findings

REQUIREMENTS:
- Write in formal academic tone
- Use third person perspective
- Be concise and information-dense
- No citations in the abstract
- Focus on what was found, not just what was studied
- Target exactly ${targetWords} words (±50 words acceptable)

Write ONLY the abstract content, no headings or labels.`;
  }

  private buildIntroductionPrompt(topic: string, targetWords: number, sourceSummary: string, themeSummary: string): string {
    return `You are writing the INTRODUCTION section of a graduate-level research report.

TOPIC: ${topic}

KEY SOURCES:
${sourceSummary}

IDENTIFIED THEMES:
${themeSummary}

TASK:
Write a comprehensive Introduction (~${targetWords} words) with these subsections:

## 1.1 Background and Context (40% of word count)
- Establish why this topic matters
- Provide historical context if relevant
- Explain the current state of the field
- Build from general to specific

## 1.2 Research Questions (20% of word count)
State 2-3 specific research questions this report addresses, such as:
- What are the key themes in current research on [topic]?
- What contradictions or debates exist in the literature?
- What gaps remain in current understanding?

## 1.3 Objectives (20% of word count)
Clearly state what this research aims to accomplish:
- Synthesize existing research
- Identify patterns and themes
- Analyze methodological approaches
- Highlight future research directions

## 1.4 Report Structure (20% of word count)
Provide a roadmap of the remaining sections

REQUIREMENTS:
- Formal academic tone (no contractions, no first person)
- Smooth transitions between subsections
- Use placeholder citations like [Smith 2024] or [Author Year] - we'll format later
- Cite sources where appropriate to establish credibility
- Build a compelling case for why this research matters
- Target ${targetWords} words total

Write the complete Introduction section with markdown subsection headings (###).`;
  }

  private buildLiteratureReviewPrompt(topic: string, targetWords: number, sources: any[], themes: any[]): string {
    const themesWithSources = themes.map((theme, i) => {
      const supportingSources = theme.supporting_sources || [];
      const relevantSources = sources.filter(s => supportingSources.includes(s.id));

      return `### Theme ${i + 1}: ${theme.theme_name}
${theme.description}

Supporting Sources:
${relevantSources.map(s => `- ${s.title} (${s.authors?.join(', ') || 'Unknown'})`).join('\n')}

Key Insights:
${theme.key_insights.map(insight => `- ${insight}`).join('\n')}

${theme.contradictions.length > 0 ? `Contradictions/Debates:\n${theme.contradictions.map(c => `- ${c}`).join('\n')}` : ''}`;
    }).join('\n\n');

    return `You are writing the LITERATURE REVIEW section of a graduate-level research report.

TOPIC: ${topic}

THEMES WITH SUPPORTING EVIDENCE:
${themesWithSources}

TASK:
Write a comprehensive Literature Review (~${targetWords} words) organized by themes.

For EACH theme, create a subsection (2.1, 2.2, etc.) that includes:

1. **Introduction to Theme** (10%): What this theme represents and why it matters
2. **Critical Analysis** (60%):
   - Synthesize findings from multiple sources (don't just list them)
   - Compare and contrast different perspectives
   - Discuss methodological approaches used
   - Identify strengths and limitations of existing research
   - Highlight areas of consensus and debate
3. **Key Insights** (20%): What we learn from this body of work
4. **Gaps/Questions** (10%): What remains unclear or unstudied

After theme-based subsections, include:

## 2.X Research Gaps
Identify 3-5 significant gaps in the current literature across all themes

## 2.Y Theoretical Framework
Discuss relevant theories, models, or frameworks that inform this research

CRITICAL REQUIREMENTS:
- **Synthesize, don't summarize**: Weave together insights from multiple sources
- **Use citations extensively**: Cite specific sources like [Author Year] throughout
- **Be critical**: Don't just report what studies found - analyze their contributions and limitations
- **Show connections**: Link ideas across sources and themes
- **Maintain academic tone**: Formal, objective, third-person
- **Avoid** listing sources like a bibliography
- **Target ${targetWords} words** total (can be ±200 words)

Write the complete Literature Review with markdown subsection headings (###).`;
  }

  private buildMethodologyPrompt(topic: string, targetWords: number, sourceCount: number): string {
    return `You are writing the METHODOLOGY section of a graduate-level research report.

TOPIC: ${topic}
SOURCES ANALYZED: ${sourceCount}

TASK:
Write a comprehensive Methodology section (~${targetWords} words) with these subsections:

## 3.1 Research Design (25%)
- Explain that this is a systematic literature review and synthesis
- Justify why this approach is appropriate for the research questions
- Note that it combines qualitative analysis with thematic synthesis

## 3.2 Data Collection Methods (30%)
Describe how sources were identified and gathered:
- Multiple academic databases (Semantic Scholar, OpenAlex, arXiv)
- Web search engines (Brave Search, Tavily)
- Search strategy and keywords used
- Total sources gathered: ${sourceCount}

## 3.3 Inclusion and Exclusion Criteria (20%)
Explain the criteria used to select sources:
- Relevance to research topic
- Publication recency (preference for recent work)
- Source credibility (peer-reviewed preferred)
- Diversity of perspectives

## 3.4 Data Analysis Approach (20%)
Describe how sources were analyzed:
- Thematic analysis methodology
- Identification of patterns and themes
- Comparative analysis across sources
- Synthesis of findings

## 3.5 Limitations (5%)
Acknowledge methodological limitations:
- Potential for selection bias
- Limited to English-language sources
- Timeframe constraints
- Absence of primary data collection

REQUIREMENTS:
- Formal academic tone
- Be specific about methods used
- Justify methodological choices
- Be transparent about limitations
- No citations needed in methodology (describing what YOU did)
- Target ${targetWords} words

Write the complete Methodology section with markdown subsection headings (###).`;
  }

  private buildResultsPrompt(topic: string, targetWords: number, themes: any[]): string {
    const themeOverview = themes.map((t, i) =>
      `${i + 1}. **${t.theme_name}**: ${t.description}\n   Evidence strength: ${t.evidence_strength}`
    ).join('\n');

    return `You are writing the RESULTS/FINDINGS section of a graduate-level research report.

TOPIC: ${topic}

IDENTIFIED THEMES:
${themeOverview}

FULL THEME DETAILS:
${JSON.stringify(themes, null, 2)}

TASK:
Write a comprehensive Results section (~${targetWords} words) that presents findings organized by theme.

For EACH theme, create a subsection (4.1, 4.2, etc.) that:
1. **States the finding**: What did the analysis reveal about this theme?
2. **Presents evidence**: Specific examples from sources [cite with Author Year]
3. **Shows patterns**: What commonalities emerged across sources?
4. **Notes variations**: How do different sources approach this differently?
5. **Quantifies when possible**: "X out of Y sources addressed...", "The majority of studies found..."

After theme-based results, include:

## 4.X Contradictions and Debates
Present any contradictory findings or ongoing debates discovered in the literature

## 4.Y Emerging Patterns
Discuss patterns that emerged across multiple themes

## 4.Z Summary of Results
Provide a concise overview of all major findings

CRITICAL REQUIREMENTS:
- **Present facts, not interpretations**: Save analysis for Discussion section
- **Be specific**: Use quotes, statistics, concrete examples
- **Cite extensively**: Every claim should reference sources [Author Year]
- **Organize clearly**: Logical flow within and between subsections
- **Use evidence hierarchy**: Present strongest evidence first
- **Quantify where possible**: How many sources? How consistent?
- **Target ${targetWords} words**

Write the complete Results section with markdown subsection headings (###).`;
  }

  private buildDiscussionPrompt(topic: string, targetWords: number, themes: any[]): string {
    return `You are writing the DISCUSSION section of a graduate-level research report.

TOPIC: ${topic}

THEMES IDENTIFIED IN RESULTS:
${themes.map((t, i) => `${i + 1}. ${t.theme_name}: ${t.description}`).join('\n')}

TASK:
Write a comprehensive Discussion section (~${targetWords} words) that INTERPRETS the findings.

Structure:

## 5.1 Interpretation of Findings (30%)
For each major theme:
- What do these findings MEAN?
- Why are they significant?
- How do they advance our understanding?

## 5.2 Relationship to Existing Literature (25%)
- How do findings confirm or challenge previous work?
- What new perspectives emerged?
- How does this synthesis contribute to the field?

## 5.3 Theoretical Implications (20%)
- What do findings suggest about underlying theories?
- Do they support or challenge existing frameworks?
- What new theoretical insights emerged?

## 5.4 Practical Implications (15%)
- What are the real-world applications?
- Who should care about these findings and why?
- What actions or changes might these findings suggest?

## 5.5 Unexpected Findings (10%)
- What surprising patterns or insights emerged?
- What contradictions require further investigation?
- What questions remain unanswered?

CRITICAL REQUIREMENTS:
- **This is analysis, not just summary**: Interpret, explain, connect
- **Go beyond the obvious**: Provide insights, not just restatements
- **Connect to broader context**: How do findings relate to larger issues?
- **Be critical but balanced**: Discuss strengths AND limitations
- **Cite thoughtfully**: Reference findings [cite as needed]
- **Maintain academic objectivity**: Avoid overstating conclusions
- **Target ${targetWords} words**

Write the complete Discussion section with markdown subsection headings (###).`;
  }

  private buildConclusionPrompt(topic: string, targetWords: number, themes: any[]): string {
    return `You are writing the CONCLUSION section of a graduate-level research report.

TOPIC: ${topic}

KEY THEMES:
${themes.map((t, i) => `${i + 1}. ${t.theme_name}`).join('\n')}

TASK:
Write a comprehensive Conclusion section (~${targetWords} words) that provides closure.

Structure:

## 6.1 Summary of Key Findings (30%)
- Recap the most important discoveries (DON'T just list themes)
- Emphasize the 2-3 most significant insights
- Show how findings address the research questions

## 6.2 Contribution to the Field (20%)
- How does this research advance understanding of ${topic}?
- What new perspectives or syntheses were achieved?
- Why does this work matter?

## 6.3 Recommendations for Future Research (30%)
Based on findings and gaps, suggest 3-5 specific directions for future study:
- What questions remain unanswered?
- What new questions emerged from this research?
- What methodological approaches would be valuable?
- What topics deserve deeper investigation?

## 6.4 Final Remarks (20%)
- Broader implications of this work
- Closing thoughts on the significance of ${topic}
- Forward-looking perspective

CRITICAL REQUIREMENTS:
- **No new information**: Only synthesize what was already presented
- **Be conclusive, not tentative**: State findings with appropriate confidence
- **Forward-looking**: Point toward future directions
- **Impactful closing**: End with a memorable final statement
- **Concise and focused**: Every sentence adds value
- **Few or no citations**: This is your synthesis
- **Target ${targetWords} words**

Write the complete Conclusion section with markdown subsection headings (###).`;
  }

  private buildAppendicesPrompt(topic: string, sources: any[]): string {
    return `You are writing the APPENDICES section of a graduate-level research report.

TOPIC: ${topic}

Create appendices with:

## Appendix A: Search Strategy and Terms
List the search terms and database strategies used:
- Primary keywords
- Boolean operators used
- Databases searched (Semantic Scholar, OpenAlex, arXiv, Brave, Tavily)
- Date range

## Appendix B: Source Evaluation Criteria
Describe the credibility scoring system (1-10 scale):
- Citation count
- Publication venue
- Recency
- Peer review status

## Appendix C: Thematic Analysis Framework
Briefly explain how themes were identified and validated

Keep this section brief (~200-300 words total). Use clear, concise language.

Write the complete Appendices section with markdown headings (##).`;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
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
      agent_type: 'writing',
      action,
      details,
      success: true,
    });
  }
}
