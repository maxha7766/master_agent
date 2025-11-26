/**
 * Images Routes
 * Handles image uploads for the image generation feature
 */

import { Router, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { ImageStorageService } from '../../services/image/storage.js';
import { ValidationError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';

export const imagesRouter = Router();

// Apply auth middleware to all routes
imagesRouter.use(authMiddleware);

// Initialize storage service
const imageStorage = new ImageStorageService();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported image type: ${file.mimetype}. Allowed: PNG, JPEG, WebP, GIF`));
    }
  },
});

/**
 * POST /api/images/upload
 * Upload an image and return a public URL
 */
imagesRouter.post(
  '/upload',
  upload.single('image'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        throw new ValidationError('No image uploaded');
      }

      log.info('Image upload started', {
        userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      // Ensure bucket exists
      await imageStorage.ensureBucketExists();

      // Upload to Supabase Storage
      const result = await imageStorage.uploadFromBuffer(file.buffer, userId, {
        contentType: file.mimetype,
      });

      log.info('Image upload completed', {
        userId,
        path: result.path,
        publicUrl: result.publicUrl,
      });

      res.status(201).json({
        success: true,
        url: result.publicUrl,
        path: result.path,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/images
 * List user's uploaded images
 */
imagesRouter.get(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const images = await imageStorage.listUserImages(userId);

      res.json({
        images: images.map((path) => ({
          path,
          url: `${process.env.SUPABASE_URL}/storage/v1/object/public/user-images/${path}`,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/images/:path
 * Delete an uploaded image
 */
imagesRouter.delete(
  '/:path(*)',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const imagePath = req.params.path;

      // Ensure user can only delete their own images
      if (!imagePath.startsWith(userId)) {
        throw new ValidationError('Cannot delete images from other users');
      }

      await imageStorage.deleteImage(imagePath);

      log.info('Image deleted', {
        userId,
        path: imagePath,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
