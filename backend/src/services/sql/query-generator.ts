/**
 * SQL Query Generator Service
 * Converts natural language questions to SQL queries using LLM
 */

import { LLMFactory } from '../llm/factory.js';
import { schemaDiscoveryService, type DatabaseSchema } from './schema-discovery.js';
import { connectionManager, type DatabaseType } from './connection-manager.js';
import { log } from '../../lib/logger.js';

export interface QueryGenerationResult {
  sql: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
}

export interface QueryGenerationOptions {
  dryRun?: boolean;
  explainOnly?: boolean;
}

class QueryGeneratorService {
  /**
   * Generate SQL query from natural language question
   */
  async generateQuery(
    userId: string,
    connectionId: string,
    question: string,
    options: QueryGenerationOptions = {}
  ): Promise<QueryGenerationResult> {
    try {
      log.info('Generating SQL query', { userId, connectionId, question });

      // Get connection details
      const connection = await connectionManager.getConnection(userId, connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Get or discover schema
      let schema = await schemaDiscoveryService.getCachedSchema(userId, connectionId);
      if (!schema) {
        log.info('Schema not cached, discovering...', { connectionId });
        schema = await schemaDiscoveryService.discoverSchema(userId, connectionId);
      }

      // Generate SQL using LLM
      const result = await this.generateSQLWithLLM(
        question,
        schema,
        connection.dbType,
        options
      );

      log.info('SQL query generated', {
        connectionId,
        confidence: result.confidence,
        hasWarnings: !!result.warnings?.length,
      });

      return result;
    } catch (error) {
      log.error('Query generation failed', { error, userId, connectionId, question });
      throw error;
    }
  }

  /**
   * Use LLM to generate SQL from natural language
   */
  private async generateSQLWithLLM(
    question: string,
    schema: DatabaseSchema,
    dbType: DatabaseType,
    options: QueryGenerationOptions
  ): Promise<QueryGenerationResult> {
    // Use GPT-5.1 Codex - optimized for SQL and 60% cheaper than Claude
    const provider = LLMFactory.getProvider('gpt-5.1-codex');

    // Build schema description
    const schemaDescription = this.formatSchemaForPrompt(schema);

    // Build prompt
    const prompt = this.buildPrompt(question, schemaDescription, dbType, schema.aiSummary);

    // Call LLM
    const response = await provider.chat(
      [{ role: 'user', content: prompt }],
      'gpt-5.1-codex',
      {
        temperature: 0.1, // Low temperature for consistency
        maxTokens: 2000,
      }
    );

    // Parse response
    return this.parseQueryResponse(response.content, dbType);
  }

  /**
   * Format schema for LLM prompt
   */
  private formatSchemaForPrompt(schema: DatabaseSchema): string {
    const tables = schema.tables.map(table => {
      const columns = table.columns.map(col => {
        const parts = [
          `  - ${col.name}`,
          `(${col.type})`,
        ];

        if (col.isPrimaryKey) parts.push('PRIMARY KEY');
        if (col.isForeignKey && col.foreignKeyTable) {
          parts.push(`FK -> ${col.foreignKeyTable}.${col.foreignKeyColumn}`);
        }
        if (!col.nullable) parts.push('NOT NULL');

        return parts.join(' ');
      }).join('\n');

      const rowInfo = table.rowCount !== undefined ? ` (${table.rowCount} rows)` : '';
      const schemaPrefix = table.schema ? `${table.schema}.` : '';

      return `Table: ${schemaPrefix}${table.name}${rowInfo}\n${columns}`;
    }).join('\n\n');

    // Add relationships section
    if (schema.relationships.length > 0) {
      const relationships = schema.relationships
        .map(rel => `  ${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn}`)
        .join('\n');

      return `${tables}\n\nRelationships:\n${relationships}`;
    }

    return tables;
  }

  /**
   * Build LLM prompt for query generation
   */
  private buildPrompt(
    question: string,
    schemaDescription: string,
    dbType: DatabaseType,
    aiSummary?: string
  ): string {
    const dialectInfo = this.getDialectInfo(dbType);

    return `You are an expert SQL query generator. Convert the user's natural language question into a SQL query.

Database Type: ${dbType.toUpperCase()}
${dialectInfo}

${aiSummary ? `Database Summary: ${aiSummary}\n\n` : ''}Database Schema:
${schemaDescription}

User Question: ${question}

Generate a SQL query to answer this question. Respond in the following JSON format:

{
  "sql": "SELECT ... (the complete SQL query)",
  "explanation": "Brief explanation of what the query does and how it answers the question",
  "confidence": "high|medium|low (your confidence in this query)",
  "warnings": ["Optional array of warnings or limitations"]
}

IMPORTANT RULES:
1. Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
2. Use appropriate JOINs based on foreign key relationships
3. Add WHERE clauses to filter data when relevant
4. Use proper aggregation functions (COUNT, SUM, AVG, etc.) when needed
5. Include GROUP BY when using aggregation with other columns
6. Add ORDER BY for sorting when it makes sense
7. Limit results to reasonable amounts (e.g., LIMIT 100) unless the question asks for all
8. Use appropriate date/time functions for temporal queries
9. Handle NULL values appropriately
10. Use DISTINCT when needed to avoid duplicates
11. Follow ${dbType} syntax conventions exactly
12. Quote table/column names if they contain special characters or are reserved words

Respond with ONLY the JSON object, no additional text.`;
  }

  /**
   * Get database-specific dialect information
   */
  private getDialectInfo(dbType: DatabaseType): string {
    switch (dbType) {
      case 'postgresql':
        return `Syntax Notes:
- Use double quotes for identifiers: "table_name"
- String literals use single quotes: 'value'
- LIMIT clause: LIMIT n
- Date functions: CURRENT_DATE, NOW(), DATE_TRUNC()
- String concatenation: || operator or CONCAT()`;

      case 'mysql':
        return `Syntax Notes:
- Use backticks for identifiers: \`table_name\`
- String literals use single quotes: 'value'
- LIMIT clause: LIMIT n
- Date functions: CURDATE(), NOW(), DATE_FORMAT()
- String concatenation: CONCAT()`;

      case 'sqlite':
        return `Syntax Notes:
- Flexible identifier quoting (double quotes or brackets)
- String literals use single quotes: 'value'
- LIMIT clause: LIMIT n
- Date functions: date('now'), datetime(), strftime()
- String concatenation: || operator`;

      default:
        return '';
    }
  }

  /**
   * Parse LLM response into QueryGenerationResult
   */
  private parseQueryResponse(content: string, dbType: DatabaseType): QueryGenerationResult {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.sql || !parsed.explanation || !parsed.confidence) {
        throw new Error('Missing required fields in LLM response');
      }

      // Validate SQL is safe (basic check)
      const sql = parsed.sql.trim();
      const upperSQL = sql.toUpperCase();

      // Check for dangerous operations
      const dangerousKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
      ];

      for (const keyword of dangerousKeywords) {
        if (upperSQL.includes(keyword)) {
          throw new Error(`Query contains forbidden operation: ${keyword}`);
        }
      }

      // Ensure query starts with SELECT
      if (!upperSQL.startsWith('SELECT') && !upperSQL.startsWith('WITH')) {
        throw new Error('Query must be a SELECT statement');
      }

      const result: QueryGenerationResult = {
        sql: parsed.sql,
        explanation: parsed.explanation,
        confidence: parsed.confidence,
      };

      if (parsed.warnings && Array.isArray(parsed.warnings)) {
        result.warnings = parsed.warnings;
      }

      // Add warning if confidence is low
      if (parsed.confidence === 'low') {
        result.warnings = result.warnings || [];
        result.warnings.push('Low confidence query - please verify results carefully');
      }

      return result;
    } catch (error) {
      log.error('Failed to parse LLM query response', { error, content });
      throw new Error('Failed to generate valid SQL query from question');
    }
  }

  /**
   * Explain an existing SQL query
   */
  async explainQuery(sql: string, dbType: DatabaseType): Promise<string> {
    try {
      const provider = LLMFactory.getProvider('gpt-5.1-codex');

      const prompt = `You are an expert SQL analyst. Explain the following ${dbType} query in simple terms.

SQL Query:
${sql}

Provide a clear, concise explanation of:
1. What data this query retrieves
2. How it processes the data (joins, filters, aggregations)
3. What the results will look like

Keep the explanation brief and understandable to non-technical users.`;

      const response = await provider.chat(
        [{ role: 'user', content: prompt }],
        'gpt-5.1-codex',
        { temperature: 0.3, maxTokens: 500 }
      );

      return response.content;
    } catch (error) {
      log.error('Failed to explain query', { error, sql });
      throw new Error('Failed to generate query explanation');
    }
  }

  /**
   * Validate a SQL query (syntax check)
   */
  validateQuery(sql: string, dbType: DatabaseType): { valid: boolean; error?: string } {
    try {
      const upperSQL = sql.trim().toUpperCase();

      // Must start with SELECT or WITH (for CTEs)
      if (!upperSQL.startsWith('SELECT') && !upperSQL.startsWith('WITH')) {
        return {
          valid: false,
          error: 'Query must be a SELECT statement',
        };
      }

      // Check for dangerous keywords
      const dangerousKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
        'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
        'SHUTDOWN', 'KILL',
      ];

      for (const keyword of dangerousKeywords) {
        if (upperSQL.includes(keyword)) {
          return {
            valid: false,
            error: `Query contains forbidden operation: ${keyword}`,
          };
        }
      }

      // Basic syntax check - ensure parentheses are balanced
      let parenCount = 0;
      for (const char of sql) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) {
          return {
            valid: false,
            error: 'Unbalanced parentheses',
          };
        }
      }

      if (parenCount !== 0) {
        return {
          valid: false,
          error: 'Unbalanced parentheses',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }
}

export const queryGeneratorService = new QueryGeneratorService();
