/**
 * Schema Discovery Agent
 * Uses AI to infer schema, types, and relationships from sample data
 */

import Anthropic from '@anthropic-ai/sdk';
import { log } from '../../lib/logger.js';
import type { ParsedRow } from './parser.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ColumnSchema {
  name: string;
  inferred_type: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'unknown';
  nullable: boolean;
  description?: string;
  sample_values: any[];
  statistics?: {
    min?: number;
    max?: number;
    avg?: number;
    distinct_count?: number;
    null_count?: number;
  };
}

export interface SemanticSchema {
  columns: ColumnSchema[];
  primary_key?: string;
  summary: string;
  data_quality_score: number;
  issues: string[];
  suggested_queries: string[];
}

export class SchemaDiscoveryAgent {
  /**
   * Discover schema from sample data using AI
   */
  async discoverSchema(
    rows: ParsedRow[],
    columns: string[],
    userDescription?: string
  ): Promise<SemanticSchema> {
    try {
      log.info('Starting schema discovery', {
        sampleSize: rows.length,
        columnCount: columns.length,
      });

      // Prepare sample data for AI
      const sampleData = this.prepareSampleData(rows, columns);

      // Generate schema using Claude
      const schema = await this.analyzeWithAI(sampleData, userDescription);

      log.info('Schema discovery complete', {
        columns: schema.columns.length,
        qualityScore: schema.data_quality_score,
      });

      return schema;
    } catch (error) {
      log.error('Schema discovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Schema discovery failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Prepare sample data for AI analysis
   */
  private prepareSampleData(rows: ParsedRow[], columns: string[]): string {
    const sample = rows.slice(0, 20); // First 20 rows

    // Create statistics for each column
    const columnStats: any = {};
    columns.forEach((col) => {
      const values = rows.map((r) => r[col]).filter((v) => v != null);
      const nullCount = rows.length - values.length;

      columnStats[col] = {
        sample_values: values.slice(0, 5),
        null_count: nullCount,
        null_percentage: ((nullCount / rows.length) * 100).toFixed(1),
        unique_count: new Set(values).size,
        data_types: [...new Set(values.map((v) => typeof v))],
      };
    });

    return JSON.stringify({
      sample_rows: sample,
      column_statistics: columnStats,
      total_rows: rows.length,
    }, null, 2);
  }

  /**
   * Analyze data with Claude AI
   */
  private async analyzeWithAI(
    sampleData: string,
    userDescription?: string
  ): Promise<SemanticSchema> {
    const prompt = `You are a data schema expert. Analyze this tabular data sample and infer the schema.

${userDescription ? `User Description: "${userDescription}"\n` : ''}
Sample Data:
${sampleData}

Provide a comprehensive schema analysis in JSON format:

{
  "columns": [
    {
      "name": "column_name",
      "inferred_type": "string|integer|float|boolean|date|datetime",
      "nullable": true|false,
      "description": "What this column represents",
      "sample_values": [1, 2, 3],
      "statistics": {
        "min": 1,
        "max": 100,
        "distinct_count": 50
      }
    }
  ],
  "primary_key": "column_name or null",
  "summary": "1-2 sentence description of what this data represents",
  "data_quality_score": 0.0-1.0,
  "issues": ["list of any data quality problems"],
  "suggested_queries": ["Example questions users might ask about this data"]
}

Rules:
1. Infer types from actual data (not just JavaScript typeof)
2. Detect dates in various formats (YYYY-MM-DD, MM/DD/YYYY, etc.)
3. Identify potential primary keys (unique, non-null identifiers)
4. Be specific in column descriptions (not just "data field")
5. Calculate realistic data quality score based on completeness
6. Suggest 3-5 useful queries users might want to run

Return ONLY valid JSON, no additional text.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const schema = JSON.parse(jsonMatch[0]) as SemanticSchema;

      // Validate schema structure
      if (!schema.columns || !Array.isArray(schema.columns)) {
        throw new Error('Invalid schema structure from AI');
      }

      return schema;
    } catch (error) {
      log.error('AI schema analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate statistics for a column
   */
  calculateColumnStats(values: any[]): any {
    const nonNull = values.filter((v) => v != null);

    if (nonNull.length === 0) {
      return { null_count: values.length };
    }

    const stats: any = {
      null_count: values.length - nonNull.length,
      distinct_count: new Set(nonNull).size,
    };

    // Numeric statistics
    const numbers = nonNull.filter((v) => typeof v === 'number');
    if (numbers.length > 0) {
      stats.min = Math.min(...numbers);
      stats.max = Math.max(...numbers);
      stats.avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    return stats;
  }
}

// Export singleton
export const schemaDiscoveryAgent = new SchemaDiscoveryAgent();
