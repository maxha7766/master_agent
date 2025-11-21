/**
 * Excel Documentation Ingestion Script
 * Processes and ingests Excel documentation into the RAG database
 */

import { ExcelDocumentProcessor } from '../src/services/documents/excel-processor.js';
import { EXCEL_DOC_SOURCES } from '../src/config/excel-sources.js';
import { supabase } from '../src/models/database.js';
import { log } from '../src/lib/logger.js';
import type { ProcessedChunk, ProcessingResult } from '../src/services/documents/excel-processor.js';

interface IngestionOptions {
  // Source filtering
  sourceIds?: string[]; // Only process specific sources
  skipExisting?: boolean; // Skip sources already in database

  // Processing options
  targetTokens?: number;
  overlapTokens?: number;
  metadataBatchSize?: number;
  embeddingBatchSize?: number;

  // Rate limiting
  delayBetweenSources?: number;

  // Database options
  batchInsertSize?: number;
  dryRun?: boolean; // Process but don't insert into database
}

async function ingestExcelDocumentation(options: IngestionOptions = {}) {
  const {
    sourceIds,
    skipExisting = true,
    targetTokens = 600,
    overlapTokens = 100,
    metadataBatchSize = 5,
    embeddingBatchSize = 50,
    delayBetweenSources = 3000,
    batchInsertSize = 100,
    dryRun = false,
  } = options;

  log.info('Starting Excel documentation ingestion', {
    totalSources: EXCEL_DOC_SOURCES.length,
    sourceIds: sourceIds || 'all',
    dryRun,
  });

  // Filter sources if specific IDs provided
  let sourcesToProcess = EXCEL_DOC_SOURCES;
  if (sourceIds && sourceIds.length > 0) {
    sourcesToProcess = EXCEL_DOC_SOURCES.filter((source) =>
      sourceIds.includes(source.id)
    );
    log.info('Filtering sources', {
      requested: sourceIds.length,
      found: sourcesToProcess.length,
    });
  }

  // Check for existing sources if skipExisting is true
  if (skipExisting && !dryRun) {
    const existingSources = await getExistingSources();
    sourcesToProcess = sourcesToProcess.filter(
      (source) => !existingSources.has(source.id)
    );
    log.info('Skipping existing sources', {
      existing: existingSources.size,
      remaining: sourcesToProcess.length,
    });
  }

  if (sourcesToProcess.length === 0) {
    log.info('No sources to process');
    return;
  }

  // Initialize processor
  const processor = new ExcelDocumentProcessor();

  // Process all sources
  const results: ProcessingResult[] = [];

  for (const source of sourcesToProcess) {
    try {
      log.info('Processing source', {
        sourceId: source.id,
        sourceName: source.name,
      });

      const result = await processor.processSource(source, {
        targetTokens,
        overlapTokens,
        preserveCodeBlocks: true,
        extractMetadata: true,
        metadataBatchSize,
        generateEmbeddings: true,
        embeddingBatchSize,
      });

      results.push(result);

      // Insert chunks into database
      if (!dryRun && result.chunks.length > 0) {
        await insertChunksToDatabase(result, batchInsertSize);
      }

      log.info('Source ingestion complete', {
        sourceId: source.id,
        chunks: result.totalChunks,
        errors: result.errors.length,
      });

      // Rate limiting between sources
      if (delayBetweenSources > 0) {
        await delay(delayBetweenSources);
      }
    } catch (error) {
      log.error('Failed to process source', {
        sourceId: source.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Generate and log summary statistics
  const stats = processor.generateStats(results);

  log.info('Excel documentation ingestion complete', {
    ...stats,
    dryRun,
  });

  console.log('\n=== Excel Documentation Ingestion Summary ===');
  console.log(`Total Sources: ${stats.totalSources}`);
  console.log(`Successful: ${stats.successfulSources}`);
  console.log(`Failed: ${stats.failedSources}`);
  console.log(`Total Chunks: ${stats.totalChunks}`);
  console.log(`Total Tokens: ${stats.totalTokens.toLocaleString()}`);
  console.log(`Avg Chunks/Source: ${stats.averageChunksPerSource}`);
  console.log(`Avg Tokens/Chunk: ${stats.averageTokensPerChunk}`);
  console.log(`Unique Functions: ${stats.uniqueFunctions}`);
  console.log(`Unique Categories: ${stats.uniqueCategories}`);
  console.log(`Processing Time: ${(stats.totalProcessingTimeMs / 1000).toFixed(2)}s`);
  console.log(`Dry Run: ${dryRun ? 'Yes (no database changes)' : 'No'}`);
  console.log('==========================================\n');

  return stats;
}

/**
 * Get existing Excel source IDs from database
 */
async function getExistingSources(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('chunks')
      .select('metadata')
      .or('metadata->>source_type.eq.microsoft_docs,metadata->>source_type.eq.third_party')
      .not('metadata->>doc_category', 'is', null);

    if (error) throw error;

    const sourceUrls = new Set<string>();
    if (data) {
      for (const row of data) {
        const metadata = row.metadata as any;
        if (metadata?.source_url) {
          sourceUrls.add(metadata.source_url);
        }
      }
    }

    // Map URLs back to source IDs
    const existingIds = new Set<string>();
    for (const source of EXCEL_DOC_SOURCES) {
      if (source.url && sourceUrls.has(source.url)) {
        existingIds.add(source.id);
      }
    }

    return existingIds;
  } catch (error) {
    log.error('Failed to get existing sources', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set();
  }
}

/**
 * Get or create the Excel Function Knowledge document
 */
async function getExcelKnowledgeDocument(): Promise<{ documentId: string; userId: string }> {
  // Try to find existing document
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id, user_id')
    .eq('file_name', 'Excel Function Knowledge')
    .single();

  if (existingDoc) {
    return {
      documentId: existingDoc.id,
      userId: existingDoc.user_id,
    };
  }

  // Create new document if it doesn't exist
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (!users || users.length === 0) {
    throw new Error('No users found in database - cannot create system document');
  }

  const { data: newDoc, error: createError } = await supabase
    .from('documents')
    .insert({
      file_name: 'Excel Function Knowledge',
      file_type: 'system',
      file_size: 1,
      file_url: 'system://excel-knowledge',
      status: 'completed',
      user_id: users[0].id,
      summary: 'Detailed knowledge about Excel functions including formulas, syntax, examples, and troubleshooting. Covers all major function categories: Lookup & Reference, Text, Logical, Math & Trig, Date & Time, Financial, Statistical, Engineering, Information, and Database functions.',
      title: 'Excel Function Knowledge',
    })
    .select('id, user_id')
    .single();

  if (createError || !newDoc) {
    throw new Error(`Failed to create Excel knowledge document: ${createError?.message}`);
  }

  return {
    documentId: newDoc.id,
    userId: newDoc.user_id,
  };
}

/**
 * Insert processed chunks into database in batches
 */
async function insertChunksToDatabase(
  result: ProcessingResult,
  batchSize: number
): Promise<void> {
  const chunks = result.chunks;

  log.info('Inserting chunks to database', {
    sourceId: result.sourceId,
    totalChunks: chunks.length,
    batchSize,
  });

  // Get the Excel knowledge document ID and user ID
  const { documentId, userId } = await getExcelKnowledgeDocument();
  log.info('Using Excel knowledge document', { documentId, userId });

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    try {
      await insertBatch(batch, documentId, userId);

      log.info('Batch inserted', {
        sourceId: result.sourceId,
        batchStart: i,
        batchSize: batch.length,
        progress: `${Math.min(i + batchSize, chunks.length)}/${chunks.length}`,
      });
    } catch (error) {
      log.error('Failed to insert batch', {
        sourceId: result.sourceId,
        batchStart: i,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  log.info('All chunks inserted', {
    sourceId: result.sourceId,
    totalChunks: chunks.length,
  });
}

/**
 * Insert a batch of chunks into the database
 */
async function insertBatch(chunks: ProcessedChunk[], documentId: string, userId: string): Promise<void> {
  if (chunks.length === 0) return;

  const rows = chunks.map((chunk, i) => ({
    document_id: documentId,
    user_id: userId,
    content: chunk.content,
    embedding: chunk.embedding, // Pass array directly - Supabase handles pgvector conversion
    token_count: chunk.tokens, // Changed from 'tokens' to 'token_count'
    chunk_index: i,
    position: i,
    metadata: chunk.metadata,
  }));

  console.log(`Attempting to insert ${rows.length} chunks...`);
  console.log('First chunk metadata:', JSON.stringify(rows[0].metadata, null, 2));

  const { data, error } = await supabase.from('chunks').insert(rows).select();

  if (error) {
    console.error('Insert error:', error);
    throw new Error(`Failed to insert chunks: ${error.message}`);
  }

  console.log(`Successfully inserted ${data?.length || 0} chunks`);
}

/**
 * Delete all Excel documentation from database
 */
async function deleteExcelDocumentation(): Promise<void> {
  log.warn('Deleting all Excel documentation from database');

  const { error, count } = await supabase
    .from('chunks')
    .delete()
    .or('metadata->>source_type.eq.microsoft_docs,metadata->>source_type.eq.third_party')
    .not('metadata->>doc_category', 'is', null);

  if (error) {
    log.error('Failed to delete Excel documentation', { error: error.message });
    throw error;
  }

  log.info('Excel documentation deleted', {
    deletedRows: count,
  });

  console.log(`Deleted ${count} Excel documentation chunks`);
}

/**
 * Get statistics about existing Excel documentation
 */
async function getExcelStats(): Promise<void> {
  log.info('Fetching Excel documentation statistics');

  // Get all Excel chunks
  const { data, error } = await supabase
    .from('chunks')
    .select('metadata')
    .or('metadata->>source_type.eq.microsoft_docs,metadata->>source_type.eq.third_party')
    .not('metadata->>doc_category', 'is', null);

  if (error) {
    log.error('Failed to fetch Excel stats', { error: error.message });
    throw error;
  }

  const chunks = data || [];
  const total = chunks.length;

  // Count by source type
  const sourceTypeCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const uniqueFunctions = new Set<string>();

  for (const chunk of chunks) {
    const metadata = chunk.metadata as any;

    if (metadata?.source_type) {
      sourceTypeCounts.set(
        metadata.source_type,
        (sourceTypeCounts.get(metadata.source_type) || 0) + 1
      );
    }

    if (metadata?.function_category) {
      categoryCounts.set(
        metadata.function_category,
        (categoryCounts.get(metadata.function_category) || 0) + 1
      );
    }

    if (metadata?.function_name) {
      uniqueFunctions.add(metadata.function_name);
    }
  }

  // Sort categories by count
  const sortedCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\n=== Excel Documentation Statistics ===');
  console.log(`Total Chunks: ${total}`);
  console.log('\nBy Source Type:');
  for (const [sourceType, count] of sourceTypeCounts.entries()) {
    console.log(`  ${sourceType}: ${count}`);
  }
  console.log('\nTop Function Categories:');
  for (const [category, count] of sortedCategories) {
    console.log(`  ${category}: ${count}`);
  }
  console.log(`\nUnique Functions: ${uniqueFunctions.size}`);
  console.log('=====================================\n');
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'ingest':
    // Full ingestion
    ingestExcelDocumentation({
      skipExisting: true,
      delayBetweenSources: 3000,
    })
      .then(() => {
        log.info('Ingestion complete');
        process.exit(0);
      })
      .catch((error) => {
        log.error('Ingestion failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
    break;

  case 'ingest-source':
    // Ingest specific source
    const sourceId = process.argv[3];
    if (!sourceId) {
      console.error('Usage: npm run ingest-excel-docs ingest-source <source-id>');
      process.exit(1);
    }
    ingestExcelDocumentation({
      sourceIds: [sourceId],
      skipExisting: false,
    })
      .then(() => {
        log.info('Source ingestion complete');
        process.exit(0);
      })
      .catch((error) => {
        log.error('Source ingestion failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
    break;

  case 'dry-run':
    // Test run without database changes
    ingestExcelDocumentation({
      dryRun: true,
      skipExisting: false,
    })
      .then(() => {
        log.info('Dry run complete');
        process.exit(0);
      })
      .catch((error) => {
        log.error('Dry run failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
    break;

  case 'delete':
    // Delete all Excel documentation
    deleteExcelDocumentation()
      .then(() => {
        log.info('Delete complete');
        process.exit(0);
      })
      .catch((error) => {
        log.error('Delete failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
    break;

  case 'stats':
    // Show statistics
    getExcelStats()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        log.error('Stats failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
    break;

  default:
    console.log('Excel Documentation Ingestion Script');
    console.log('');
    console.log('Usage:');
    console.log('  npm run ingest-excel-docs ingest              # Ingest all sources');
    console.log('  npm run ingest-excel-docs ingest-source <id>  # Ingest specific source');
    console.log('  npm run ingest-excel-docs dry-run             # Test without database changes');
    console.log('  npm run ingest-excel-docs stats               # Show statistics');
    console.log('  npm run ingest-excel-docs delete              # Delete all Excel docs');
    console.log('');
    console.log('Available Sources:');
    for (const source of EXCEL_DOC_SOURCES) {
      console.log(`  - ${source.id}: ${source.name}`);
    }
    process.exit(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
