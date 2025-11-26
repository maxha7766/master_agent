/**
 * Image Generation Service Types
 */

export type OperationType =
  | 'text-to-image'
  | 'image-to-image'
  | 'inpaint'
  | 'outpaint'
  | 'variation'
  | 'upscale';

export type CreativityMode = 'precise' | 'balanced' | 'creative';

export type ImageSize = '1024x1024' | '1024x1792' | '1792x1024' | 'square' | 'portrait' | 'landscape';

export interface BaseImageParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  size?: ImageSize;
  guidanceScale?: number; // 1-20, controls prompt adherence
  numInferenceSteps?: number; // 10-150
  seed?: number; // For reproducibility
}

export interface TextToImageParams extends BaseImageParams {
  creativityMode?: CreativityMode;
}

export interface ImageToImageParams extends BaseImageParams {
  sourceImage: string | Buffer; // URL or file buffer
  strength?: number; // 0-1, how much to transform (0=no change, 1=complete transformation)
  creativityMode?: CreativityMode;
}

export interface InpaintParams extends BaseImageParams {
  sourceImage: string | Buffer;
  maskImage: string | Buffer; // Black and white mask
  creativityMode?: CreativityMode;
}

export interface OutpaintParams extends BaseImageParams {
  sourceImage: string | Buffer;
  left?: number; // Pixels to extend
  right?: number;
  up?: number;
  down?: number;
  creativityMode?: CreativityMode;
}

export interface VariationParams {
  sourceImage: string | Buffer;
  numVariations?: number;
  seed?: number;
}

export interface UpscaleParams {
  sourceImage: string | Buffer;
  scaleFactor?: number; // 2x, 4x
}

export interface ImageGenerationResult {
  imageUrl: string;
  width: number;
  height: number;
  model: string;
  operationType: OperationType;
  parameters: Record<string, any>;
  costUsd: number;
  processingTimeMs?: number;
}

export interface ImageMetadata {
  id: string;
  userId: string;
  conversationId?: string;
  prompt: string;
  negativePrompt?: string;
  sourceImageUrl?: string;
  generatedImageUrl: string;
  storagePath: string;
  model: string;
  operationType: OperationType;
  parameters: Record<string, any>;
  costUsd: number;
  width: number;
  height: number;
  createdAt: Date;
}
