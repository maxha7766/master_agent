import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

export class VideoStorageService {
    private supabase;
    private bucketName = 'user-videos';

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not configured');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    /**
     * Ensure the storage bucket exists
     */
    async ensureBucketExists(): Promise<void> {
        try {
            const { data: buckets } = await this.supabase.storage.listBuckets();
            const bucketExists = buckets?.some((b) => b.name === this.bucketName);

            if (!bucketExists) {
                await this.supabase.storage.createBucket(this.bucketName, {
                    public: true,
                    fileSizeLimit: 52428800, // 50MB (Videos are larger)
                    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
                });
            }
        } catch (error) {
            console.error('Error ensuring video bucket exists:', error);
        }
    }

    /**
     * Upload video from URL
     */
    async uploadFromUrl(
        videoUrl: string,
        userId: string,
        metadata?: {
            conversationId?: string;
            operationType?: string;
        }
    ): Promise<{ path: string; publicUrl: string }> {
        try {
            // Download video from URL
            const response = await fetch(videoUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch video: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get('content-type') || 'video/mp4';

            // Generate unique filename
            const extension = contentType.split('/')[1] || 'mp4';
            const filename = `${randomUUID()}.${extension}`;
            const path = `${userId}/${filename}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await this.supabase.storage
                .from(this.bucketName)
                .upload(path, buffer, {
                    contentType,
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const {
                data: { publicUrl },
            } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);

            return { path, publicUrl };
        } catch (error) {
            console.error('Error uploading video from URL:', error);
            throw new Error(
                `Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
   * Upload video from buffer
   */
    async uploadFromBuffer(
        buffer: Buffer,
        userId: string,
        options?: {
            contentType?: string;
            conversationId?: string;
            operationType?: string;
        }
    ): Promise<{ path: string; publicUrl: string }> {
        try {
            const contentType = options?.contentType || 'video/mp4';
            const extension = contentType.split('/')[1] || 'mp4';
            const filename = `${randomUUID()}.${extension}`;
            const path = `${userId}/${filename}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await this.supabase.storage
                .from(this.bucketName)
                .upload(path, buffer, {
                    contentType,
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // Get public URL
            const {
                data: { publicUrl },
            } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);

            return { path, publicUrl };
        } catch (error) {
            console.error('Error uploading video from buffer:', error);
            throw new Error(
                `Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * List user's videos
     */
    async listUserVideos(userId: string): Promise<string[]> {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .list(userId, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' },
                });

            if (error) {
                throw new Error(`Failed to list videos: ${error.message}`);
            }

            return data?.map((file) => `${userId}/${file.name}`) || [];
        } catch (error) {
            console.error('Error listing user videos:', error);
            return [];
        }
    }

    /**
     * Delete video from storage
     */
    async deleteVideo(path: string): Promise<void> {
        try {
            const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);
            if (error) {
                throw new Error(`Delete failed: ${error.message}`);
            }
        } catch (error) {
            console.error('Error deleting video:', error);
            throw new Error(
                `Failed to delete video: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
