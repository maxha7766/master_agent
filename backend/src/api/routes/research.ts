/**
 * Research API Routes
 * Handles web research requests using Tavily and Brave Search
 * Generates markdown reports and uploads to RAG system
 */

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { log } from '../../lib/logger.js';
import { ResearchAgent } from '../../agents/research/index.js';
import { SupervisorAgent } from '../../agents/research/supervisor.js';
import { supabase } from '../../models/database.js';
import { documentProcessor } from '../../services/documents/processor.js';
import crypto from 'crypto';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

interface ResearchRequest {
  query: string;
  maxResults?: number;
}

/**
 * POST /api/research
 * Execute a research query, generate markdown report, and upload to RAG
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { query, maxResults = 10 } = req.body as ResearchRequest;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (query.length > 500) {
      return res.status(400).json({ error: 'Query too long (max 500 characters)' });
    }

    if (maxResults < 1 || maxResults > 20) {
      return res.status(400).json({ error: 'maxResults must be between 1 and 20' });
    }

    log.info('Research request received', { userId, query, maxResults });

    // Step 1: Execute research
    const agent = new ResearchAgent();
    const result = await agent.executeResearch(query, maxResults);

    log.info('Research completed', {
      userId,
      query,
      sourcesFound: result.sources.length,
      domain: result.domain,
    });

    // Step 2: Generate markdown report
    const markdown = agent.generateMarkdownReport(result.query, result.sources, result.domain);

    log.info('Markdown report generated', {
      userId,
      query,
      markdownLength: markdown.length,
    });

    // Step 3: Upload markdown to documents table
    const filename = `research_${Date.now()}_${query.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.md`;
    const fileBuffer = Buffer.from(markdown, 'utf-8');
    const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Insert document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
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
      throw new Error(`Failed to create document: ${docError?.message}`);
    }

    log.info('Document record created', {
      userId,
      documentId: document.id,
      filename,
    });

    // Step 4: Process document for RAG (chunking, embeddings)
    try {
      await documentProcessor.processDocument(
        document.id,
        userId,
        markdown,
        'research-report.md'
      );

      // Update document status to completed
      await supabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', document.id);

      log.info('Document processed and added to RAG', {
        userId,
        documentId: document.id,
      });
    } catch (processError: any) {
      log.error('Document processing failed', {
        userId,
        documentId: document.id,
        error: processError,
      });

      // Update document status to failed
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', document.id);

      throw new Error(`Failed to process document: ${processError.message}`);
    }

    res.json({
      success: true,
      data: {
        ...result,
        document: {
          id: document.id,
          filename,
          title: `Research: ${query}`,
        },
        markdown,
      },
    });
  } catch (error: any) {
    log.error('Research request failed', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Research failed',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/research/summary
 * Generate a summary from research results
 */
router.post('/summary', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { query, sources } = req.body;

    if (!query || !sources || !Array.isArray(sources)) {
      return res.status(400).json({ error: 'Query and sources array required' });
    }

    log.info('Summary generation requested', { userId, query, sourceCount: sources.length });

    const agent = new ResearchAgent();
    const summary = await agent.generateSummary(query, sources);

    res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    log.error('Summary generation failed', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Summary generation failed',
      message: error.message || 'Internal server error',
    });
  }
});

// =============================================================================
// GRADUATE-LEVEL RESEARCH ENDPOINTS
// =============================================================================

/**
 * POST /api/research/graduate
 * Create a new graduate-level research project
 */
router.post('/graduate', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { topic, wordCountTarget, citationStyle, emphasize } = req.body;

    // Validate input
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (topic.length > 500) {
      return res.status(400).json({ error: 'Topic too long (max 500 characters)' });
    }

    log.info('Graduate research project creation requested', {
      userId,
      topic,
      wordCountTarget,
      citationStyle,
    });

    // Create project
    const supervisor = new SupervisorAgent();
    const projectId = await supervisor.createResearchProject(topic, userId, {
      wordCountTarget,
      citationStyle,
      emphasize,
    });

    log.info('Graduate research project created', { userId, projectId });

    // Start research workflow asynchronously (don't await)
    supervisor.executeFullResearch(projectId).catch((error) => {
      log.error('Graduate research workflow failed', {
        userId,
        projectId,
        error: error.message,
      });
    });

    res.json({
      success: true,
      projectId,
      message: 'Research project started. Check status endpoint for progress.',
    });
  } catch (error: any) {
    log.error('Graduate research project creation failed', {
      userId: req.user?.id,
      error,
    });
    res.status(500).json({
      error: 'Failed to create research project',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/research/graduate
 * List all graduate research projects for the current user
 */
router.get('/graduate', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const supervisor = new SupervisorAgent();
    const projects = await supervisor.listUserProjects(userId);

    res.json({
      success: true,
      projects,
    });
  } catch (error: any) {
    log.error('Failed to list projects', { userId: req.user?.id, error });
    res.status(500).json({
      error: 'Failed to list projects',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/research/graduate/:projectId/sources
 * Get all sources for a research project
 */
router.get('/graduate/:projectId/sources', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('research_projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get sources
    const { data: sources, error: sourcesError } = await supabase
      .from('research_sources')
      .select('*')
      .eq('project_id', projectId)
      .order('credibility_score', { ascending: false });

    if (sourcesError) {
      throw new Error(sourcesError.message);
    }

    res.json({
      success: true,
      sources: sources || [],
    });
  } catch (error: any) {
    log.error('Failed to get project sources', {
      userId: req.user?.id,
      projectId: req.params.projectId,
      error,
    });
    res.status(500).json({
      error: 'Failed to get project sources',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/research/graduate/:projectId/themes
 * Get identified themes for a research project
 */
router.get('/graduate/:projectId/themes', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('research_projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get themes
    const { data: themes, error: themesError } = await supabase
      .from('research_themes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (themesError) {
      throw new Error(themesError.message);
    }

    res.json({
      success: true,
      themes: themes || [],
    });
  } catch (error: any) {
    log.error('Failed to get project themes', {
      userId: req.user?.id,
      projectId: req.params.projectId,
      error,
    });
    res.status(500).json({
      error: 'Failed to get project themes',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/research/graduate/:projectId
 * Get project status and progress
 */
router.get('/graduate/:projectId', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const { data: project, error } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      ...project,
    });
  } catch (error: any) {
    log.error('Failed to get project status', {
      userId: req.user?.id,
      projectId: req.params.projectId,
      error,
    });
    res.status(500).json({
      error: 'Failed to get project status',
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/research/graduate/:projectId/report
 * Get the final report for a completed research project
 */
router.get('/graduate/:projectId/report', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    // Verify project belongs to user
    const { data: project, error } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (project.status !== 'complete') {
      return res.status(400).json({
        error: 'Report not ready',
        message: `Project status: ${project.status}`,
      });
    }

    if (!project.final_report) {
      return res.status(404).json({ error: 'Final report not found' });
    }

    res.json({
      success: true,
      report: {
        topic: project.topic,
        wordCount: project.final_word_count,
        citationStyle: project.citation_style,
        content: project.final_report,
        completedAt: project.updated_at,
      },
    });
  } catch (error: any) {
    log.error('Failed to get project report', {
      userId: req.user?.id,
      projectId: req.params.projectId,
      error,
    });
    res.status(500).json({
      error: 'Failed to get project report',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
