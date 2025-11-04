/**
 * Tabular File Parser
 * Handles CSV and Excel file parsing
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { log } from '../../lib/logger.js';

export interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  columns: string[];
  rowCount: number;
  columnCount: number;
}

export class TabularParser {
  /**
   * Parse CSV file from buffer
   */
  async parseCSV(buffer: Buffer): Promise<ParseResult> {
    try {
      const csvString = buffer.toString('utf-8');

      return new Promise((resolve, reject) => {
        Papa.parse(csvString, {
          header: true, // Use first row as column names
          skipEmptyLines: true,
          dynamicTyping: true, // Auto-convert numbers
          complete: (results) => {
            const rows = results.data as ParsedRow[];
            const columns = results.meta.fields || [];

            log.info('CSV parsed successfully', {
              rowCount: rows.length,
              columnCount: columns.length,
            });

            resolve({
              rows,
              columns,
              rowCount: rows.length,
              columnCount: columns.length,
            });
          },
          error: (error) => {
            log.error('CSV parsing failed', { error: error.message });
            reject(new Error(`CSV parsing failed: ${error.message}`));
          },
        });
      });
    } catch (error) {
      log.error('CSV parsing error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse Excel file (XLSX/XLS) from buffer
   */
  async parseExcel(buffer: Buffer): Promise<ParseResult> {
    try {
      // Read workbook from buffer
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel file has no sheets');
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON (array of objects)
      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        header: undefined, // Use first row as headers
        defval: null, // Default value for empty cells
        blankrows: false, // Skip blank rows
      }) as ParsedRow[];

      if (rawRows.length === 0) {
        throw new Error('Excel sheet is empty');
      }

      // Extract column names from first row
      const columns = Object.keys(rawRows[0]);

      log.info('Excel parsed successfully', {
        sheetName,
        rowCount: rawRows.length,
        columnCount: columns.length,
      });

      return {
        rows: rawRows,
        columns,
        rowCount: rawRows.length,
        columnCount: columns.length,
      };
    } catch (error) {
      log.error('Excel parsing error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to parse Excel: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Auto-detect format and parse
   */
  async parse(buffer: Buffer, mimeType: string): Promise<ParseResult> {
    log.info('Parsing tabular file', { mimeType });

    if (mimeType === 'text/csv' || mimeType === 'application/csv') {
      return this.parseCSV(buffer);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return this.parseExcel(buffer);
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  /**
   * Validate parsed data quality
   */
  validateData(parseResult: ParseResult): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for empty dataset
    if (parseResult.rowCount === 0) {
      issues.push('Dataset is empty');
      return { isValid: false, issues };
    }

    // Check for missing columns
    if (parseResult.columnCount === 0) {
      issues.push('No columns detected');
      return { isValid: false, issues };
    }

    // Check for duplicate column names
    const uniqueColumns = new Set(parseResult.columns);
    if (uniqueColumns.size !== parseResult.columns.length) {
      issues.push('Duplicate column names detected');
    }

    // Check for columns with only null values
    const nullColumnsCount = parseResult.columns.filter((col) => {
      return parseResult.rows.every((row) => row[col] == null);
    }).length;

    if (nullColumnsCount > 0) {
      issues.push(`${nullColumnsCount} column(s) contain only null values`);
    }

    // Check for completely empty rows
    const emptyRowsCount = parseResult.rows.filter((row) => {
      return Object.values(row).every((val) => val == null || val === '');
    }).length;

    if (emptyRowsCount > 0) {
      issues.push(`${emptyRowsCount} empty row(s) detected`);
    }

    // Warnings (not blocking)
    const nullPercentage =
      (parseResult.rows.reduce((sum, row) => {
        const nullCount = Object.values(row).filter((v) => v == null).length;
        return sum + nullCount;
      }, 0) /
        (parseResult.rowCount * parseResult.columnCount)) *
      100;

    if (nullPercentage > 30) {
      issues.push(`High null rate: ${nullPercentage.toFixed(1)}% of cells are empty`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get sample rows for schema discovery
   */
  getSample(parseResult: ParseResult, sampleSize: number = 100): ParsedRow[] {
    return parseResult.rows.slice(0, sampleSize);
  }
}

// Export singleton instance
export const tabularParser = new TabularParser();
