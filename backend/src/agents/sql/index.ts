/**
 * SQL Agent
 * Main entry point for SQL database querying functionality
 * Updated to use new SQL infrastructure (connection-manager, schema-discovery, query-executor)
 */

import { connectionManager } from '../../services/sql/connection-manager.js';
import { schemaDiscoveryService } from '../../services/sql/schema-discovery.js';
import { queryExecutorService } from '../../services/sql/query-executor.js';
import type { StreamChunk } from '../../services/llm/provider.js';
import { log } from '../../lib/logger.js';

export interface SqlAgentOptions {
  model?: string;
  temperature?: number;
  connectionId?: string; // Optional: specific connection to use
}

export interface SqlAgentResult {
  success: boolean;
  response: string;
  tableView?: string;
  error?: string;
  metadata?: {
    sql?: string;
    executionTimeMs?: number;
    rowCount?: number;
    connectionUsed?: string;
  };
}

class SqlAgent {
  /**
   * Process a natural language SQL query
   */
  async processQuery(
    userQuery: string,
    userId: string,
    options: SqlAgentOptions = {}
  ): Promise<SqlAgentResult> {
    try {
      log.info('Processing SQL query', {
        userId,
        queryLength: userQuery.length,
        connectionId: options.connectionId,
      });

      // Get user's database connections
      const connections = await connectionManager.listConnections(userId);

      if (connections.length === 0) {
        return {
          success: false,
          response: "You don't have any database connections configured yet. Please add a database connection first.",
          error: 'No database connections found',
        };
      }

      // Select connection (use specified or first available)
      const connection = options.connectionId
        ? connections.find((c) => c.id === options.connectionId)
        : connections[0];

      if (!connection) {
        return {
          success: false,
          response: 'The specified database connection was not found.',
          error: 'Connection not found',
        };
      }

      // Execute query using new executor service
      const result = await queryExecutorService.executeNaturalLanguageQuery(
        userId,
        connection.id,
        userQuery,
        {
          timeout: 30000,
          maxRows: 1000,
        }
      );

      if (!result.success) {
        return {
          success: false,
          response: `Sorry, I encountered an error executing your query: ${result.error}`,
          error: result.error,
        };
      }

      // Build natural language response
      let response = this.formatNaturalLanguageResponse(result, userQuery);

      // Add table view if there are results
      let tableView: string | undefined;
      if (result.rows && result.rows.length > 0) {
        tableView = this.formatTableView(result.rows, result.columns || []);
      }

      // Add warnings if any
      if (result.warnings && result.warnings.length > 0) {
        response += `\n\n**Warnings:**\n${result.warnings.map((w) => `- ${w}`).join('\n')}`;
      }

      return {
        success: true,
        response,
        tableView,
        metadata: {
          sql: result.generatedSQL,
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rowCount,
          connectionUsed: connection.name,
        },
      };
    } catch (error) {
      log.error('SQL query processing failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        query: userQuery.substring(0, 200),
      });

      return {
        success: false,
        response: `Sorry, I encountered an error processing your query: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate streaming response for SQL query
   */
  async* generateStreamingResponse(
    userQuery: string,
    userId: string,
    options: SqlAgentOptions = {}
  ): AsyncGenerator<StreamChunk> {
    try {
      // Get connections
      const connections = await connectionManager.listConnections(userId);

      if (connections.length === 0) {
        yield {
          content: "You don't have any database connections configured yet. Please add a database connection first.",
          done: true,
        };
        return;
      }

      const connection = options.connectionId
        ? connections.find((c) => c.id === options.connectionId)
        : connections[0];

      if (!connection) {
        yield {
          content: 'The specified database connection was not found.',
          done: true,
        };
        return;
      }

      // Stream progress updates
      yield {
        content: `Analyzing query against **${connection.name}** database...\n\n`,
        done: false,
      };

      // Get or discover schema
      let schema = await schemaDiscoveryService.getCachedSchema(userId, connection.id);
      if (!schema) {
        yield {
          content: '✓ Discovering database schema...\n',
          done: false,
        };
        schema = await schemaDiscoveryService.discoverSchema(userId, connection.id);
      }

      yield {
        content: `✓ Schema loaded (${schema.tables.length} tables)\n`,
        done: false,
      };

      // Generate and execute SQL
      yield {
        content: '✓ Generating SQL query...\n',
        done: false,
      };

      const result = await queryExecutorService.executeNaturalLanguageQuery(
        userId,
        connection.id,
        userQuery,
        {
          timeout: 30000,
          maxRows: 1000,
        }
      );

      if (!result.success) {
        yield {
          content: `\n❌ Query failed: ${result.error}`,
          done: true,
        };
        return;
      }

      yield {
        content: `✓ Query completed in ${result.executionTimeMs}ms\n\n`,
        done: false,
      };

      // Show generated SQL if available
      if (result.generatedSQL) {
        yield {
          content: `**Generated SQL:**\n\`\`\`sql\n${result.generatedSQL}\n\`\`\`\n\n`,
          done: false,
        };
      }

      // Format and stream result
      const naturalResponse = this.formatNaturalLanguageResponse(result, userQuery);
      yield {
        content: `---\n\n${naturalResponse}\n\n`,
        done: false,
      };

      // Add table view if there are results
      if (result.rows && result.rows.length > 0) {
        const tableView = this.formatTableView(result.rows, result.columns || []);
        yield {
          content: `**Table View:**\n\`\`\`\n${tableView}\n\`\`\`\n\n`,
          done: false,
        };
      }

      // Add metadata
      yield {
        content: `*Query executed on ${connection.name} | ${result.rowCount || 0} rows returned | ${result.executionTimeMs}ms*`,
        done: true,
      };
    } catch (error) {
      log.error('Streaming SQL query failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      yield {
        content: `\n\n❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        done: true,
      };
    }
  }

  /**
   * Check if user has any database connections
   */
  async hasConnections(userId: string): Promise<boolean> {
    try {
      const connections = await connectionManager.listConnections(userId);
      return connections.length > 0;
    } catch (error) {
      log.error('Failed to check database connections', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Format query result as natural language response
   */
  private formatNaturalLanguageResponse(result: any, userQuery: string): string {
    if (!result.rows || result.rows.length === 0) {
      return 'The query executed successfully but returned no results.';
    }

    const rowCount = result.rowCount || result.rows.length;

    // Build natural response based on query type
    let response = `I found ${rowCount} result${rowCount === 1 ? '' : 's'}`;

    if (result.explanation) {
      response += `:\n\n${result.explanation}`;
    } else {
      response += '. Here are the results:';
    }

    return response;
  }

  /**
   * Format results as ASCII table
   */
  private formatTableView(rows: any[], columns: Array<{ name: string; type: string }>): string {
    if (rows.length === 0) {
      return 'No results to display.';
    }

    // Get column names (from columns array or first row keys)
    const columnNames = columns.length > 0
      ? columns.map(c => c.name)
      : Object.keys(rows[0]);

    // Calculate column widths
    const columnWidths: { [key: string]: number } = {};
    for (const col of columnNames) {
      columnWidths[col] = Math.max(
        col.length,
        ...rows.map(row => String(row[col] || '').length)
      );
      // Max width of 30 to prevent extremely wide tables
      columnWidths[col] = Math.min(columnWidths[col], 30);
    }

    // Build header
    const header = columnNames
      .map(col => col.padEnd(columnWidths[col]))
      .join(' | ');

    const separator = columnNames
      .map(col => '-'.repeat(columnWidths[col]))
      .join('-+-');

    // Build rows
    const rowLines = rows.map(row =>
      columnNames
        .map(col => {
          let value = String(row[col] ?? '');
          if (value.length > 30) {
            value = value.substring(0, 27) + '...';
          }
          return value.padEnd(columnWidths[col]);
        })
        .join(' | ')
    );

    return [header, separator, ...rowLines].join('\n');
  }

  /**
   * Clear schema cache (delegates to schema discovery service)
   */
  clearSchemaCache(connectionId?: string): void {
    // The schema discovery service handles caching in the database
    // This method is kept for compatibility
    log.info('Schema cache clear requested', { connectionId });
  }
}

// Export singleton instance
export const sqlAgent = new SqlAgent();
