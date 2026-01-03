/**
 * SQL Query Generator
 * Converts natural language queries to SQL using LLM with schema context
 */

import Anthropic from '@anthropic-ai/sdk';
import { DatabaseSchema, formatSchemaForLLM } from '../../services/database/schema.js';
import { log } from '../../lib/logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface QueryGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeneratedQuery {
  sql: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

/**
 * Generate SQL query from natural language
 * @param naturalLanguageQuery - User's question in natural language
 * @param schema - Database schema for context
 * @param options - Generation options
 * @returns Generated SQL query with explanation
 */
export async function generateQuery(
  naturalLanguageQuery: string,
  schema: DatabaseSchema,
  options: QueryGenerationOptions = {}
): Promise<GeneratedQuery> {
  const {
    model = 'claude-3-haiku-20240307',
    temperature = 0,
    maxTokens = 2000,
  } = options;

  try {
    // Format schema for LLM context
    const schemaContext = formatSchemaForLLM(schema);

    const systemPrompt = `You are an expert PostgreSQL query generator. Your task is to convert natural language questions into PostgreSQL queries.

IMPORTANT RULES:
- Generate ONLY SELECT queries (read-only)
- NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE or other write operations
- Use proper PostgreSQL syntax
- Include appropriate JOINs when querying multiple tables
- Use WHERE clauses to filter results appropriately
- Use LIMIT to prevent returning too many rows (default to LIMIT 100 unless specified)
- Include ORDER BY when relevant
- Use aggregate functions (COUNT, SUM, AVG, etc.) when appropriate
- Always qualify column names with table names when joining tables

RESPONSE FORMAT:
You must respond with a JSON object containing:
{
  "sql": "The generated SQL query",
  "explanation": "Brief explanation of what the query does",
  "confidence": "high|medium|low",
  "warnings": ["Array of any warnings or assumptions"]
}

If you cannot generate a valid query or the request would require write operations, set confidence to "low" and explain in warnings.`;

    const userPrompt = `Database Schema:
${schemaContext}

User Question:
${naturalLanguageQuery}

Generate a PostgreSQL SELECT query to answer this question.`;

    log.info('Generating SQL query', {
      model,
      temperature,
      queryLength: naturalLanguageQuery.length,
      schemaTableCount: schema.totalTables,
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const responseText = textContent.text;

    // Parse JSON response
    let result: GeneratedQuery;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      const parsed = JSON.parse(jsonText.trim());

      result = {
        sql: parsed.sql || '',
        explanation: parsed.explanation || '',
        confidence: parsed.confidence || 'medium',
        warnings: parsed.warnings || [],
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract SQL directly
      log.warn('Failed to parse JSON response, attempting fallback', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });

      // Try to extract SQL from code blocks
      const sqlMatch = responseText.match(/```sql\n?([\s\S]*?)\n?```/);
      if (sqlMatch) {
        result = {
          sql: sqlMatch[1].trim(),
          explanation: 'Generated from natural language query',
          confidence: 'medium',
          warnings: ['Response format was not JSON, confidence may be lower'],
        };
      } else {
        throw new Error('Failed to parse query generation response');
      }
    }

    // Validate that we have a SQL query
    if (!result.sql || result.sql.trim().length === 0) {
      throw new Error('No SQL query generated');
    }

    log.info('SQL query generated successfully', {
      confidence: result.confidence,
      warningCount: result.warnings.length,
      sqlLength: result.sql.length,
    });

    return result;
  } catch (error) {
    log.error('Failed to generate SQL query', {
      error: error instanceof Error ? error.message : String(error),
      query: naturalLanguageQuery.substring(0, 200),
    });

    throw new Error(
      `Failed to generate SQL query: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate SQL query with conversation history
 * Useful for follow-up questions
 * @param naturalLanguageQuery - User's question
 * @param schema - Database schema
 * @param conversationHistory - Previous queries and results
 * @param options - Generation options
 * @returns Generated query
 */
export async function generateQueryWithHistory(
  naturalLanguageQuery: string,
  schema: DatabaseSchema,
  conversationHistory: Array<{
    query: string;
    sql: string;
    result?: string;
  }>,
  options: QueryGenerationOptions = {}
): Promise<GeneratedQuery> {
  const {
    model = 'claude-3-haiku-20240307',
    temperature = 0,
    maxTokens = 2000,
  } = options;

  try {
    const schemaContext = formatSchemaForLLM(schema);

    const systemPrompt = `You are an expert PostgreSQL query generator. Your task is to convert natural language questions into PostgreSQL queries.

IMPORTANT RULES:
- Generate ONLY SELECT queries (read-only)
- NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE or other write operations
- Use proper PostgreSQL syntax
- Include appropriate JOINs when querying multiple tables
- Use WHERE clauses to filter results appropriately
- Use LIMIT to prevent returning too many rows (default to LIMIT 100 unless specified)
- Include ORDER BY when relevant
- Use aggregate functions (COUNT, SUM, AVG, etc.) when appropriate
- Always qualify column names with table names when joining tables
- Consider previous queries in the conversation for context

RESPONSE FORMAT:
You must respond with a JSON object containing:
{
  "sql": "The generated SQL query",
  "explanation": "Brief explanation of what the query does",
  "confidence": "high|medium|low",
  "warnings": ["Array of any warnings or assumptions"]
}`;

    // Build conversation context
    let conversationContext = 'Previous Queries:\n';
    for (let i = 0; i < conversationHistory.length; i++) {
      const item = conversationHistory[i];
      conversationContext += `\nQuery ${i + 1}: ${item.query}\nSQL: ${item.sql}\n`;
      if (item.result) {
        conversationContext += `Result: ${item.result.substring(0, 200)}...\n`;
      }
    }

    const userPrompt = `Database Schema:
${schemaContext}

${conversationContext}

Current Question:
${naturalLanguageQuery}

Generate a PostgreSQL SELECT query to answer this question, considering the conversation context.`;

    log.info('Generating SQL query with history', {
      model,
      temperature,
      queryLength: naturalLanguageQuery.length,
      historyCount: conversationHistory.length,
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract and parse response (same as generateQuery)
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const responseText = textContent.text;

    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;

    const parsed = JSON.parse(jsonText.trim());

    const result: GeneratedQuery = {
      sql: parsed.sql || '',
      explanation: parsed.explanation || '',
      confidence: parsed.confidence || 'medium',
      warnings: parsed.warnings || [],
    };

    if (!result.sql || result.sql.trim().length === 0) {
      throw new Error('No SQL query generated');
    }

    return result;
  } catch (error) {
    log.error('Failed to generate SQL query with history', {
      error: error instanceof Error ? error.message : String(error),
      query: naturalLanguageQuery.substring(0, 200),
    });

    throw new Error(
      `Failed to generate SQL query: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
