/**
 * Report Assembler
 * Compiles all report sections into a final graduate-level research report
 * Inserts citations, generates TOC, adds references, calculates word count
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { CitationManager, type Source, type CitationStyle } from './citation-manager.js';
import { documentProcessor } from '../documents/processor.js';
import crypto from 'crypto';

export interface AssembledReport {
  fullReport: string;
  wordCount: number;
  sectionCount: number;
  citationCount: number;
}

export class ReportAssembler {
  private citationManager: CitationManager;

  constructor() {
    this.citationManager = new CitationManager();
  }

  /**
   * Assemble the complete final report from all sections
   */
  async assembleReport(projectId: string): Promise<AssembledReport> {
    log.info('Starting report assembly', { projectId });

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    // Get all finalized sections in order
    const { data: sections, error: sectionsError } = await supabase
      .from('report_sections')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'final')
      .order('section_number', { ascending: true });

    if (sectionsError || !sections || sections.length === 0) {
      throw new Error('No finalized sections found to assemble');
    }

    // Get all sources for citations
    const { data: sources, error: sourcesError } = await supabase
      .from('research_sources')
      .select('*')
      .eq('project_id', projectId)
      .order('title', { ascending: true });

    if (sourcesError || !sources) {
      throw new Error('Failed to retrieve sources for citations');
    }

    log.info('Retrieved sections and sources', {
      projectId,
      sectionCount: sections.length,
      sourceCount: sources.length,
    });

    // Convert database sources to Citation Source format
    const citationSources: Source[] = sources.map(s => ({
      title: s.title,
      authors: s.authors || [],
      publication_date: s.publication_date || undefined,
      url: s.url || undefined,
      doi: s.doi || undefined,
      source_type: s.source_type,
      citation_info: s.citation_info || {},
    }));

    const citationStyle = project.citation_style as CitationStyle;

    // Build the complete report
    let fullReport = '';

    // Add title
    fullReport += `# ${project.topic}\n\n`;
    fullReport += `**Graduate-Level Research Report**\n\n`;
    fullReport += `**Citation Style**: ${citationStyle}\n\n`;
    fullReport += `**Generated**: ${new Date().toLocaleDateString()}\n\n`;
    fullReport += `---\n\n`;

    // Generate Table of Contents
    const toc = this.generateTableOfContents(sections);
    fullReport += toc;
    fullReport += `\n---\n\n`;

    // Assemble sections in order
    for (const section of sections) {
      const sectionContent = await this.processSectionContent(
        section,
        citationSources,
        citationStyle
      );
      fullReport += sectionContent;
      fullReport += `\n\n`;
    }

    // Generate and append References section
    const referencesSection = await this.citationManager.generateReferenceList(
      citationSources,
      citationStyle
    );
    fullReport += referencesSection;
    fullReport += `\n\n`;

    // Calculate final statistics
    const wordCount = this.countWords(fullReport);
    const citationCount = this.countCitations(fullReport, citationStyle);

    // Store final report in database
    const { error: updateError } = await supabase
      .from('research_projects')
      .update({
        final_report: fullReport,
        final_word_count: wordCount,
        status: 'complete',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      throw new Error(`Failed to store final report: ${updateError.message}`);
    }

    log.info('Report assembled successfully', {
      projectId,
      wordCount,
      sectionCount: sections.length,
      citationCount,
    });

    // Upload report to RAG system for chat queries
    try {
      const filename = `graduate_research_${project.topic.substring(0, 50).replace(/[^a-z0-9]/gi, '_')}.md`;
      const fileBuffer = Buffer.from(fullReport, 'utf-8');
      const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Insert document record
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: project.user_id,
          file_name: filename,
          file_type: 'text/markdown',
          file_size: fileBuffer.length,
          file_url: '',
          content_hash: contentHash,
          status: 'processing',
        })
        .select()
        .single();

      if (docError || !document) {
        log.error('Failed to create document for RAG', { projectId, error: docError });
      } else {
        // Process document for RAG (chunking, embeddings)
        // Pass string content, not Buffer
        await documentProcessor.processDocument(
          document.id,
          project.user_id,
          fullReport,
          filename
        );

        log.info('Graduate research report added to RAG', {
          projectId,
          documentId: document.id,
        });
      }
    } catch (ragError) {
      // Don't fail the whole operation if RAG upload fails
      log.error('Failed to add report to RAG', { projectId, error: ragError });
    }

    return {
      fullReport,
      wordCount,
      sectionCount: sections.length,
      citationCount,
    };
  }

  /**
   * Generate Table of Contents from sections
   */
  private generateTableOfContents(sections: any[]): string {
    let toc = '## Table of Contents\n\n';

    sections.forEach((section, index) => {
      const title = section.section_name; // Use actual section name from database
      const sectionNum = index + 1;
      const anchor = title.toLowerCase().replace(/\s+/g, '-');
      toc += `${sectionNum}. [${title}](#${anchor})\n`;
    });

    return toc;
  }

  /**
   * Process a section's content with citation insertion
   */
  private async processSectionContent(
    section: any,
    sources: Source[],
    citationStyle: CitationStyle
  ): Promise<string> {
    let content = '';

    // Add section header with proper anchor
    const title = section.section_name;
    const anchor = title.toLowerCase().replace(/\s+/g, '-');
    content += `## ${title} {#${anchor}}\n\n`;

    // Insert citations into section content
    const contentWithCitations = await this.citationManager.insertCitations(
      section.content || '',
      sources,
      citationStyle
    );

    content += contentWithCitations;

    return content;
  }

  /**
   * Count words in the report
   */
  private countWords(text: string): number {
    // Remove markdown syntax for accurate count
    const cleanText = text
      .replace(/#+\s/g, '') // Remove headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/`[^`]+`/g, '') // Remove code
      .trim();

    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Count citations in the report
   */
  private countCitations(text: string, citationStyle: CitationStyle): number {
    // Different patterns for different styles
    let pattern: RegExp;

    switch (citationStyle) {
      case 'APA':
        // Matches: (Author, Year) or (Author et al., Year)
        pattern = /\([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+|\s+et\s+al\.)?,\s+\d{4}\)/g;
        break;

      case 'MLA':
        // Matches: (Author) or (Author and Author)
        pattern = /\([A-Z][a-z]+(?:\s+(?:and|et\s+al\.)(?:\s+[A-Z][a-z]+)?)?\)/g;
        break;

      case 'Chicago':
        // Matches: (Author Year) or (Author and Author Year)
        pattern = /\([A-Z][a-z]+(?:\s+(?:and|et\s+al\.)(?:\s+[A-Z][a-z]+)?)?\s+\d{4}\)/g;
        break;

      default:
        pattern = /\([A-Z][a-z]+.*?\d{4}\)/g;
    }

    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * Validate report completeness
   */
  async validateReport(projectId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check all required sections exist
    const requiredSections = [
      'abstract',
      'introduction',
      'literature_review',
      'methodology',
      'results',
      'discussion',
      'conclusion',
    ];

    const { data: sections } = await supabase
      .from('report_sections')
      .select('section_type')
      .eq('project_id', projectId)
      .eq('status', 'final');

    const existingSections = new Set(
      sections?.map(s => s.section_type) || []
    );

    for (const required of requiredSections) {
      if (!existingSections.has(required)) {
        issues.push(`Missing required section: ${required}`);
      }
    }

    // Check word count requirements
    const { data: project } = await supabase
      .from('research_projects')
      .select('word_count_target, final_word_count')
      .eq('id', projectId)
      .single();

    if (project) {
      const target = project.word_count_target || 7500;
      const actual = project.final_word_count || 0;

      // Allow 20% variance
      const minWords = target * 0.8;
      const maxWords = target * 1.2;

      if (actual < minWords) {
        issues.push(
          `Word count too low: ${actual} words (target: ${target})`
        );
      } else if (actual > maxWords) {
        issues.push(
          `Word count too high: ${actual} words (target: ${target})`
        );
      }
    }

    // Check for sources
    const { count: sourceCount } = await supabase
      .from('research_sources')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (!sourceCount || sourceCount < 8) {
      issues.push(`Insufficient sources: ${sourceCount || 0} (minimum: 8)`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate executive summary (for quick preview)
   */
  async generateExecutiveSummary(projectId: string): Promise<string> {
    const { data: project } = await supabase
      .from('research_projects')
      .select('topic, final_word_count')
      .eq('id', projectId)
      .single();

    const { data: abstract } = await supabase
      .from('report_sections')
      .select('content')
      .eq('project_id', projectId)
      .eq('section_type', 'abstract')
      .single();

    const { count: sourceCount } = await supabase
      .from('research_sources')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const { count: themeCount } = await supabase
      .from('research_themes')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    let summary = `# Executive Summary\n\n`;
    summary += `**Topic**: ${project?.topic}\n\n`;
    summary += `**Word Count**: ${project?.final_word_count || 0} words\n\n`;
    summary += `**Sources**: ${sourceCount || 0} research sources\n\n`;
    summary += `**Themes**: ${themeCount || 0} major themes identified\n\n`;
    summary += `## Abstract\n\n`;
    summary += abstract?.content || 'Abstract not available';

    return summary;
  }
}
