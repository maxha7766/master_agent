/**
 * SQL Result Formatter
 * Formats SQL query results for natural language presentation
 */

import { ExecutionResult } from '../../services/database/executor.js';

export interface FormattedResult {
  naturalLanguageResponse: string;
  tableView?: string;
  summary: {
    rowCount: number;
    columnCount: number;
    executionTimeMs: number;
    limited: boolean;
  };
  rawData?: any[];
}

/**
 * Format SQL execution result for user presentation
 * @param result - Execution result from database
 * @param originalQuestion - User's original question
 * @returns Formatted result with natural language response
 */
export function formatResult(
  result: ExecutionResult,
  originalQuestion?: string
): FormattedResult {
  if (!result.success) {
    return {
      naturalLanguageResponse: `Sorry, I couldn't execute your query. Error: ${result.error}`,
      summary: {
        rowCount: 0,
        columnCount: 0,
        executionTimeMs: result.executionTimeMs,
        limited: false,
      },
    };
  }

  const rows = result.rows || [];
  const rowCount = result.rowCount;
  const columnCount = result.columnCount;

  // Generate natural language response
  let nlResponse = '';

  if (rowCount === 0) {
    nlResponse = originalQuestion
      ? `I found no results for your query about "${originalQuestion}".`
      : 'The query returned no results.';
  } else if (rowCount === 1) {
    nlResponse = generateSingleRowResponse(rows[0], result.columns);
  } else {
    nlResponse = generateMultiRowResponse(rows, rowCount, originalQuestion);
  }

  // Add warning if results were limited
  if (result.limited) {
    nlResponse += `\n\n⚠️ Note: Results were limited to ${rowCount} rows. There may be more data available.`;
  }

  // Generate table view for structured data
  const tableView = generateTableView(rows, result.columns);

  return {
    naturalLanguageResponse: nlResponse,
    tableView,
    summary: {
      rowCount,
      columnCount,
      executionTimeMs: result.executionTimeMs,
      limited: result.limited || false,
    },
    rawData: rows,
  };
}

/**
 * Generate a natural language response for a single row result
 */
function generateSingleRowResponse(
  row: any,
  columns?: Array<{ name: string; dataTypeID: number }>
): string {
  if (!columns || columns.length === 0) {
    return 'Found 1 result.';
  }

  // Special handling for COUNT queries
  if (columns.length === 1 && columns[0].name.toLowerCase().includes('count')) {
    return `The count is ${formatValue(row[columns[0].name])}.`;
  }

  // Special handling for single value queries
  if (columns.length === 1) {
    return `The result is: ${formatValue(row[columns[0].name])}`;
  }

  // Format multiple columns
  let response = 'Here\'s what I found:\n';
  for (const col of columns) {
    response += `- **${formatColumnName(col.name)}**: ${formatValue(row[col.name])}\n`;
  }

  return response.trim();
}

/**
 * Generate a natural language response for multiple rows
 */
function generateMultiRowResponse(
  rows: any[],
  rowCount: number,
  originalQuestion?: string
): string {
  const cols = Object.keys(rows[0] || {});

  if (cols.length === 0) {
    return `Found ${rowCount} results.`;
  }

  let response = originalQuestion
    ? `Found ${rowCount} results for "${originalQuestion}":\n\n`
    : `Found ${rowCount} results:\n\n`;

  // For aggregate results (single row with aggregates)
  if (rowCount === 1 && cols.some((c) => c.toLowerCase().includes('count') || c.toLowerCase().includes('sum') || c.toLowerCase().includes('avg'))) {
    for (const col of cols) {
      response += `- **${formatColumnName(col)}**: ${formatValue(rows[0][col])}\n`;
    }
    return response.trim();
  }

  // For list results, show first few rows
  const maxRowsInSummary = 5;
  const rowsToShow = Math.min(maxRowsInSummary, rows.length);

  for (let i = 0; i < rowsToShow; i++) {
    const row = rows[i];
    response += `${i + 1}. `;

    // Show up to 3 columns in natural language
    const colsToShow = cols.slice(0, 3);
    const parts = colsToShow.map((col) => {
      return `${formatColumnName(col)}: ${formatValue(row[col])}`;
    });

    response += parts.join(', ');

    if (cols.length > 3) {
      response += ` (and ${cols.length - 3} more fields)`;
    }

    response += '\n';
  }

  if (rows.length > maxRowsInSummary) {
    response += `\n...and ${rows.length - maxRowsInSummary} more results.\n`;
  }

  response += '\n*See table view below for complete data.*';

  return response;
}

/**
 * Generate an ASCII table view of results
 */
function generateTableView(
  rows: any[],
  columns?: Array<{ name: string; dataTypeID: number }>
): string {
  if (!rows || rows.length === 0) {
    return '';
  }

  const cols = columns?.map((c) => c.name) || Object.keys(rows[0]);

  if (cols.length === 0) {
    return '';
  }

  // Calculate column widths
  const widths: number[] = [];
  for (const col of cols) {
    let maxWidth = col.length;

    for (const row of rows) {
      const value = formatValue(row[col], false);
      maxWidth = Math.max(maxWidth, value.length);
    }

    // Limit column width to 50 characters
    widths.push(Math.min(maxWidth, 50));
  }

  // Build table
  let table = '';

  // Header
  table += '| ';
  for (let i = 0; i < cols.length; i++) {
    table += cols[i].padEnd(widths[i]) + ' | ';
  }
  table += '\n';

  // Separator
  table += '| ';
  for (let i = 0; i < cols.length; i++) {
    table += '-'.repeat(widths[i]) + ' | ';
  }
  table += '\n';

  // Rows (limit to 100 for display)
  const maxRows = Math.min(rows.length, 100);
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i];
    table += '| ';
    for (let j = 0; j < cols.length; j++) {
      const value = formatValue(row[cols[j]], false);
      // Truncate if too long
      const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
      table += truncated.padEnd(widths[j]) + ' | ';
    }
    table += '\n';
  }

  if (rows.length > maxRows) {
    table += `\n... ${rows.length - maxRows} more rows not shown\n`;
  }

  return table;
}

/**
 * Format a column name for display (convert snake_case to Title Case)
 */
function formatColumnName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format a value for display
 */
function formatValue(value: any, useMarkdown: boolean = true): string {
  if (value === null || value === undefined) {
    return useMarkdown ? '*null*' : 'null';
  }

  if (typeof value === 'boolean') {
    return value ? (useMarkdown ? '**true**' : 'true') : (useMarkdown ? '**false**' : 'false');
  }

  if (typeof value === 'number') {
    // Format numbers with commas for readability
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    } else {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  // String value
  const str = String(value);

  // Truncate long strings
  if (str.length > 100) {
    return str.substring(0, 97) + '...';
  }

  return str;
}

/**
 * Generate a CSV representation of results
 * @param rows - Result rows
 * @param columns - Column definitions
 * @returns CSV string
 */
export function formatAsCSV(
  rows: any[],
  columns?: Array<{ name: string; dataTypeID: number }>
): string {
  if (!rows || rows.length === 0) {
    return '';
  }

  const cols = columns?.map((c) => c.name) || Object.keys(rows[0]);

  // Header
  let csv = cols.map((col) => `"${col}"`).join(',') + '\n';

  // Rows
  for (const row of rows) {
    const values = cols.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) {
        return '';
      }
      // Escape quotes and wrap in quotes
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    });
    csv += values.join(',') + '\n';
  }

  return csv;
}

/**
 * Generate a JSON representation of results
 * @param rows - Result rows
 * @returns JSON string
 */
export function formatAsJSON(rows: any[]): string {
  return JSON.stringify(rows, null, 2);
}
