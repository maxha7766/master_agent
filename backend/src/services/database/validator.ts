/**
 * SQL Query Validator
 * Validates and sanitizes SQL queries to ensure read-only access
 * Prevents dangerous operations like DROP, DELETE, UPDATE, INSERT, etc.
 */

import { parse } from 'pgsql-ast-parser';
import { log } from '../../lib/logger.js';

/**
 * List of allowed SQL statement types (read-only operations)
 */
const ALLOWED_STATEMENT_TYPES = new Set([
  'select',
  'show',
  'explain',
  'describe',
]);

/**
 * List of dangerous SQL keywords that should never appear in queries
 */
const DANGEROUS_KEYWORDS = new Set([
  'drop',
  'delete',
  'update',
  'insert',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'execute',
  'call',
  'set',
  'reset',
  'copy',
  'load',
]);

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statementType: string | null;
  tableNames: string[];
}

/**
 * Validate a SQL query for safety
 * @param query - SQL query to validate
 * @param userId - User ID for logging
 * @returns Validation result
 */
export function validateQuery(query: string, userId?: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    statementType: null,
    tableNames: [],
  };

  try {
    // Normalize query
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      result.isValid = false;
      result.errors.push('Query cannot be empty');
      return result;
    }

    // Check for dangerous keywords using regex (case insensitive)
    const queryLower = normalizedQuery.toLowerCase();
    for (const keyword of DANGEROUS_KEYWORDS) {
      // Match keyword as whole word (not part of another word)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(queryLower)) {
        result.isValid = false;
        result.errors.push(`Dangerous keyword detected: ${keyword.toUpperCase()}`);
      }
    }

    // Check for multiple statements (prevent SQL injection)
    const semicolonCount = (normalizedQuery.match(/;/g) || []).length;
    if (semicolonCount > 1 || (semicolonCount === 1 && !normalizedQuery.endsWith(';'))) {
      result.isValid = false;
      result.errors.push('Multiple SQL statements are not allowed');
    }

    // Check for comments (can be used to hide malicious code)
    if (queryLower.includes('--') || queryLower.includes('/*')) {
      result.warnings.push('SQL comments detected - ensure query is safe');
    }

    // Parse the SQL to extract statement type and table names
    try {
      const parsed = parse(normalizedQuery);

      if (parsed.length === 0) {
        result.isValid = false;
        result.errors.push('Unable to parse SQL query');
        return result;
      }

      const statement = parsed[0];

      // Get statement type
      const statementType = statement.type.toLowerCase();
      result.statementType = statementType;

      // Check if statement type is allowed
      if (!ALLOWED_STATEMENT_TYPES.has(statementType)) {
        result.isValid = false;
        result.errors.push(
          `Statement type '${statementType.toUpperCase()}' is not allowed. Only SELECT queries are permitted.`
        );
      }

      // Extract table names from SELECT statement
      if (statementType === 'select') {
        const tableNames = extractTableNames(statement);
        result.tableNames = tableNames;
      }

      // Additional checks for SELECT statements
      if (statementType === 'select') {
        // Check for subqueries with dangerous operations
        const hasSubquery = JSON.stringify(statement).toLowerCase().includes('"type":"update"')
          || JSON.stringify(statement).toLowerCase().includes('"type":"delete"')
          || JSON.stringify(statement).toLowerCase().includes('"type":"insert"');

        if (hasSubquery) {
          result.isValid = false;
          result.errors.push('Subqueries with write operations are not allowed');
        }
      }
    } catch (parseError) {
      // If parsing fails, be conservative and reject the query
      result.isValid = false;
      result.errors.push(
        `Failed to parse SQL query: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );

      log.warn('SQL parse error', {
        userId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        query: query.substring(0, 200),
      });
    }

    // Log validation result if there are errors
    if (!result.isValid) {
      log.warn('SQL validation failed', {
        userId,
        errors: result.errors,
        query: query.substring(0, 200),
      });
    }

    return result;
  } catch (error) {
    log.error('SQL validation error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 200),
    });

    return {
      isValid: false,
      errors: ['Unexpected error during validation'],
      warnings: [],
      statementType: null,
      tableNames: [],
    };
  }
}

/**
 * Extract table names from a parsed SELECT statement
 * This is a best-effort extraction and may not catch all cases
 */
function extractTableNames(statement: any): string[] {
  const tableNames: string[] = [];

  try {
    // Handle simple SELECT ... FROM table
    if (statement.from) {
      const from = Array.isArray(statement.from) ? statement.from : [statement.from];

      for (const fromItem of from) {
        if (fromItem.type === 'table') {
          const tableName = fromItem.name?.name || fromItem.name;
          if (tableName) {
            tableNames.push(String(tableName));
          }
        }
      }
    }

    // Handle JOINs
    if (statement.joins) {
      for (const join of statement.joins) {
        if (join.type === 'table') {
          const tableName = join.name?.name || join.name;
          if (tableName) {
            tableNames.push(String(tableName));
          }
        }
      }
    }
  } catch (error) {
    // If extraction fails, just return empty array
    log.debug('Failed to extract table names', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return [...new Set(tableNames)]; // Remove duplicates
}

/**
 * Sanitize a query by removing trailing semicolons and extra whitespace
 * @param query - SQL query to sanitize
 * @returns Sanitized query
 */
export function sanitizeQuery(query: string): string {
  return query
    .trim()
    .replace(/;+$/, '') // Remove trailing semicolons
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if a query is a simple SELECT without complex operations
 * This can be used to allow faster execution paths for simple queries
 * @param query - SQL query to check
 * @returns true if query is simple
 */
export function isSimpleSelect(query: string): boolean {
  const queryLower = query.toLowerCase().trim();

  // Must start with SELECT
  if (!queryLower.startsWith('select')) {
    return false;
  }

  // No subqueries
  if (queryLower.includes('(select')) {
    return false;
  }

  // No CTEs (WITH)
  if (queryLower.startsWith('with')) {
    return false;
  }

  // No window functions
  if (queryLower.includes('over(') || queryLower.includes('over (')) {
    return false;
  }

  // No complex aggregations with HAVING
  if (queryLower.includes('having')) {
    return false;
  }

  return true;
}
