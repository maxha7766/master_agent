/**
 * SQL Query Executor Service
 * Safely executes SQL queries with timeouts, row limits, and read-only enforcement
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
import { Database } from 'sqlite';
import { connectionManager, type DatabaseType } from './connection-manager.js';
import { queryGeneratorService, type QueryGenerationResult } from './query-generator.js';
import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';

export interface QueryExecutionOptions {
  timeout?: number; // milliseconds, default 30000 (30 seconds)
  maxRows?: number; // default 1000
  dryRun?: boolean; // if true, generate SQL but don't execute
}

export interface QueryExecutionResult {
  success: boolean;
  rows?: any[];
  rowCount?: number;
  columns?: Array<{ name: string; type: string }>;
  executionTimeMs?: number;
  generatedSQL?: string;
  explanation?: string;
  error?: string;
  warnings?: string[];
}

export interface QueryHistoryEntry {
  id: string;
  userId: string;
  connectionId: string;
  question: string;
  generatedSQL: string;
  success: boolean;
  rowCount?: number;
  executionTimeMs?: number;
  error?: string;
  createdAt: string;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_ROWS = 1000;
const MAX_TIMEOUT = 120000; // 2 minutes (hard limit)

class QueryExecutorService {
  /**
   * Execute natural language query
   */
  async executeNaturalLanguageQuery(
    userId: string,
    connectionId: string,
    question: string,
    options: QueryExecutionOptions = {}
  ): Promise<QueryExecutionResult> {
    const startTime = Date.now();

    try {
      log.info('Executing natural language query', { userId, connectionId, question });

      // Step 1: Generate SQL from question
      const generation = await queryGeneratorService.generateQuery(
        userId,
        connectionId,
        question,
        { dryRun: options.dryRun }
      );

      // If dry run, return early
      if (options.dryRun) {
        return {
          success: true,
          generatedSQL: generation.sql,
          explanation: generation.explanation,
          warnings: generation.warnings,
        };
      }

      // Step 2: Execute the generated SQL
      const result = await this.executeSQLQuery(
        userId,
        connectionId,
        generation.sql,
        options
      );

      // Add generation details to result
      result.generatedSQL = generation.sql;
      result.explanation = generation.explanation;
      if (generation.warnings) {
        result.warnings = [...(result.warnings || []), ...generation.warnings];
      }

      // Step 3: Save to query history
      await this.saveQueryHistory({
        userId,
        connectionId,
        question,
        generatedSQL: generation.sql,
        success: result.success,
        rowCount: result.rowCount,
        executionTimeMs: Date.now() - startTime,
        error: result.error,
      });

      log.info('Natural language query executed', {
        connectionId,
        success: result.success,
        rowCount: result.rowCount,
        executionTimeMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      log.error('Natural language query execution failed', { error, userId, connectionId, question });

      const result: QueryExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
      };

      // Still save failed queries to history
      try {
        await this.saveQueryHistory({
          userId,
          connectionId,
          question,
          generatedSQL: 'N/A',
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: result.error,
        });
      } catch (historyError) {
        log.error('Failed to save query history', { historyError });
      }

      return result;
    }
  }

  /**
   * Execute raw SQL query (with safety checks)
   */
  async executeSQLQuery(
    userId: string,
    connectionId: string,
    sql: string,
    options: QueryExecutionOptions = {}
  ): Promise<QueryExecutionResult> {
    const startTime = Date.now();

    try {
      // Get connection details
      const connection = await connectionManager.getConnection(userId, connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Validate SQL
      const validation = queryGeneratorService.validateQuery(sql, connection.dbType);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid SQL: ${validation.error}`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Get connection pool
      const pool = await connectionManager.getOrCreatePool(connectionId, userId);

      // Set timeout and max rows
      const timeout = Math.min(options.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT);
      const maxRows = options.maxRows || DEFAULT_MAX_ROWS;

      // Execute based on database type
      let result: QueryExecutionResult;
      switch (connection.dbType) {
        case 'postgresql':
          result = await this.executePostgreSQLQuery(pool, sql, timeout, maxRows);
          break;
        case 'mysql':
          result = await this.executeMySQLQuery(pool, sql, timeout, maxRows);
          break;
        case 'sqlite':
          result = await this.executeSQLiteQuery(pool, sql, timeout, maxRows);
          break;
        default:
          throw new Error(`Unsupported database type: ${connection.dbType}`);
      }

      result.executionTimeMs = Date.now() - startTime;

      log.info('SQL query executed', {
        connectionId,
        success: result.success,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
      });

      return result;
    } catch (error) {
      log.error('SQL query execution failed', { error, userId, connectionId, sql });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute PostgreSQL query
   */
  private async executePostgreSQLQuery(
    pool: pg.Pool,
    sql: string,
    timeout: number,
    maxRows: number
  ): Promise<QueryExecutionResult> {
    const client = await pool.connect();

    try {
      // Set statement timeout
      await client.query(`SET statement_timeout = ${timeout}`);

      // Add LIMIT if not present
      const limitedSQL = this.ensureLimit(sql, maxRows, 'postgresql');

      // Execute query
      const result = await client.query(limitedSQL);

      // Extract column metadata
      const columns = result.fields.map(field => ({
        name: field.name,
        type: this.mapPostgreSQLType(field.dataTypeID),
      }));

      return {
        success: true,
        rows: result.rows,
        rowCount: result.rows.length,
        columns,
        warnings: result.rows.length === maxRows ? [`Results limited to ${maxRows} rows`] : undefined,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Execute MySQL query
   */
  private async executeMySQLQuery(
    pool: mysql.Pool,
    sql: string,
    timeout: number,
    maxRows: number
  ): Promise<QueryExecutionResult> {
    const connection = await pool.getConnection();

    try {
      // Set query timeout (MySQL uses seconds)
      await connection.query(`SET SESSION max_execution_time = ${Math.floor(timeout / 1000) * 1000}`);

      // Add LIMIT if not present
      const limitedSQL = this.ensureLimit(sql, maxRows, 'mysql');

      // Execute query
      const [rows, fields] = await connection.query(limitedSQL);

      // Extract column metadata
      const columns = (fields as any[]).map(field => ({
        name: field.name,
        type: this.mapMySQLType(field.type),
      }));

      const rowArray = Array.isArray(rows) ? rows : [];

      return {
        success: true,
        rows: rowArray,
        rowCount: rowArray.length,
        columns,
        warnings: rowArray.length === maxRows ? [`Results limited to ${maxRows} rows`] : undefined,
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Execute SQLite query
   */
  private async executeSQLiteQuery(
    db: Database,
    sql: string,
    timeout: number,
    maxRows: number
  ): Promise<QueryExecutionResult> {
    // SQLite doesn't have built-in timeout, so we'll use Promise.race
    const queryPromise = this.executeSQLiteQueryInternal(db, sql, maxRows);

    const timeoutPromise = new Promise<QueryExecutionResult>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout exceeded')), timeout);
    });

    return Promise.race([queryPromise, timeoutPromise]);
  }

  /**
   * Internal SQLite query execution
   */
  private async executeSQLiteQueryInternal(
    db: Database,
    sql: string,
    maxRows: number
  ): Promise<QueryExecutionResult> {
    // Add LIMIT if not present
    const limitedSQL = this.ensureLimit(sql, maxRows, 'sqlite');

    // Execute query
    const rows = await db.all(limitedSQL);

    // Extract column metadata (from first row)
    const columns = rows.length > 0
      ? Object.keys(rows[0]).map(name => ({ name, type: 'unknown' }))
      : [];

    return {
      success: true,
      rows,
      rowCount: rows.length,
      columns,
      warnings: rows.length === maxRows ? [`Results limited to ${maxRows} rows`] : undefined,
    };
  }

  /**
   * Ensure SQL query has LIMIT clause
   */
  private ensureLimit(sql: string, maxRows: number, dbType: DatabaseType): string {
    const upperSQL = sql.toUpperCase();

    // Check if LIMIT already exists
    if (upperSQL.includes('LIMIT')) {
      return sql;
    }

    // Add LIMIT clause
    return `${sql.trim()} LIMIT ${maxRows}`;
  }

  /**
   * Map PostgreSQL type ID to string
   */
  private mapPostgreSQLType(typeId: number): string {
    // Common PostgreSQL type OIDs
    const typeMap: { [key: number]: string } = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double precision',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
    };

    return typeMap[typeId] || 'unknown';
  }

  /**
   * Map MySQL type to string
   */
  private mapMySQLType(type: number): string {
    // Common MySQL type codes
    const typeMap: { [key: number]: string } = {
      0: 'decimal',
      1: 'tiny',
      2: 'short',
      3: 'long',
      4: 'float',
      5: 'double',
      7: 'timestamp',
      8: 'longlong',
      9: 'int24',
      10: 'date',
      11: 'time',
      12: 'datetime',
      13: 'year',
      15: 'varchar',
      245: 'json',
      246: 'decimal',
      253: 'varchar',
      254: 'char',
    };

    return typeMap[type] || 'unknown';
  }

  /**
   * Save query to history
   */
  private async saveQueryHistory(entry: Omit<QueryHistoryEntry, 'id' | 'createdAt'>): Promise<void> {
    try {
      await supabase.from('sql_query_history').insert({
        user_id: entry.userId,
        connection_id: entry.connectionId,
        question: entry.question,
        generated_sql: entry.generatedSQL,
        success: entry.success,
        row_count: entry.rowCount,
        execution_time_ms: entry.executionTimeMs,
        error: entry.error,
      });
    } catch (error) {
      log.error('Failed to save query history', { error, entry });
      // Don't throw - history save failure shouldn't break the query
    }
  }

  /**
   * Get query history for a connection
   */
  async getQueryHistory(
    userId: string,
    connectionId: string,
    limit: number = 50
  ): Promise<QueryHistoryEntry[]> {
    try {
      const { data, error } = await supabase
        .from('sql_query_history')
        .select('*')
        .eq('user_id', userId)
        .eq('connection_id', connectionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        connectionId: row.connection_id,
        question: row.question,
        generatedSQL: row.generated_sql,
        success: row.success,
        rowCount: row.row_count,
        executionTimeMs: row.execution_time_ms,
        error: row.error,
        createdAt: row.created_at,
      }));
    } catch (error) {
      log.error('Failed to get query history', { error, userId, connectionId });
      return [];
    }
  }

  /**
   * Clear query history for a connection
   */
  async clearQueryHistory(userId: string, connectionId: string): Promise<void> {
    try {
      await supabase
        .from('sql_query_history')
        .delete()
        .eq('user_id', userId)
        .eq('connection_id', connectionId);

      log.info('Query history cleared', { userId, connectionId });
    } catch (error) {
      log.error('Failed to clear query history', { error, userId, connectionId });
      throw error;
    }
  }
}

export const queryExecutorService = new QueryExecutorService();
