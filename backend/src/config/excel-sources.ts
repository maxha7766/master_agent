/**
 * Excel Documentation Sources Configuration
 * Defines all external Excel documentation to be ingested into RAG system
 */

export interface ExcelDocSource {
  id: string;
  name: string;
  url: string;
  type: 'function_reference' | 'tutorial' | 'guide' | 'category_reference';
  category?: string;
  metadata: {
    source_type: 'microsoft_docs' | 'third_party';
    doc_category: string;
    excel_version?: string[];
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    function_category?: string;
    use_cases?: string[];
    scraping_strategy?: 'single_page' | 'multi_page' | 'single_page_segmented' | 'selective';
    provider?: string;
    topics?: string[];
    categories?: string[];
  };
}

export const EXCEL_DOC_SOURCES: ExcelDocSource[] = [
  {
    id: 'excel-functions-alphabetical',
    name: 'Excel Functions (Alphabetical)',
    url: 'https://support.microsoft.com/en-us/office/excel-functions-alphabetical-b3944572-255d-4efb-bb96-c6d90033e188',
    type: 'function_reference',
    metadata: {
      source_type: 'microsoft_docs',
      doc_category: 'reference',
      excel_version: ['2016', '2019', '2021', '365'],
      scraping_strategy: 'single_page',
    },
  },
  {
    id: 'excel-functions-by-category',
    name: 'Excel Functions by Category',
    url: 'https://support.microsoft.com/en-us/office/excel-functions-by-category-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb',
    type: 'category_reference',
    metadata: {
      source_type: 'microsoft_docs',
      doc_category: 'reference',
      categories: [
        'Logical',
        'Lookup',
        'Text',
        'Date & Time',
        'Math',
        'Statistical',
        'Financial',
        'Engineering',
        'Information',
        'Database',
      ],
      scraping_strategy: 'single_page_segmented',
    },
  },
  {
    id: 'excel-formulas-overview',
    name: 'Overview of Formulas in Excel',
    url: 'https://support.microsoft.com/en-us/office/overview-of-formulas-in-excel-ecfdc708-9162-49e8-b993-c311f47ca173',
    type: 'guide',
    metadata: {
      source_type: 'microsoft_docs',
      doc_category: 'conceptual',
      difficulty_level: 'beginner',
      use_cases: ['formula_basics', 'cell_references', 'operators', 'error_handling'],
      scraping_strategy: 'single_page',
    },
  },
  {
    id: 'excel-help-learning',
    name: 'Excel Help & Learning Portal',
    url: 'https://support.microsoft.com/en-us/excel',
    type: 'tutorial',
    metadata: {
      source_type: 'microsoft_docs',
      doc_category: 'tutorials',
      scraping_strategy: 'selective',
      topics: ['formulas', 'charts', 'pivot_tables', 'data_analysis', 'formatting'],
    },
  },
  {
    id: 'cfi-advanced-formulas',
    name: 'Corporate Finance Institute - 10 Advanced Excel Formulas',
    url: 'https://corporatefinanceinstitute.com/resources/excel/study/advanced-excel-formulas-must-know/',
    type: 'guide',
    metadata: {
      source_type: 'third_party',
      doc_category: 'advanced_techniques',
      difficulty_level: 'advanced',
      use_cases: ['financial_modeling', 'data_analysis', 'complex_formulas'],
      provider: 'Corporate Finance Institute',
      scraping_strategy: 'single_page',
    },
  },
  {
    id: 'excel-text-functions',
    name: 'Excel Text Functions Reference',
    url: 'https://support.microsoft.com/en-us/office/text-functions-reference-cccd86ad-547d-4ea9-a065-7bb697c2a56e',
    type: 'category_reference',
    metadata: {
      source_type: 'microsoft_docs',
      doc_category: 'reference',
      function_category: 'Text',
      excel_version: ['2016', '2019', '2021', '365'],
      scraping_strategy: 'single_page',
    },
  },
];

/**
 * Common Excel function categories for metadata tagging
 */
export const EXCEL_FUNCTION_CATEGORIES = [
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
] as const;

/**
 * Common Excel use cases for content classification
 */
export const EXCEL_USE_CASES = [
  'data_lookup',
  'text_manipulation',
  'date_calculations',
  'financial_modeling',
  'data_analysis',
  'conditional_logic',
  'array_formulas',
  'data_validation',
  'pivot_tables',
  'charts_visualization',
  'data_cleaning',
  'error_handling',
] as const;
