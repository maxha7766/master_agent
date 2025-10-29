import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

/**
 * Structured logger using Winston
 * Logs in JSON format for easy parsing and analysis
 */
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
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

/**
 * Log context interface for structured logging
 */
export interface LogContext {
  event?: string;
  userId?: string;
  conversationId?: string;
  agent?: string;
  model?: string;
  latencyMs?: number;
  tokens?: number;
  error?: Error | string;
  [key: string]: unknown;
}

/**
 * Structured logging helpers
 */
export const log = {
  info: (message: string, context?: LogContext) => {
    logger.info(message, context);
  },

  warn: (message: string, context?: LogContext) => {
    logger.warn(message, context);
  },

  error: (message: string, context?: LogContext) => {
    logger.error(message, context);
  },

  debug: (message: string, context?: LogContext) => {
    logger.debug(message, context);
  },
};

export default logger;
