/**
 * Excel Documentation Metadata Types
 * Extended metadata structure for Excel-specific documentation chunks
 */

import type { ChunkMetadata } from './processor.js';

/**
 * Excel-specific metadata that extends the base ChunkMetadata
 * Stored in the chunks.metadata JSONB field
 */
export interface ExcelChunkMetadata extends ChunkMetadata {
  // Source classification
  source_type: 'microsoft_docs' | 'third_party';
  doc_category: 'reference' | 'tutorial' | 'guide' | 'conceptual' | 'advanced_techniques';
  source_url?: string;
  scraped_at?: string;
  provider?: string; // e.g., "Corporate Finance Institute"

  // Function-specific metadata
  function_name?: string; // e.g., "VLOOKUP", "INDEX", "MATCH"
  function_category?: string; // e.g., "Lookup & Reference", "Text", "Logical"
  function_syntax?: string; // e.g., "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])"
  function_arguments?: string[]; // e.g., ["lookup_value", "table_array", "col_index_num"]

  // Version & compatibility
  excel_version?: string[]; // e.g., ["2016", "2019", "2021", "365"]
  office_365_only?: boolean;
  minimum_version?: string; // e.g., "Excel 2019"

  // Content classification
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  use_cases?: string[]; // e.g., ["financial_modeling", "data_analysis", "text_manipulation"]
  topics?: string[]; // e.g., ["formulas", "pivot_tables", "charts"]

  // Content indicators
  has_examples?: boolean; // Contains code examples or sample formulas
  has_errors_troubleshooting?: boolean; // Discusses common errors or troubleshooting
  has_syntax?: boolean; // Contains function syntax definition
  has_parameters?: boolean; // Contains parameter descriptions
  has_best_practices?: boolean; // Contains best practice recommendations

  // Related content
  related_functions?: string[]; // e.g., ["HLOOKUP", "INDEX", "MATCH"]
  related_topics?: string[]; // e.g., ["array_formulas", "error_handling"]
  prerequisites?: string[]; // e.g., ["basic_formulas", "cell_references"]

  // Section context (for segmented documents)
  section_type?: 'function_definition' | 'syntax' | 'example' | 'parameters' | 'troubleshooting' | 'tutorial_step' | 'overview';
  parent_section?: string; // For nested sections
}

/**
 * Metadata extraction result from LLM
 */
export interface ExtractedExcelMetadata {
  function_name: string | null;
  function_category: string | null;
  function_syntax: string | null;
  function_arguments: string[];
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
  use_cases: string[];
  has_examples: boolean;
  has_errors_troubleshooting: boolean;
  has_syntax: boolean;
  has_parameters: boolean;
  related_functions: string[];
  related_topics: string[];
}

/**
 * Validation rules for Excel metadata
 */
export class ExcelMetadataValidator {
  /**
   * Validate function name format
   */
  static isValidFunctionName(name: string): boolean {
    // Function names should be all caps, alphanumeric with possible dots/underscores
    return /^[A-Z][A-Z0-9._]*$/.test(name);
  }

  /**
   * Validate function category
   */
  static isValidCategory(category: string): boolean {
    const validCategories = [
      'Lookup & Reference',
      'Text',
      'Logical',
      'Math & Trig',
      'Date & Time',
      'Financial',
      'Statistical',
      'Engineering',
      'Information',
      'Database',
      'Cube',
      'Web',
    ];

    return validCategories.some(
      (valid) => valid.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Normalize function category to standard format
   */
  static normalizeCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      lookup: 'Lookup & Reference',
      reference: 'Lookup & Reference',
      'lookup & reference': 'Lookup & Reference',
      'lookup and reference': 'Lookup & Reference',
      text: 'Text',
      logical: 'Logical',
      math: 'Math & Trig',
      'math & trig': 'Math & Trig',
      mathematical: 'Math & Trig',
      trigonometric: 'Math & Trig',
      date: 'Date & Time',
      time: 'Date & Time',
      'date & time': 'Date & Time',
      'date and time': 'Date & Time',
      financial: 'Financial',
      statistical: 'Statistical',
      stats: 'Statistical',
      engineering: 'Engineering',
      information: 'Information',
      info: 'Information',
      database: 'Database',
      db: 'Database',
      cube: 'Cube',
      web: 'Web',
    };

    const normalized = categoryMap[category.toLowerCase()];
    return normalized || category;
  }

  /**
   * Validate and clean Excel metadata
   */
  static validate(metadata: Partial<ExcelChunkMetadata>): ExcelChunkMetadata {
    const validated: Partial<ExcelChunkMetadata> = { ...metadata };

    // Normalize function name to uppercase
    if (validated.function_name) {
      validated.function_name = validated.function_name.toUpperCase().trim();
    }

    // Normalize function category
    if (validated.function_category) {
      validated.function_category = this.normalizeCategory(validated.function_category);
    }

    // Ensure arrays are arrays
    if (validated.use_cases && !Array.isArray(validated.use_cases)) {
      validated.use_cases = [];
    }

    if (validated.related_functions && !Array.isArray(validated.related_functions)) {
      validated.related_functions = [];
    }

    if (validated.excel_version && !Array.isArray(validated.excel_version)) {
      validated.excel_version = [];
    }

    // Clean up function arguments (remove brackets, trim)
    if (validated.function_arguments) {
      validated.function_arguments = validated.function_arguments.map((arg) =>
        arg.replace(/[\[\]]/g, '').trim()
      );
    }

    return validated as ExcelChunkMetadata;
  }
}
