/**
 * Excel Documentation Metadata Extractor
 * Uses LLM to extract structured metadata from Excel documentation content
 */

import { AnthropicProvider } from '../llm/anthropic.js';
import { log } from '../../lib/logger.js';
import type {
  ExcelChunkMetadata,
  ExtractedExcelMetadata,
} from './excel-metadata-types.js';
import { ExcelMetadataValidator } from './excel-metadata-types.js';

export class ExcelMetadataExtractor {
  private llm: AnthropicProvider;

  constructor() {
    this.llm = new AnthropicProvider();
  }

  /**
   * Extract Excel-specific metadata from documentation content
   * Uses Claude Haiku for fast, cost-effective extraction
   */
  async extractExcelMetadata(
    content: string,
    baseMetadata: Partial<ExcelChunkMetadata>
  ): Promise<ExcelChunkMetadata> {
    // If content is too short, skip LLM extraction
    if (content.length < 200) {
      return this.generateFallbackMetadata(baseMetadata);
    }

    try {
      const prompt = this.buildExtractionPrompt(content);
      const response = await this.llm.chat(
        [{ role: 'user', content: prompt }],
        'claude-3-5-haiku-20241022',
        { temperature: 0.1 }
      );

      const extracted = this.parseResponse(response.content);
      const enriched = this.mergeMetadata(baseMetadata, extracted);

      log.info('Excel metadata extracted', {
        functionName: enriched.function_name,
        category: enriched.function_category,
        hasExamples: enriched.has_examples,
      });

      return ExcelMetadataValidator.validate(enriched);
    } catch (error) {
      log.error('Metadata extraction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.generateFallbackMetadata(baseMetadata);
    }
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(content: string): string {
    // Truncate content to first 4000 characters to save tokens
    const truncatedContent = content.substring(0, 4000);

    return `Analyze this Excel documentation excerpt and extract structured metadata in JSON format.

**Content:**
${truncatedContent}

**Extract the following fields:**

1. **function_name**: If this describes a specific Excel function (e.g., "VLOOKUP", "SUM", "IF"), extract it in UPPERCASE. Otherwise null.

2. **function_category**: The Excel function category, one of:
   - "Lookup & Reference"
   - "Text"
   - "Logical"
   - "Math & Trig"
   - "Date & Time"
   - "Financial"
   - "Statistical"
   - "Engineering"
   - "Information"
   - "Database"
   If not applicable, use null.

3. **function_syntax**: The full function syntax if present (e.g., "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])"). Otherwise null.

4. **function_arguments**: Array of argument names from the syntax (e.g., ["lookup_value", "table_array", "col_index_num", "range_lookup"]). Empty array if not applicable.

5. **difficulty_level**: One of "beginner", "intermediate", or "advanced" based on complexity. If unclear, use null.

6. **use_cases**: Array of practical use cases (max 5) like:
   - "data_lookup"
   - "text_manipulation"
   - "date_calculations"
   - "financial_modeling"
   - "data_analysis"
   - "conditional_logic"
   - "array_formulas"
   - "data_validation"
   - "error_handling"
   Empty array if not clear.

7. **has_examples**: true if contains code examples, sample formulas, or example outputs.

8. **has_errors_troubleshooting**: true if discusses common errors (like #N/A, #REF!, #VALUE!), troubleshooting tips, or error handling.

9. **has_syntax**: true if contains function syntax definition.

10. **has_parameters**: true if contains parameter descriptions or explanations.

11. **related_functions**: Array of related Excel function names mentioned in the content (max 5, UPPERCASE).

12. **related_topics**: Array of related topics or concepts (max 5) like:
    - "array_formulas"
    - "error_handling"
    - "cell_references"
    - "named_ranges"
    - "pivot_tables"
    - "conditional_formatting"

**IMPORTANT RULES:**
- Function names must be UPPERCASE
- Use null for missing values, not empty strings
- Use empty arrays [] when no items found
- Be conservative with categorization
- Respond ONLY with valid JSON, no other text

**Response Format:**
\`\`\`json
{
  "function_name": "VLOOKUP" | null,
  "function_category": "Lookup & Reference" | null,
  "function_syntax": "VLOOKUP(...)" | null,
  "function_arguments": ["arg1", "arg2"],
  "difficulty_level": "intermediate" | null,
  "use_cases": ["data_lookup", "table_matching"],
  "has_examples": true,
  "has_errors_troubleshooting": false,
  "has_syntax": true,
  "has_parameters": true,
  "related_functions": ["HLOOKUP", "INDEX"],
  "related_topics": ["array_formulas"]
}
\`\`\``;
  }

  /**
   * Parse LLM response and extract JSON
   */
  private parseResponse(response: string): ExtractedExcelMetadata {
    try {
      // Try to find JSON in code blocks first
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      // Try to find raw JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('No valid JSON found in response');
    } catch (error) {
      log.warn('Failed to parse metadata extraction response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getEmptyExtraction();
    }
  }

  /**
   * Merge base metadata with extracted metadata
   */
  private mergeMetadata(
    baseMetadata: Partial<ExcelChunkMetadata>,
    extracted: ExtractedExcelMetadata
  ): ExcelChunkMetadata {
    return {
      // Base metadata (from source configuration)
      source_type: baseMetadata.source_type || 'microsoft_docs',
      doc_category: baseMetadata.doc_category || 'reference',
      source_url: baseMetadata.source_url,
      scraped_at: baseMetadata.scraped_at,
      provider: baseMetadata.provider,
      excel_version: baseMetadata.excel_version,

      // Extracted metadata (from LLM)
      function_name: extracted.function_name || undefined,
      function_category:
        extracted.function_category || baseMetadata.function_category || undefined,
      function_syntax: extracted.function_syntax || undefined,
      function_arguments:
        extracted.function_arguments.length > 0 ? extracted.function_arguments : undefined,
      difficulty_level:
        extracted.difficulty_level || baseMetadata.difficulty_level || undefined,
      use_cases:
        extracted.use_cases.length > 0
          ? extracted.use_cases
          : baseMetadata.use_cases || undefined,

      // Content indicators
      has_examples: extracted.has_examples || false,
      has_errors_troubleshooting: extracted.has_errors_troubleshooting || false,
      has_syntax: extracted.has_syntax || false,
      has_parameters: extracted.has_parameters || false,

      // Related content
      related_functions:
        extracted.related_functions.length > 0 ? extracted.related_functions : undefined,
      related_topics:
        extracted.related_topics.length > 0 ? extracted.related_topics : undefined,

      // Preserve other base metadata
      file_name: baseMetadata.file_name,
      file_type: baseMetadata.file_type,
      document_type: baseMetadata.document_type,
      tags: baseMetadata.tags,
    } as ExcelChunkMetadata;
  }

  /**
   * Generate fallback metadata when LLM extraction fails
   */
  private generateFallbackMetadata(
    baseMetadata: Partial<ExcelChunkMetadata>
  ): ExcelChunkMetadata {
    return {
      source_type: baseMetadata.source_type || 'microsoft_docs',
      doc_category: baseMetadata.doc_category || 'reference',
      source_url: baseMetadata.source_url,
      scraped_at: baseMetadata.scraped_at,
      provider: baseMetadata.provider,
      excel_version: baseMetadata.excel_version,
      function_category: baseMetadata.function_category,
      difficulty_level: baseMetadata.difficulty_level,
      use_cases: baseMetadata.use_cases,
      file_name: baseMetadata.file_name,
      file_type: baseMetadata.file_type,
    } as ExcelChunkMetadata;
  }

  /**
   * Get empty extraction result
   */
  private getEmptyExtraction(): ExtractedExcelMetadata {
    return {
      function_name: null,
      function_category: null,
      function_syntax: null,
      function_arguments: [],
      difficulty_level: null,
      use_cases: [],
      has_examples: false,
      has_errors_troubleshooting: false,
      has_syntax: false,
      has_parameters: false,
      related_functions: [],
      related_topics: [],
    };
  }

  /**
   * Batch extract metadata for multiple chunks
   * Processes chunks in parallel with rate limiting
   */
  async extractBatch(
    chunks: Array<{ content: string; baseMetadata: Partial<ExcelChunkMetadata> }>,
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<ExcelChunkMetadata[]> {
    const { batchSize = 5, delayMs = 1000 } = options;
    const results: ExcelChunkMetadata[] = [];

    log.info('Starting batch metadata extraction', {
      totalChunks: chunks.length,
      batchSize,
    });

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((chunk) => this.extractExcelMetadata(chunk.content, chunk.baseMetadata))
      );

      results.push(...batchResults);

      // Rate limiting delay
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      log.info('Batch processed', {
        completed: Math.min(i + batchSize, chunks.length),
        total: chunks.length,
      });
    }

    log.info('Batch metadata extraction complete', {
      totalProcessed: results.length,
    });

    return results;
  }
}
