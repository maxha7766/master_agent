/**
 * Supabase Storage Service for Images
 * Handles uploading, downloading, and managing images in Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

export class ImageStorageService {
  private supabase;
  private bucketName = 'user-images';

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
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        });
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      // Bucket might already exist, continue
    }
  }

  /**
   * Upload image from URL
   */
  async uploadFromUrl(
    imageUrl: string,
    userId: string,
    metadata?: {
      conversationId?: string;
      operationType?: string;
    }
  ): Promise<{ path: string; publicUrl: string }> {
    try {
      // Download image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/png';

      // Generate unique filename
      const extension = contentType.split('/')[1] || 'png';
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
      console.error('Error uploading image from URL:', error);
      throw new Error(
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload image from buffer
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
      const contentType = options?.contentType || 'image/png';
      const extension = contentType.split('/')[1] || 'png';
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
      console.error('Error uploading image from buffer:', error);
      throw new Error(
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete image from storage
   */
  async deleteImage(path: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error(
        `Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get signed URL for temporary access (if needed for private images)
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(path, expiresIn);

      if (error || !data) {
        throw new Error(`Failed to create signed URL: ${error?.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      throw new Error(
        `Failed to create signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List user's images
   */
  async listUserImages(userId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(userId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        throw new Error(`Failed to list images: ${error.message}`);
      }

      return data?.map((file) => `${userId}/${file.name}`) || [];
    } catch (error) {
      console.error('Error listing user images:', error);
      return [];
    }
  }
}
