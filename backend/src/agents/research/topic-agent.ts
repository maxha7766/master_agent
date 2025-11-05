/**
 * Topic Research Agent
 * Main orchestrator for web topic research
 */
import { supabase } from '../../models/database.js';
import { TopicClarifier } from './topic-clarifier.js';
import { TopicSynthesizer } from './topic-synthesizer.js';
import { MultiSearchService } from '../../services/research/multi-search.js';
import { FirecrawlService } from '../../services/research/firecrawl.js';
import { documentProcessor } from '../../services/documents/processor.js';
import { log } from '../../lib/logger.js';

export class TopicResearchAgent {
  private clarifier = new TopicClarifier();
  private synthesizer = new TopicSynthesizer();
  private multiSearch = new MultiSearchService();
  private firecrawl = new FirecrawlService();

  async executeTopicResearch(
    userId: string,
    topic: string,
    numSources: number = 10
  ): Promise<string> {
    log.info('Topic research started', { userId, topic, numSources });

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('research_projects')
      .insert({
        user_id: userId,
        topic,
        research_type: 'topic',
        status: 'researching',
        num_sources_requested: numSources,
      })
      .select()
      .single();

    if (projectError) {
      log.error('Failed to create research project', { error: projectError.message });
      throw projectError;
    }

    const projectId = project.id;

    try {
      // Phase 1: Clarify topic
      log.info('Phase 1: Clarifying topic', { projectId });
      const clarified = await this.clarifier.clarify(topic);

      // Phase 2: Multi-source search
      log.info('Phase 2: Multi-source search', { projectId, searchQuery: clarified.searchQuery });
      const { results: searchResults, enginesUsed } = await this.multiSearch.searchWithFallback(
        clarified.searchQuery,
        numSources
      );

      // Update search engines used
      await supabase
        .from('research_projects')
        .update({ search_engines_used: enginesUsed })
        .eq('id', projectId);

      // Store sources in database
      for (const result of searchResults) {
        await supabase.from('research_sources').insert({
          project_id: projectId,
          source_type: 'web',
          source_name: result.source,
          title: result.title,
          url: result.url,
          summary: result.snippet,
          credibility_score: Math.round(result.score),
          publication_date: result.publishDate || null,
          author: result.author || null,
        });
      }

      log.info('Sources stored', { projectId, count: searchResults.length });

      // Phase 3: Content extraction (top 50% of sources)
      log.info('Phase 3: Content extraction', { projectId });
      const topSources = searchResults.slice(0, Math.ceil(numSources / 2));
      const extractedContent = await this.firecrawl.extractMultiple(
        topSources.map(s => s.url)
      );

      await supabase
        .from('research_projects')
        .update({ content_extraction_count: extractedContent.size })
        .eq('id', projectId);

      log.info('Content extracted', {
        projectId,
        attempted: topSources.length,
        successful: extractedContent.size
      });

      // Phase 4: Synthesize
      log.info('Phase 4: Synthesizing report', { projectId });
      await this.updateStatus(projectId, 'writing');

      const sourcesForSynthesis = topSources.map(s => ({
        title: s.title,
        url: s.url,
        content: extractedContent.get(s.url) || s.snippet,
        sourceEngine: s.source,
      }));

      const markdown = await this.synthesizer.synthesize({
        topic,
        subtopics: clarified.subtopics,
        sources: sourcesForSynthesis,
      });

      // Save final report
      const wordCount = markdown.split(/\s+/).length;
      await supabase
        .from('research_projects')
        .update({
          final_report: markdown,
          final_word_count: wordCount,
          status: 'complete',
        })
        .eq('id', projectId);

      log.info('Report saved', { projectId, wordCount });

      // Phase 5: Ingest to RAG
      log.info('Phase 5: Ingesting to RAG', { projectId });
      await this.ingestToRAG(userId, topic, markdown, projectId);

      log.info('Topic research completed', {
        projectId,
        wordCount,
        sources: searchResults.length,
        extracted: extractedContent.size
      });

      return projectId;

    } catch (error) {
      log.error('Topic research failed', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });

      await this.updateStatus(projectId, 'failed');
      await supabase
        .from('research_projects')
        .update({
          metadata: {
            error: error instanceof Error ? error.message : String(error)
          }
        })
        .eq('id', projectId);

      throw error;
    }
  }

  private async updateStatus(projectId: string, status: string) {
    await supabase
      .from('research_projects')
      .update({ status })
      .eq('id', projectId);
  }

  private async ingestToRAG(
    userId: string,
    topic: string,
    markdown: string,
    projectId: string
  ) {
    try {
      // Check for existing document with same topic (for versioning)
      const titlePattern = `Knowledge Base: ${topic}`;
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId)
        .ilike('title', `%${topic}%`)
        .eq('file_type', 'md');

      // Delete old version if exists
      if (existingDocs && existingDocs.length > 0) {
        log.info('Deleting old version of topic research', {
          projectId,
          oldDocIds: existingDocs.map(d => d.id)
        });

        for (const doc of existingDocs) {
          await supabase.from('documents').delete().eq('id', doc.id);
        }
      }

      // Create new document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_name: `Knowledge Base - ${topic}.md`,
          file_type: 'md',
          file_size: Buffer.byteLength(markdown),
          file_url: `internal://topic-research/${projectId}`,
          status: 'processing',
          title: `Knowledge Base: ${topic}`,
        })
        .select()
        .single();

      if (docError) {
        throw docError;
      }

      // Process markdown with existing document processor
      await documentProcessor.processDocument(
        doc.id,
        userId,
        markdown,
        `Knowledge Base - ${topic}.md`
      );

      log.info('RAG ingestion completed', {
        projectId,
        documentId: doc.id
      });
    } catch (error) {
      log.error('RAG ingestion failed', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - research is still successful even if RAG ingestion fails
    }
  }
}

// Singleton instance
export const topicResearchAgent = new TopicResearchAgent();
