/**
 * Document Management API Routes
 * Handles document upload, retrieval, and deletion
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { supabase } from '../../models/database.js';
import { documentUploadPipeline } from '../../services/embeddings/upload.js';
import { log } from '../../lib/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = \`\${uuidv4()}\${path.extname(file.originalname)}\`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/markdown',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: PDF, TXT, DOCX, CSV, XLSX, MD'));
    }
  },
});

/**
 * POST /api/documents
 * Upload and process a new document
 */
router.post('/', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const file = req.file;
  const filePath = file.path;
  const fileName = file.originalname;

  try {
    log.info('Document upload started', {
      userId,
      fileName,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    // Create document record with 'processing' status
    const { data: document, error: createError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_size: file.size,
        file_type: file.mimetype,
        status: 'processing',
      })
      .select()
      .single();

    if (createError || !document) {
      log.error('Failed to create document record', {
        error: createError?.message,
        userId,
        fileName,
      });
      await fs.unlink(filePath); // Clean up uploaded file
      return res.status(500).json({ error: 'Failed to create document record' });
    }

    // Start async processing (don't wait for completion)
    documentUploadPipeline
      .processDocument(filePath, fileName, document.id, userId)
      .then(async () => {
        // Update status to completed
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', document.id);

        log.info('Document processing completed', {
          documentId: document.id,
          userId,
          fileName,
        });
      })
      .catch(async (error) => {
        // Update status to failed
        await supabase
          .from('documents')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', document.id);

        log.error('Document processing failed', {
          documentId: document.id,
          userId,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(async () => {
        // Clean up uploaded file
        try {
          await fs.unlink(filePath);
        } catch (err) {
          log.warn('Failed to clean up uploaded file', {
            filePath,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

    // Return immediately with processing status
    res.status(202).json({
      id: document.id,
      fileName: document.file_name,
      status: document.status,
      message: 'Document upload started. Processing in background.',
    });
  } catch (error) {
    log.error('Document upload failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      fileName,
    });

    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore cleanup errors
    }

    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * GET /api/documents
 * List all documents for authenticated user
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, file_name, file_size, file_type, status, error_message, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch documents', {
        error: error.message,
        userId,
      });
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({ documents: documents || [] });
  } catch (error) {
    log.error('Documents list failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/**
 * GET /api/documents/:id
 * Get details about a specific document
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const documentId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (error || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get chunk count
    const { count: chunkCount } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);

    res.json({
      ...document,
      chunkCount: chunkCount || 0,
    });
  } catch (error) {
    log.error('Document fetch failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      documentId,
    });
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and all its chunks
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const documentId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify document belongs to user
    const { data: document } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete chunks first (foreign key constraint)
    const { error: chunksError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', documentId);

    if (chunksError) {
      log.error('Failed to delete chunks', {
        error: chunksError.message,
        documentId,
        userId,
      });
      return res.status(500).json({ error: 'Failed to delete document chunks' });
    }

    // Delete document
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (docError) {
      log.error('Failed to delete document', {
        error: docError.message,
        documentId,
        userId,
      });
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    log.info('Document deleted', {
      documentId,
      userId,
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    log.error('Document deletion failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      documentId,
    });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
