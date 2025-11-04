/**
 * Documents Routes
 * Manages document uploads, processing, and retrieval
 */

import { Router, type Response, type NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from '../../models/database.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { documentProcessor } from '../../services/documents/processor.js';
import { tabularParser } from '../../services/tabular/parser.js';
import { schemaDiscoveryAgent } from '../../services/tabular/schema-discovery.js';
import { dataStoreService } from '../../services/tabular/data-store.js';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';

export const documentsRouter = Router();

// Apply auth middleware to all routes
documentsRouter.use(authMiddleware);

/**
 * Helper: Check if file is tabular data (CSV/Excel)
 */
function isTabularFile(mimeType: string): boolean {
  return [
    'text/csv',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ].includes(mimeType);
}

/**
 * Helper: Handle tabular file upload (CSV/Excel)
 */
async function handleTabularUpload(
  userId: string,
  file: Express.Multer.File,
  userDescription?: string
): Promise<any> {
  try {
    // 1. Parse CSV/Excel file
    log.info('Parsing tabular file', {
      userId,
      fileName: file.originalname,
      mimeType: file.mimetype,
    });

    const parseResult = await tabularParser.parse(file.buffer, file.mimetype);

    // Validate data quality
    const validation = tabularParser.validateData(parseResult);
    if (!validation.isValid) {
      throw new ValidationError(`Data validation failed: ${validation.issues.join(', ')}`);
    }

    // 2. Compute content hash for deduplication
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(parseResult.rows))
      .digest('hex');

    // Check for duplicates
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id, file_name, status, row_count')
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .single();

    if (existingDoc) {
      log.info('Duplicate tabular document detected', {
        userId,
        existingDocId: existingDoc.id,
      });

      return {
        id: existingDoc.id,
        fileName: existingDoc.file_name,
        fileType: file.mimetype,
        fileSize: file.size,
        status: existingDoc.status,
        rowCount: existingDoc.row_count,
        duplicate: true,
        message: `This data already exists as "${existingDoc.file_name}"`,
      };
    }

    // 3. Create document record
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        file_name: file.originalname,
        file_type: file.mimetype,
        file_size: file.size,
        file_url: '',
        content_hash: contentHash,
        user_description: userDescription || null,
        row_count: parseResult.rowCount,
        column_count: parseResult.columnCount,
        status: 'processing',
      })
      .select()
      .single();

    if (dbError) {
      log.error('Document record creation failed', {
        error: dbError.message,
        userId,
      });
      throw new Error(`Failed to create document record: ${dbError.message}`);
    }

    // 4. Process tabular data asynchronously
    processTabularDocument(document.id, userId, file.originalname, parseResult, userDescription).catch((error) => {
      log.error('Tabular document processing failed', {
        error: error.message,
        documentId: document.id,
        userId,
      });
    });

    return {
      id: document.id,
      fileName: document.file_name,
      fileType: document.file_type,
      fileSize: document.file_size,
      status: document.status,
      rowCount: parseResult.rowCount,
      columnCount: parseResult.columnCount,
      createdAt: document.created_at,
    };
  } catch (error) {
    log.error('Tabular upload failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Process tabular document (async background job)
 */
async function processTabularDocument(
  documentId: string,
  userId: string,
  fileName: string,
  parseResult: any,
  userDescription?: string
): Promise<void> {
  try {
    log.info('Starting tabular document processing', {
      documentId,
      rowCount: parseResult.rowCount,
    });

    // Update progress: 10%
    await supabase
      .from('documents')
      .update({ processing_progress: 10 })
      .eq('id', documentId);

    // 1. Discover schema using AI
    const schema = await schemaDiscoveryAgent.discoverSchema(
      parseResult.rows,
      parseResult.columns,
      userDescription
    );

    // Update progress: 40%
    await supabase
      .from('documents')
      .update({ processing_progress: 40 })
      .eq('id', documentId);

    // 2. Store data in batches with metadata
    const storeResult = await dataStoreService.storeData(
      documentId,
      parseResult.rows,
      {
        file_name: fileName,
        user_description: userDescription,
      },
      (progress) => {
        // Update progress: 40% -> 90% based on storage progress
        const progressPercent = 40 + Math.floor(progress.percentage * 0.5);
        supabase
          .from('documents')
          .update({ processing_progress: progressPercent })
          .eq('id', documentId)
          .then(() => {});
      }
    );

    if (!storeResult.success) {
      throw new Error(`Data storage failed: ${storeResult.error}`);
    }

    // Update progress: 95%
    await supabase
      .from('documents')
      .update({ processing_progress: 95 })
      .eq('id', documentId);

    // 3. Update document with schema and final status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        semantic_schema: schema,
        data_quality_score: schema.data_quality_score,
        status: 'completed',
        processed_at: new Date().toISOString(),
        processing_progress: 100,
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    log.info('Tabular document processing complete', {
      documentId,
      rowsStored: storeResult.rowsStored,
      qualityScore: schema.data_quality_score,
    });
  } catch (error) {
    log.error('Tabular document processing failed', {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Mark as failed
    await supabase
      .from('documents')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq('id', documentId);
  }
}

// Configure multer for file uploads (memory storage only, no file persistence)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept text files, PDFs, and tabular data files
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'text/csv',
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/**
 * POST /api/documents
 * Upload and process a document
 */
documentsRouter.post(
  '/',
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        throw new ValidationError('No file uploaded');
      }

      log.info('Document upload started', {
        userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      // Branch: Tabular files (CSV/Excel) vs Text documents (PDF/TXT)
      if (isTabularFile(file.mimetype)) {
        // ===== TABULAR FILE PROCESSING =====
        const result = await handleTabularUpload(userId, file, req.body.description);
        return res.status(201).json(result);
      }

      // ===== TEXT DOCUMENT PROCESSING (existing logic) =====
      // Extract text content first (needed for hash)
      let textContent: string;
      if (file.mimetype === 'text/plain') {
        textContent = file.buffer.toString('utf-8');
      } else if (file.mimetype === 'application/pdf') {
        // Extract text from PDF using pdf-parse v2 API
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: file.buffer });
        const result = await parser.getText();
        textContent = result.text;

        if (!textContent || textContent.trim().length === 0) {
          throw new ValidationError('PDF appears to be empty or could not be parsed');
        }
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For DOCX, we'll need mammoth or similar
        // TODO: Add DOCX extraction
        throw new ValidationError('DOCX files are not yet supported');
      } else {
        throw new ValidationError(`Unsupported file type: ${file.mimetype}`);
      }

      // Compute SHA-256 hash of content for deduplication
      const contentHash = crypto
        .createHash('sha256')
        .update(textContent)
        .digest('hex');

      // Check if this exact content already exists for this user
      const { data: existingDoc, error: checkError } = await supabase
        .from('documents')
        .select('id, file_name, status, chunk_count')
        .eq('user_id', userId)
        .eq('content_hash', contentHash)
        .single();

      if (existingDoc) {
        log.info('Duplicate document detected', {
          userId,
          existingDocId: existingDoc.id,
          existingFileName: existingDoc.file_name,
          newFileName: file.originalname,
        });

        // Return existing document info
        return res.status(200).json({
          id: existingDoc.id,
          fileName: existingDoc.file_name,
          fileType: file.mimetype,
          fileSize: file.size,
          status: existingDoc.status,
          chunkCount: existingDoc.chunk_count,
          duplicate: true,
          message: `This document content already exists as "${existingDoc.file_name}"`,
        });
      }

      // Create document record (no file storage needed)
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          file_url: '', // Not storing file
          content_hash: contentHash,
          status: 'processing',
        })
        .select()
        .single();

      if (dbError) {
        log.error('Document record creation failed', {
          error: dbError.message,
          userId,
        });
        throw new Error(`Failed to create document record: ${dbError.message}`);
      }

      // Process document asynchronously (don't await)
      documentProcessor
        .processDocument(document.id, userId, textContent, file.originalname)
        .catch((error) => {
          log.error('Document processing failed', {
            error: error.message,
            documentId: document.id,
            userId,
          });
        });

      res.status(201).json({
        id: document.id,
        fileName: document.file_name,
        fileType: document.file_type,
        fileSize: document.file_size,
        status: document.status,
        createdAt: document.created_at,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documents
 * List user's documents
 */
documentsRouter.get(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, file_name, title, file_type, file_size, status, chunk_count, row_count, column_count, created_at, processed_at, processing_progress')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      res.json(documents || []);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documents/:id
 * Get document details
 */
documentsRouter.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const documentId = req.params.id;

      const { data: document, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (error || !document) {
        throw new NotFoundError('Document not found');
      }

      res.json(document);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/documents/:id
 * Delete document and all associated data (chunks, vectors, tabular rows)
 */
documentsRouter.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const documentId = req.params.id;

      log.info('Starting document deletion', { userId, documentId });

      // 1. Get document info to check type
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('file_type, row_count')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !document) {
        throw new NotFoundError('Document not found');
      }

      // 2. Delete tabular data rows if tabular document
      if (document.row_count && document.row_count > 0) {
        log.info('Deleting tabular data rows', { documentId, rowCount: document.row_count });

        const { error: tabularDeleteError } = await supabase
          .from('tabular_data_rows')
          .delete()
          .eq('document_id', documentId);

        if (tabularDeleteError) {
          log.error('Failed to delete tabular data rows', {
            error: tabularDeleteError.message,
            documentId,
          });
          // Continue anyway - document table deletion will clean up references
        } else {
          log.info('Tabular data rows deleted', { documentId });
        }
      }

      // 3. Delete chunks (RAG embeddings) - should cascade via FK
      const { error: chunksDeleteError } = await supabase
        .from('chunks')
        .delete()
        .eq('document_id', documentId);

      if (chunksDeleteError) {
        log.error('Failed to delete document chunks', {
          error: chunksDeleteError.message,
          documentId,
        });
        // Continue anyway
      } else {
        log.info('Document chunks deleted', { documentId });
      }

      // 4. Delete document record
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete document: ${deleteError.message}`);
      }

      log.info('Document deleted successfully', {
        userId,
        documentId,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
