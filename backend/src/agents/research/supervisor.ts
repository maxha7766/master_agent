/**
 * Supervisor Agent
 * Orchestrates the entire graduate-level research process
 * Coordinates: Research → Analysis → Writing → Assembly
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { SourceManager, type ResearchSource } from '../../services/research/source-manager.js';
import { AnalysisAgent } from './analysis-agent.js';
import { WritingAgent } from './writing-agent.js';
import { ReportAssembler } from '../../services/research/report-assembler.js';

export interface ResearchOptions {
  wordCountTarget?: number; // 5000-10000
  citationStyle?: 'APA' | 'MLA' | 'Chicago';
  emphasize?: string[]; // Optional aspects to focus on
}

export interface ProjectStatus {
  id: string;
  topic: string;
  status: 'planning' | 'researching' | 'analyzing' | 'writing' | 'complete' | 'failed';
  progress: {
    sourcesGathered: number;
    themesIdentified: number;
    sectionsWritten: number;
    totalWordCount: number;
  };
  finalReport?: string;
  error?: string;
}

export class SupervisorAgent {
  private sourceManager: SourceManager;
  private analysisAgent: AnalysisAgent;
  private writingAgent: WritingAgent;
  private reportAssembler: ReportAssembler;

  constructor() {
    this.sourceManager = new SourceManager();
    this.analysisAgent = new AnalysisAgent();
    this.writingAgent = new WritingAgent();
    this.reportAssembler = new ReportAssembler();
  }

  /**
   * Create a new research project
   */
  async createResearchProject(
    topic: string,
    userId: string,
    options: ResearchOptions = {}
  ): Promise<string> {
    const {
      wordCountTarget = 7500,
      citationStyle = 'APA',
      emphasize = [],
    } = options;

    // Validate inputs
    if (!topic || topic.trim().length === 0) {
      throw new Error('Topic is required');
    }

    if (wordCountTarget < 5000 || wordCountTarget > 10000) {
      throw new Error('Word count target must be between 5,000 and 10,000');
    }

    // Create project in database
    const { data: project, error } = await supabase
      .from('research_projects')
      .insert({
        user_id: userId,
        topic: topic.trim(),
        status: 'planning',
        word_count_target: wordCountTarget,
        citation_style: citationStyle,
        metadata: {
          emphasize,
          created_by: 'supervisor_agent',
        },
      })
      .select()
      .single();

    if (error || !project) {
      throw new Error(`Failed to create project: ${error?.message}`);
    }

    // Log creation
    await this.logAction(project.id, 'project_created', {
      topic,
      wordCountTarget,
      citationStyle,
    });

    log.info('Research project created', {
      projectId: project.id,
      topic,
      userId,
      wordCountTarget,
      citationStyle,
    });

    return project.id;
  }

  /**
   * Execute full research workflow
   * This is the main orchestration method
   */
  async executeFullResearch(projectId: string): Promise<void> {
    try {
      // Get project details
      const { data: project } = await supabase
        .from('research_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (!project) {
        throw new Error('Project not found');
      }

      log.info('Starting full research workflow', {
        projectId,
        topic: project.topic,
      });

      // PHASE 1: PLANNING
      await this.updateProjectStatus(projectId, 'planning');
      const domain = this.analyzeDomain(project.topic);
      await this.logAction(projectId, 'domain_analyzed', { domain });

      // PHASE 2: RESEARCH (Gather Sources)
      await this.updateProjectStatus(projectId, 'researching');
      await this.logAction(projectId, 'research_started', {
        targetSources: 12,
        domain,
      });

      const sources = await this.sourceManager.gatherSources(
        project.topic,
        domain,
        12 // Target 12 sources
      );

      // Store sources in database
      await this.storeSources(projectId, sources);

      await this.logAction(projectId, 'research_completed', {
        sourcesFound: sources.length,
        avgCredibility: sources.reduce((sum, s) => sum + s.credibility_score, 0) / sources.length,
      });

      log.info('Research phase completed', {
        projectId,
        sourcesGathered: sources.length,
      });

      // PHASE 3: ANALYSIS (Identify Themes)
      await this.updateProjectStatus(projectId, 'analyzing');
      await this.logAction(projectId, 'analysis_started', {});

      const themes = await this.analysisAgent.analyzeResearch(projectId);

      await this.logAction(projectId, 'analysis_completed', {
        themesIdentified: themes.length,
      });

      log.info('Analysis phase completed', {
        projectId,
        themesIdentified: themes.length,
      });

      // PHASE 4: WRITING (Draft Sections)
      await this.updateProjectStatus(projectId, 'writing');
      await this.logAction(projectId, 'writing_started', {
        targetWordCount: project.word_count_target,
      });

      await this.writingAgent.writeAllSections(projectId);

      await this.logAction(projectId, 'writing_completed', {});

      log.info('Writing phase completed', { projectId });

      // PHASE 5: ASSEMBLY (Compile Final Report)
      await this.logAction(projectId, 'assembly_started', {});

      const assembledReport = await this.reportAssembler.assembleReport(projectId);

      await this.logAction(projectId, 'assembly_completed', {
        finalWordCount: assembledReport.wordCount,
        sectionCount: assembledReport.sectionCount,
        citationCount: assembledReport.citationCount,
      });

      log.info('Assembly phase completed', {
        projectId,
        finalWordCount: assembledReport.wordCount,
        citationCount: assembledReport.citationCount,
      });

      // Validate final report
      const validation = await this.reportAssembler.validateReport(projectId);
      if (!validation.valid) {
        log.warn('Report validation found issues', {
          projectId,
          issues: validation.issues,
        });
        await this.logAction(projectId, 'validation_warnings', {
          issues: validation.issues,
        });
      }

      // Status is already set to 'complete' by reportAssembler.assembleReport()

      log.info('Research workflow completed', { projectId });

    } catch (error: any) {
      log.error('Research workflow failed', {
        projectId,
        error: error.message,
      });

      await this.updateProjectStatus(projectId, 'failed');
      await this.logAction(projectId, 'workflow_failed', {
        error: error.message,
      }, false, error.message);

      throw error;
    }
  }

  /**
   * Get current project status and progress
   */
  async getProjectStatus(projectId: string): Promise<ProjectStatus> {
    const { data: project } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      throw new Error('Project not found');
    }

    // Count sources
    const { count: sourcesCount } = await supabase
      .from('research_sources')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    // Count themes
    const { count: themesCount } = await supabase
      .from('research_themes')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    // Count completed sections
    const { count: sectionsCount } = await supabase
      .from('report_sections')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'final');

    // Calculate total word count
    const { data: sections } = await supabase
      .from('report_sections')
      .select('word_count')
      .eq('project_id', projectId)
      .eq('status', 'final');

    const totalWordCount = sections?.reduce((sum, s) => sum + (s.word_count || 0), 0) || 0;

    return {
      id: project.id,
      topic: project.topic,
      status: project.status,
      progress: {
        sourcesGathered: sourcesCount || 0,
        themesIdentified: themesCount || 0,
        sectionsWritten: sectionsCount || 0,
        totalWordCount,
      },
      finalReport: project.final_report,
    };
  }

  /**
   * List all projects for a user
   */
  async listUserProjects(userId: string): Promise<ProjectStatus[]> {
    const { data: projects } = await supabase
      .from('research_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!projects) return [];

    // Get status for each project
    const statuses = await Promise.all(
      projects.map(p => this.getProjectStatus(p.id))
    );

    return statuses;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Analyze topic to determine research domain
   */
  private analyzeDomain(topic: string): string {
    const lowerTopic = topic.toLowerCase();

    const domains = {
      medical: ['health', 'disease', 'medical', 'clinical', 'patient', 'diagnosis', 'treatment', 'healthcare', 'medicine'],
      tech: ['AI', 'artificial intelligence', 'machine learning', 'software', 'programming', 'algorithm', 'computer', 'technology'],
      engineering: ['engineering', 'infrastructure', 'mechanical', 'electrical', 'civil'],
      news: ['recent', 'latest', 'current', '2024', '2025', 'breaking', 'today'],
      academic: ['research', 'study', 'theory', 'analysis', 'framework'],
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => lowerTopic.includes(keyword.toLowerCase()))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Store research sources in database
   */
  private async storeSources(projectId: string, sources: ResearchSource[]): Promise<void> {
    const sourceRecords = sources.map(source => {
      // Parse publication date safely - handle relative dates like "1 day ago"
      let publicationDate = null;
      if (source.publication_date) {
        try {
          const parsed = new Date(source.publication_date);
          // Check if valid date
          if (!isNaN(parsed.getTime())) {
            publicationDate = parsed.toISOString();
          }
        } catch (e) {
          // If parsing fails, leave as null
          log.warn('Failed to parse publication date', {
            date: source.publication_date,
            source: source.title,
          });
        }
      }

      return {
        project_id: projectId,
        source_type: source.source_type,
        source_name: source.source_name,
        title: source.title,
        authors: source.authors,
        url: source.url,
        doi: 'doi' in source ? source.doi : null,
        publication_date: publicationDate,
        summary: source.summary,
        key_findings: source.key_findings,
        credibility_score: source.credibility_score,
        citation_count: 'citation_count' in source ? source.citation_count : 0,
        citation_info: source.citation_info,
        full_content: 'full_content' in source ? source.full_content : null,
      };
    });

    const { error } = await supabase
      .from('research_sources')
      .insert(sourceRecords);

    if (error) {
      throw new Error(`Failed to store sources: ${error.message}`);
    }

    log.info('Sources stored in database', {
      projectId,
      count: sources.length,
    });
  }

  /**
   * Update project status
   */
  private async updateProjectStatus(
    projectId: string,
    status: 'planning' | 'researching' | 'analyzing' | 'writing' | 'complete' | 'failed'
  ): Promise<void> {
    const { error } = await supabase
      .from('research_projects')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to update status: ${error.message}`);
    }

    log.info('Project status updated', { projectId, status });
  }

  /**
   * Log agent action
   */
  private async logAction(
    projectId: string,
    action: string,
    details: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await supabase.from('agent_logs').insert({
      project_id: projectId,
      agent_type: 'supervisor',
      action,
      details,
      success,
      error_message: errorMessage,
    });
  }
}
