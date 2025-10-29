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
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';

export const documentsRouter = Router();

// Apply auth middleware to all routes
documentsRouter.use(authMiddleware);

// Configure multer for file uploads (memory storage only, no file persistence)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept text files and PDFs (for now)
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
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
        .select('id, file_name, file_type, file_size, status, chunk_count, created_at, processed_at, processing_progress')
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
 * Delete document and all associated chunks
 */
documentsRouter.delete(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const documentId = req.params.id;

      // Delete from database (cascades to chunks)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete document: ${deleteError.message}`);
      }

      log.info('Document deleted', {
        userId,
        documentId,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
