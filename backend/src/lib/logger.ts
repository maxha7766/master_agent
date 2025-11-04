import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';
const logDir = process.env.LOG_DIR || 'logs';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured logger using Winston
 * Logs in JSON format for easy parsing and analysis
 * In production, logs are also written to rotating files
 */

// Create transports array
const transports: winston.transport[] = [
  // Console transport (always enabled)
  new winston.transports.Console({
    stderrLevels: ['error'],
  }),
];

// Add file transports in production
if (isProduction) {
  // Combined log (all levels)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'info',
    })
  );

  // Error log (errors only)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d', // Keep error logs longer
      level: 'error',
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format:
    logFormat === 'json'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
          })
        ),
  transports,
});

/**
 * Log context interface for structured logging
 */
export interface LogContext {
  event?: string;
  userId?: string;
  userEmail?: string;
  conversationId?: string;
  messageId?: string;
  documentId?: string;
  requestId?: string;
  agent?: string;
  model?: string;
  latencyMs?: number;
  tokens?: number;
  cost?: number;
  error?: Error | string;
  errorCode?: string;
  errorStack?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Error severity levels for categorization
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Structured logging helpers with enhanced error handling
 */
export const log = {
  info: (message: string, context?: LogContext) => {
    logger.info(message, sanitizeContext(context));
  },

  warn: (message: string, context?: LogContext) => {
    logger.warn(message, sanitizeContext(context));
  },

  error: (message: string, context?: LogContext) => {
    const enrichedContext = enrichErrorContext(context);
    logger.error(message, sanitizeContext(enrichedContext));
  },

  debug: (message: string, context?: LogContext) => {
    logger.debug(message, sanitizeContext(context));
  },

  /**
   * Log an API request
   */
  request: (method: string, endpoint: string, context?: LogContext) => {
    logger.info(`API Request: ${method} ${endpoint}`, {
      ...context,
      method,
      endpoint,
      event: 'api_request',
    });
  },

  /**
   * Log an API response
   */
  response: (
    method: string,
    endpoint: string,
    statusCode: number,
    latencyMs: number,
    context?: LogContext
  ) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[level](`API Response: ${method} ${endpoint} ${statusCode}`, {
      ...context,
      method,
      endpoint,
      statusCode,
      latencyMs,
      event: 'api_response',
    });
  },
};

/**
 * Sanitize log context to remove sensitive data
 */
function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const sanitized = { ...context };

  // List of sensitive field patterns to scrub
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /private[_-]?key/i,
  ];

  // Scrub sensitive fields
  Object.keys(sanitized).forEach((key) => {
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Enrich error context with additional metadata
 */
function enrichErrorContext(context?: LogContext): LogContext {
  const enriched = { ...context };

  // Extract error stack if error is an Error object
  if (context?.error instanceof Error) {
    enriched.errorStack = context.error.stack;
    enriched.error = context.error.message;
  }

  // Add timestamp
  enriched.timestamp = new Date().toISOString();

  // Add environment
  enriched.environment = process.env.NODE_ENV || 'development';

  return enriched;
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default logger;
