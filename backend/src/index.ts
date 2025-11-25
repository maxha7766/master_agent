/**
 * Backend Server Entry Point
 * Express HTTP server with WebSocket support
 */

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { corsMiddleware } from './api/middleware/cors.js';
import { rateLimitMiddleware } from './api/middleware/rateLimit.js';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './api/middleware/logging.js';
import { authRouter } from './api/routes/auth.js';
import { conversationsRouter } from './api/routes/conversations.js';
import { documentsRouter } from './api/routes/documents.js';
import databaseConnectionsRouter from './api/routes/database-connections.js';
import sqlConnectionsRouter from './api/routes/sql-connections.js';
import sqlQueriesRouter from './api/routes/sql-queries.js';
import researchRouter from './api/routes/research.js';
import settingsRouter from './api/routes/settings.js';
import usageRouter from './api/routes/usage.js';
import memoriesRouter from './routes/memories.js';
import { wsManager } from './websocket/server.js';
import { log } from './lib/logger.js';
import { AppError } from './lib/errors.js';

// Validate environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();
const httpServer = createServer(app);

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(corsMiddleware);
app.use(requestLoggingMiddleware);
app.use(rateLimitMiddleware);

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/database-connections', databaseConnectionsRouter);
app.use('/api/sql-connections', sqlConnectionsRouter);
app.use('/api/sql-queries', sqlQueriesRouter);
app.use('/api/research', researchRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/usage', usageRouter);
app.use('/api/memories', memoriesRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      name: 'NotFoundError',
      message: `Route not found: ${req.method} ${req.path}`,
    },
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use(errorLoggingMiddleware);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Handle known application errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        name: error.name,
        message: error.message,
      },
    });
  }

  // Handle validation errors from libraries
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        name: 'ValidationError',
        message: error.message,
      },
    });
  }

  // Handle unknown errors
  log.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
  });

  return res.status(500).json({
    error: {
      name: 'InternalServerError',
      message: 'An unexpected error occurred',
    },
  });
});

// ============================================================================
// WebSocket Server
// ============================================================================

wsManager.initialize(httpServer);

// ============================================================================
// Server Lifecycle
// ============================================================================

httpServer.listen(PORT, () => {
  log.info('Server started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    wsEnabled: true,
  });
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket available on ws://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  log.info('Shutting down server...');

  // Stop accepting new connections
  httpServer.close(() => {
    log.info('HTTP server closed');
  });

  // Close WebSocket connections
  await wsManager.shutdown();

  log.info('Server shut down complete');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection', {
    reason,
    promise,
  });
});
