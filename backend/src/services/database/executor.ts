/**
 * SQL Executor Service
 * Executes validated SQL queries with timeouts and row limits
 */

import { QueryResult } from 'pg';
import { databaseConnector, ConnectionConfig } from './connector.js';
import { validateQuery, sanitizeQuery, ValidationResult } from './validator.js';
import { log } from '../../lib/logger.js';

const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds
const DEFAULT_ROW_LIMIT = 1000; // Maximum 1000 rows

export interface ExecutionOptions {
  timeoutMs?: number;
  rowLimit?: number;
  validateQuery?: boolean; // Default true
}

export interface ExecutionResult {
  success: boolean;
  rows?: any[];
  rowCount: number;
  columnCount: number;
  columns?: Array<{ name: string; dataTypeID: number }>;
  executionTimeMs: number;
  query: string;
  error?: string;
  validation?: ValidationResult;
  limited?: boolean; // True if results were limited
}

/**
 * Execute a SQL query with validation, timeout, and row limits
 * @param config - Database connection configuration
 * @param query - SQL query to execute
 * @param options - Execution options
 * @returns Execution result
 */
export async function executeQuery(
  config: ConnectionConfig,
  query: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();

  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    rowLimit = DEFAULT_ROW_LIMIT,
    validateQuery: shouldValidate = true,
  } = options;

  try {
    // Sanitize query
    const sanitizedQuery = sanitizeQuery(query);

    // Validate query if enabled
    let validation: ValidationResult | undefined;
    if (shouldValidate) {
      validation = validateQuery(sanitizedQuery, config.userId);

      if (!validation.isValid) {
        log.warn('Query validation failed', {
          connectionId: config.id,
          userId: config.userId,
          errors: validation.errors,
          query: sanitizedQuery.substring(0, 200),
        });

        return {
          success: false,
          rowCount: 0,
          columnCount: 0,
          executionTimeMs: Date.now() - startTime,
          query: sanitizedQuery,
          error: `Query validation failed: ${validation.errors.join(', ')}`,
          validation,
        };
      }
    }

    // Apply row limit by wrapping query
    // Use LIMIT if not already present
    const limitedQuery = applyRowLimit(sanitizedQuery, rowLimit);

    // Execute query with timeout
    log.info('Executing SQL query', {
      connectionId: config.id,
      userId: config.userId,
      timeoutMs,
      rowLimit,
      queryLength: limitedQuery.length,
    });

    const result: QueryResult = await databaseConnector.executeQuery(
      config.id,
      limitedQuery,
      [],
      timeoutMs
    );

    const executionTimeMs = Date.now() - startTime;

    // Check if results were limited
    const limited = result.rowCount >= rowLimit;

    // Extract column information
    const columns = result.fields.map((field) => ({
      name: field.name,
      dataTypeID: field.dataTypeID,
    }));

    log.info('Query executed successfully', {
      connectionId: config.id,
      userId: config.userId,
      rowCount: result.rowCount,
      columnCount: columns.length,
      executionTimeMs,
      limited,
    });

    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount || 0,
      columnCount: columns.length,
      columns,
      executionTimeMs,
      query: sanitizedQuery,
      validation,
      limited,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    log.error('Query execution failed', {
      connectionId: config.id,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs,
      query: query.substring(0, 200),
    });

    return {
      success: false,
      rowCount: 0,
      columnCount: 0,
      executionTimeMs,
      query: query,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute multiple queries in sequence
 * @param config - Database connection configuration
 * @param queries - Array of SQL queries
 * @param options - Execution options
 * @returns Array of execution results
 */
export async function executeQueries(
  config: ConnectionConfig,
  queries: string[],
  options: ExecutionOptions = {}
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const query of queries) {
    const result = await executeQuery(config, query, options);
    results.push(result);

    // Stop on first error
    if (!result.success) {
      log.warn('Stopping query execution due to error', {
        connectionId: config.id,
        userId: config.userId,
        completedQueries: results.length,
        totalQueries: queries.length,
      });
      break;
    }
  }

  return results;
}

/**
 * Apply row limit to a query
 * Wraps query in a subquery if LIMIT is not present
 * @param query - SQL query
 * @param limit - Row limit
 * @returns Query with limit applied
 */
function applyRowLimit(query: string, limit: number): string {
  const queryLower = query.toLowerCase().trim();

  // If query already has LIMIT, check if it's within our limit
  if (queryLower.includes('limit')) {
    // Extract existing limit
    const limitMatch = queryLower.match(/limit\s+(\d+)/);
    if (limitMatch) {
      const existingLimit = parseInt(limitMatch[1], 10);
      if (existingLimit <= limit) {
        // Existing limit is acceptable
        return query;
      }
    }

    // Replace existing limit with our limit
    return query.replace(/limit\s+\d+/i, `LIMIT ${limit}`);
  }

  // Add LIMIT to query
  // Handle queries with ORDER BY, GROUP BY, etc.
  const semicolonIndex = query.lastIndexOf(';');
  if (semicolonIndex > -1) {
    // Insert LIMIT before final semicolon
    return `${query.substring(0, semicolonIndex)} LIMIT ${limit}${query.substring(semicolonIndex)}`;
  }

  // No semicolon, just append LIMIT
  return `${query} LIMIT ${limit}`;
}

/**
 * Test a database connection
 * @param config - Database connection configuration
 * @returns true if connection successful
 */
export async function testConnection(config: ConnectionConfig): Promise<boolean> {
  try {
    const result = await executeQuery(
      config,
      'SELECT 1 as test',
      {
        timeoutMs: 3000,
        validateQuery: false,
      }
    );

    return result.success;
  } catch (error) {
    log.error('Connection test failed', {
      connectionId: config.id,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get table row count
 * @param config - Database connection configuration
 * @param tableName - Table name (with optional schema)
 * @returns Row count or null if failed
 */
export async function getTableRowCount(
  config: ConnectionConfig,
  tableName: string
): Promise<number | null> {
  try {
    const result = await executeQuery(
      config,
      `SELECT COUNT(*) as count FROM ${tableName}`,
      {
        timeoutMs: 10000, // 10 seconds for count
        validateQuery: true,
      }
    );

    if (result.success && result.rows && result.rows.length > 0) {
      return parseInt(result.rows[0].count, 10);
    }

    return null;
  } catch (error) {
    log.error('Failed to get table row count', {
      connectionId: config.id,
      userId: config.userId,
      tableName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Preview table data (first N rows)
 * @param config - Database connection configuration
 * @param tableName - Table name (with optional schema)
 * @param limit - Number of rows to preview (default 10)
 * @returns Execution result with preview data
 */
export async function previewTable(
  config: ConnectionConfig,
  tableName: string,
  limit: number = 10
): Promise<ExecutionResult> {
  return executeQuery(
    config,
    `SELECT * FROM ${tableName}`,
    {
      timeoutMs: 5000,
      rowLimit: Math.min(limit, 100), // Max 100 rows for preview
      validateQuery: true,
    }
  );
}
