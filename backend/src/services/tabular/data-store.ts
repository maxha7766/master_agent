/**
 * Data Storage Service
 * Handles batch insertion of tabular data into document_data table
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import type { ParsedRow } from './parser.js';

export interface StorageProgress {
  totalRows: number;
  processedRows: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
}

export interface StorageResult {
  success: boolean;
  rowsStored: number;
  error?: string;
}

export class DataStoreService {
  private readonly BATCH_SIZE = 1000;

  /**
   * Store parsed rows in document_data table in batches
   */
  async storeData(
    documentId: string,
    rows: ParsedRow[],
    documentMetadata: { file_name: string; user_description?: string },
    onProgress?: (progress: StorageProgress) => void
  ): Promise<StorageResult> {
    try {
      log.info('Starting data storage', {
        documentId,
        totalRows: rows.length,
        batchSize: this.BATCH_SIZE,
      });

      const totalBatches = Math.ceil(rows.length / this.BATCH_SIZE);
      let processedRows = 0;

      // Prepare metadata for AI agent context
      const metadata = {
        document_id: documentId,
        file_name: documentMetadata.file_name,
        user_description: documentMetadata.user_description || null,
      };

      // Process in batches
      for (let i = 0; i < totalBatches; i++) {
        const start = i * this.BATCH_SIZE;
        const end = Math.min(start + this.BATCH_SIZE, rows.length);
        const batch = rows.slice(start, end);

        // Convert to document_data format with metadata
        const dataRecords = batch.map((row, index) => ({
          document_id: documentId,
          row_data: row, // Store entire row as JSONB
          row_index: start + index, // Maintain original row position
          document_metadata: metadata, // Add document context for AI
        }));

        // Insert batch
        const { error } = await supabase.from('document_data').insert(dataRecords);

        if (error) {
          log.error('Batch insertion failed', {
            documentId,
            batch: i + 1,
            error: error.message,
          });
          throw new Error(`Batch ${i + 1} insertion failed: ${error.message}`);
        }

        processedRows += batch.length;

        // Report progress
        if (onProgress) {
          onProgress({
            totalRows: rows.length,
            processedRows,
            percentage: Math.round((processedRows / rows.length) * 100),
            currentBatch: i + 1,
            totalBatches,
          });
        }

        log.debug('Batch stored', {
          batch: i + 1,
          totalBatches,
          rowsInBatch: batch.length,
          processedRows,
        });
      }

      // Update row_count in documents table
      const { error: updateError } = await supabase
        .from('documents')
        .update({ row_count: rows.length })
        .eq('id', documentId);

      if (updateError) {
        log.warn('Failed to update row_count', {
          documentId,
          error: updateError.message,
        });
        // Don't fail the entire operation for this
      }

      log.info('Data storage complete', {
        documentId,
        rowsStored: rows.length,
        batches: totalBatches,
      });

      return {
        success: true,
        rowsStored: rows.length,
      };
    } catch (error) {
      log.error('Data storage failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        rowsStored: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete all data for a document
   */
  async deleteData(documentId: string): Promise<boolean> {
    try {
      log.info('Deleting document data', { documentId });

      const { error } = await supabase
        .from('document_data')
        .delete()
        .eq('document_id', documentId);

      if (error) {
        log.error('Data deletion failed', {
          documentId,
          error: error.message,
        });
        return false;
      }

      log.info('Document data deleted', { documentId });
      return true;
    } catch (error) {
      log.error('Data deletion error', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get row count for a document
   */
  async getRowCount(documentId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('document_data')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (error) {
        log.error('Row count query failed', {
          documentId,
          error: error.message,
        });
        return 0;
      }

      return count || 0;
    } catch (error) {
      log.error('Row count error', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get sample rows from a document (for preview)
   */
  async getSampleRows(documentId: string, limit: number = 10): Promise<ParsedRow[]> {
    try {
      const { data, error } = await supabase
        .from('document_data')
        .select('row_data')
        .eq('document_id', documentId)
        .order('row_index', { ascending: true })
        .limit(limit);

      if (error) {
        log.error('Sample rows query failed', {
          documentId,
          error: error.message,
        });
        return [];
      }

      return data?.map((row) => row.row_data) || [];
    } catch (error) {
      log.error('Sample rows error', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if document has stored data
   */
  async hasData(documentId: string): Promise<boolean> {
    const count = await this.getRowCount(documentId);
    return count > 0;
  }
}

// Export singleton
export const dataStoreService = new DataStoreService();
