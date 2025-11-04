/**
 * API Routes for SQL Agent Query Execution
 */

import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  queryExecutorService,
  type QueryExecutionOptions,
} from '../../services/sql/query-executor.js';
import { queryGeneratorService } from '../../services/sql/query-generator.js';
import { connectionManager } from '../../services/sql/connection-manager.js';
import { log } from '../../lib/logger.js';

const router = express.Router();

/**
 * POST /api/sql-queries/execute
 * Execute a natural language query
 */
router.post('/execute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId, question, timeout, maxRows, dryRun } = req.body;

    // Validate input
    if (!connectionId || !question) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: connectionId, question',
      });
    }

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const options: QueryExecutionOptions = {
      timeout,
      maxRows,
      dryRun,
    };

    const result = await queryExecutorService.executeNaturalLanguageQuery(
      userId,
      connectionId,
      question,
      options
    );

    res.json(result);
  } catch (error) {
    log.error('Failed to execute natural language query', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute query',
    });
  }
});

/**
 * POST /api/sql-queries/execute-sql
 * Execute a raw SQL query (with safety checks)
 */
router.post('/execute-sql', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId, sql, timeout, maxRows } = req.body;

    // Validate input
    if (!connectionId || !sql) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: connectionId, sql',
      });
    }

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const options: QueryExecutionOptions = {
      timeout,
      maxRows,
    };

    const result = await queryExecutorService.executeSQLQuery(
      userId,
      connectionId,
      sql,
      options
    );

    res.json(result);
  } catch (error) {
    log.error('Failed to execute SQL query', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute query',
    });
  }
});

/**
 * POST /api/sql-queries/generate
 * Generate SQL from natural language (without executing)
 */
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId, question } = req.body;

    // Validate input
    if (!connectionId || !question) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: connectionId, question',
      });
    }

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const result = await queryGeneratorService.generateQuery(
      userId,
      connectionId,
      question,
      { dryRun: true }
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to generate SQL query', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate query',
    });
  }
});

/**
 * POST /api/sql-queries/explain
 * Explain a SQL query in natural language
 */
router.post('/explain', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId, sql } = req.body;

    // Validate input
    if (!connectionId || !sql) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: connectionId, sql',
      });
    }

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const explanation = await queryGeneratorService.explainQuery(sql, connection.dbType);

    res.json({
      success: true,
      explanation,
    });
  } catch (error) {
    log.error('Failed to explain query', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to explain query',
    });
  }
});

/**
 * POST /api/sql-queries/validate
 * Validate a SQL query (syntax check)
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId, sql } = req.body;

    // Validate input
    if (!connectionId || !sql) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: connectionId, sql',
      });
    }

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const result = queryGeneratorService.validateQuery(sql, connection.dbType);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Failed to validate query', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate query',
    });
  }
});

/**
 * GET /api/sql-queries/history/:connectionId
 * Get query history for a connection
 */
router.get('/history/:connectionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId } = req.params;
    const { limit } = req.query;

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    const history = await queryExecutorService.getQueryHistory(userId, connectionId, limitNum);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    log.error('Failed to get query history', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get query history',
    });
  }
});

/**
 * DELETE /api/sql-queries/history/:connectionId
 * Clear query history for a connection
 */
router.delete('/history/:connectionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { connectionId } = req.params;

    // Verify connection exists and belongs to user
    const connection = await connectionManager.getConnection(userId, connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    await queryExecutorService.clearQueryHistory(userId, connectionId);

    res.json({
      success: true,
    });
  } catch (error) {
    log.error('Failed to clear query history', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear query history',
    });
  }
});

export default router;
