/**
 * Videos Routes
 * Handles video uploads for the video generation feature
 */

import { Router, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { VideoStorageService } from '../../services/video/storage.js';
import { ValidationError } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';

export const videosRouter = Router();

// Apply auth middleware to all routes
videosRouter.use(authMiddleware);

// Initialize storage service
const videoStorage = new VideoStorageService();

// Configure multer for video uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ValidationError(`Unsupported video type: ${file.mimetype}. Allowed: MP4, WebM, QuickTime`));
        }
    },
});

/**
 * POST /api/videos/upload
 * Upload a video and return a public URL
 */
videosRouter.post(
    '/upload',
    upload.single('video'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;
            const file = req.file;

            if (!file) {
                throw new ValidationError('No video uploaded');
            }

            log.info('Video upload started', {
                userId,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
            });

            // Ensure bucket exists
            await videoStorage.ensureBucketExists();

            // Upload to Supabase Storage
            const result = await videoStorage.uploadFromBuffer(file.buffer, userId, {
                contentType: file.mimetype,
            });

            log.info('Video upload completed', {
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
 * GET /api/videos
 * List user's uploaded videos
 */
videosRouter.get(
    '/',
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;

            const videos = await videoStorage.listUserVideos(userId);

            res.json({
                videos: videos.map((path) => ({
                    path,
                    url: `${process.env.SUPABASE_URL}/storage/v1/object/public/user-videos/${path}`,
                })),
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/videos/:userId/:filename
 * Delete an uploaded video
 */
videosRouter.delete(
    '/:videoUserId/:filename',
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user!.id;
            const { videoUserId, filename } = req.params;
            const videoPath = `${videoUserId}/${filename}`;

            // Ensure user can only delete their own videos
            if (!videoPath.startsWith(userId)) {
                throw new ValidationError('Cannot delete videos from other users');
            }

            await videoStorage.deleteVideo(videoPath);

            log.info('Video deleted', {
                userId,
                path: videoPath,
            });

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);
