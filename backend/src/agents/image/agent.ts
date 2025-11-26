/**
 * Image Generation Agent
 * Handles image creation, editing, and manipulation requests
 */

import { ReplicateImageService } from '../../services/image/replicate.js';
import { ImageStorageService } from '../../services/image/storage.js';
import { createClient } from '@supabase/supabase-js';
import type {
  TextToImageParams,
  ImageToImageParams,
  InpaintParams,
  UpscaleParams,
  VariationParams,
  ImageGenerationResult,
  ImageMetadata,
} from '../../services/image/types.js';

interface ImageAgentRequest {
  userId: string;
  conversationId?: string;
  operation:
    | 'text-to-image'
    | 'image-to-image'
    | 'inpaint'
    | 'outpaint'
    | 'variation'
    | 'upscale'
    | 'list-images';
  parameters: any;
}

interface ImageAgentResponse {
  success: boolean;
  data?: ImageMetadata | ImageMetadata[] | string[];
  error?: string;
  costUsd?: number;
}

export class ImageAgent {
  private replicateService: ReplicateImageService;
  private storageService: ImageStorageService;
  private supabase;

  constructor() {
    this.replicateService = new ReplicateImageService();
    this.storageService = new ImageStorageService();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Initialize the agent (ensure storage bucket exists)
   */
  async initialize(): Promise<void> {
    await this.storageService.ensureBucketExists();
  }

  /**
   * Process image generation request
   */
  async processRequest(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    try {
      switch (request.operation) {
        case 'text-to-image':
          return await this.handleTextToImage(request);
        case 'image-to-image':
          return await this.handleImageToImage(request);
        case 'inpaint':
          return await this.handleInpaint(request);
        case 'upscale':
          return await this.handleUpscale(request);
        case 'variation':
          return await this.handleVariation(request);
        case 'list-images':
          return await this.handleListImages(request);
        default:
          return {
            success: false,
            error: `Unknown operation: ${request.operation}`,
          };
      }
    } catch (error) {
      console.error('Image agent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Handle text-to-image generation
   */
  private async handleTextToImage(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    const params = request.parameters as TextToImageParams;

    if (!params.prompt) {
      return { success: false, error: 'Prompt is required for text-to-image generation' };
    }

    // Generate image using Replicate
    const result = await this.replicateService.generateImage(params);

    // Upload to Supabase Storage
    const { path, publicUrl } = await this.storageService.uploadFromUrl(
      result.imageUrl,
      request.userId,
      {
        conversationId: request.conversationId,
        operationType: 'text-to-image',
      }
    );

    // Save metadata to database
    const metadata = await this.saveImageMetadata({
      userId: request.userId,
      conversationId: request.conversationId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      generatedImageUrl: publicUrl,
      storagePath: path,
      model: result.model,
      operationType: result.operationType,
      parameters: result.parameters,
      costUsd: result.costUsd,
      width: result.width,
      height: result.height,
    });

    return {
      success: true,
      data: metadata,
      costUsd: result.costUsd,
    };
  }

  /**
   * Handle image-to-image editing
   */
  private async handleImageToImage(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    const params = request.parameters as ImageToImageParams;

    if (!params.sourceImage || !params.prompt) {
      return { success: false, error: 'Source image and prompt are required' };
    }

    // Generate edited image
    const result = await this.replicateService.editImage(params);

    // Upload to Supabase Storage
    const { path, publicUrl } = await this.storageService.uploadFromUrl(
      result.imageUrl,
      request.userId,
      {
        conversationId: request.conversationId,
        operationType: 'image-to-image',
      }
    );

    // Save metadata
    const metadata = await this.saveImageMetadata({
      userId: request.userId,
      conversationId: request.conversationId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      sourceImageUrl: typeof params.sourceImage === 'string' ? params.sourceImage : undefined,
      generatedImageUrl: publicUrl,
      storagePath: path,
      model: result.model,
      operationType: result.operationType,
      parameters: result.parameters,
      costUsd: result.costUsd,
      width: result.width,
      height: result.height,
    });

    return {
      success: true,
      data: metadata,
      costUsd: result.costUsd,
    };
  }

  /**
   * Handle inpainting
   */
  private async handleInpaint(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    const params = request.parameters as InpaintParams;

    if (!params.sourceImage || !params.maskImage || !params.prompt) {
      return { success: false, error: 'Source image, mask image, and prompt are required' };
    }

    // Generate inpainted image
    const result = await this.replicateService.inpaint(params);

    // Upload to Supabase Storage
    const { path, publicUrl } = await this.storageService.uploadFromUrl(
      result.imageUrl,
      request.userId,
      {
        conversationId: request.conversationId,
        operationType: 'inpaint',
      }
    );

    // Save metadata
    const metadata = await this.saveImageMetadata({
      userId: request.userId,
      conversationId: request.conversationId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      sourceImageUrl: typeof params.sourceImage === 'string' ? params.sourceImage : undefined,
      generatedImageUrl: publicUrl,
      storagePath: path,
      model: result.model,
      operationType: result.operationType,
      parameters: result.parameters,
      costUsd: result.costUsd,
      width: result.width,
      height: result.height,
    });

    return {
      success: true,
      data: metadata,
      costUsd: result.costUsd,
    };
  }

  /**
   * Handle image upscaling
   */
  private async handleUpscale(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    const params = request.parameters as UpscaleParams;

    if (!params.sourceImage) {
      return { success: false, error: 'Source image is required for upscaling' };
    }

    // Upscale image
    const result = await this.replicateService.upscale(params);

    // Upload to Supabase Storage
    const { path, publicUrl } = await this.storageService.uploadFromUrl(
      result.imageUrl,
      request.userId,
      {
        conversationId: request.conversationId,
        operationType: 'upscale',
      }
    );

    // Save metadata
    const metadata = await this.saveImageMetadata({
      userId: request.userId,
      conversationId: request.conversationId,
      prompt: 'Image upscaling',
      sourceImageUrl: typeof params.sourceImage === 'string' ? params.sourceImage : undefined,
      generatedImageUrl: publicUrl,
      storagePath: path,
      model: result.model,
      operationType: result.operationType,
      parameters: result.parameters,
      costUsd: result.costUsd,
      width: result.width,
      height: result.height,
    });

    return {
      success: true,
      data: metadata,
      costUsd: result.costUsd,
    };
  }

  /**
   * Handle image variations
   */
  private async handleVariation(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    const params = request.parameters as VariationParams;

    if (!params.sourceImage) {
      return { success: false, error: 'Source image is required for variations' };
    }

    // Generate variations
    const results = await this.replicateService.createVariations(params);

    // Upload all variations and save metadata
    const metadataList: ImageMetadata[] = [];
    let totalCost = 0;

    for (const result of results) {
      const { path, publicUrl } = await this.storageService.uploadFromUrl(
        result.imageUrl,
        request.userId,
        {
          conversationId: request.conversationId,
          operationType: 'variation',
        }
      );

      const metadata = await this.saveImageMetadata({
        userId: request.userId,
        conversationId: request.conversationId,
        prompt: 'Image variation',
        sourceImageUrl: typeof params.sourceImage === 'string' ? params.sourceImage : undefined,
        generatedImageUrl: publicUrl,
        storagePath: path,
        model: result.model,
        operationType: result.operationType,
        parameters: result.parameters,
        costUsd: result.costUsd,
        width: result.width,
        height: result.height,
      });

      metadataList.push(metadata);
      totalCost += result.costUsd;
    }

    return {
      success: true,
      data: metadataList,
      costUsd: totalCost,
    };
  }

  /**
   * List user's image history
   */
  private async handleListImages(request: ImageAgentRequest): Promise<ImageAgentResponse> {
    const { data, error } = await this.supabase
      .from('images')
      .select('*')
      .eq('user_id', request.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data as ImageMetadata[],
    };
  }

  /**
   * Save image metadata to database
   */
  private async saveImageMetadata(
    metadata: Omit<ImageMetadata, 'id' | 'createdAt'>
  ): Promise<ImageMetadata> {
    const { data, error } = await this.supabase
      .from('images')
      .insert({
        user_id: metadata.userId,
        conversation_id: metadata.conversationId,
        prompt: metadata.prompt,
        negative_prompt: metadata.negativePrompt,
        source_image_url: metadata.sourceImageUrl,
        generated_image_url: metadata.generatedImageUrl,
        storage_path: metadata.storagePath,
        model: metadata.model,
        operation_type: metadata.operationType,
        parameters: metadata.parameters,
        cost_usd: metadata.costUsd,
        width: metadata.width,
        height: metadata.height,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save image metadata: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      conversationId: data.conversation_id,
      prompt: data.prompt,
      negativePrompt: data.negative_prompt,
      sourceImageUrl: data.source_image_url,
      generatedImageUrl: data.generated_image_url,
      storagePath: data.storage_path,
      model: data.model,
      operationType: data.operation_type,
      parameters: data.parameters,
      costUsd: data.cost_usd,
      width: data.width,
      height: data.height,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get user's total image generation costs
   */
  async getUserImageCosts(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('images')
      .select('cost_usd')
      .eq('user_id', userId);

    if (error || !data) {
      return 0;
    }

    return data.reduce((total, row) => total + (row.cost_usd || 0), 0);
  }
}
