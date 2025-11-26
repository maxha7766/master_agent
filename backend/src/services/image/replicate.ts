/**
 * Replicate Image Generation Service
 * Handles image generation, editing, and manipulation using Replicate API
 */

import Replicate from 'replicate';
import type {
  TextToImageParams,
  ImageToImageParams,
  InpaintParams,
  OutpaintParams,
  VariationParams,
  UpscaleParams,
  ImageGenerationResult,
  CreativityMode,
  ImageSize,
} from './types.js';

export class ReplicateImageService {
  private client: Replicate;

  // Model versions (stable hashes)
  private readonly models = {
    sdxl: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    sdxlImg2Img: 'stability-ai/sdxl:8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f',
    sdxlInpaint: 'stability-ai/stable-diffusion-inpainting:95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3',
    flux: 'black-forest-labs/flux-schnell',
    fluxDev: 'black-forest-labs/flux-dev',
    fluxDev2: 'black-forest-labs/flux-2-dev',
    fluxKontextPro: 'black-forest-labs/flux-kontext-pro', // Best for both text-to-image and editing
    upscale: 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
  };

  // Pricing per image (approximate, in USD)
  private readonly pricing = {
    sdxl: 0.004,
    flux: 0.003,
    fluxDev2: 0.025,
    fluxKontextPro: 0.04, // Kontext Pro pricing
    inpaint: 0.004,
    upscale: 0.005,
  };

  constructor(apiKey?: string) {
    this.client = new Replicate({
      auth: apiKey || process.env.REPLICATE_API_TOKEN,
    });
  }

  /**
   * Convert creativity mode to guidance scale
   */
  private creativityToGuidanceScale(mode: CreativityMode = 'balanced'): number {
    const scales = {
      precise: 12, // Higher = more precise to prompt
      balanced: 7.5,
      creative: 4, // Lower = more creative freedom
    };
    return scales[mode];
  }

  /**
   * Parse image size to dimensions
   */
  private parseImageSize(size?: ImageSize): { width: number; height: number } {
    const sizes = {
      '1024x1024': { width: 1024, height: 1024 },
      '1024x1792': { width: 1024, height: 1792 },
      '1792x1024': { width: 1792, height: 1024 },
      square: { width: 1024, height: 1024 },
      portrait: { width: 1024, height: 1792 },
      landscape: { width: 1792, height: 1024 },
    };
    return sizes[size || '1024x1024'];
  }

  /**
   * Convert size to aspect ratio for Flux Kontext Pro
   */
  private sizeToAspectRatio(size?: ImageSize): string {
    const ratios: Record<string, string> = {
      '1024x1024': '1:1',
      'square': '1:1',
      '1024x1792': '9:16',
      'portrait': '9:16',
      '1792x1024': '16:9',
      'landscape': '16:9',
    };
    return ratios[size || 'square'] || '1:1';
  }

  /**
   * Generate image from text prompt using Flux Kontext Pro
   */
  async generateImage(params: TextToImageParams): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const aspectRatio = this.sizeToAspectRatio(params.size);

    try {
      // Flux Kontext Pro: text-to-image (no input_image)
      const output = await this.client.run(this.models.fluxKontextPro as any, {
        input: {
          prompt: params.prompt,
          aspect_ratio: aspectRatio,
          output_format: 'png',
          safety_tolerance: 2,
          seed: params.seed,
        },
      });

      const imageUrl = Array.isArray(output) ? output[0] : (output as unknown as string);

      // Determine dimensions from aspect ratio
      const dimensions = this.parseImageSize(params.size);

      return {
        imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        model: 'flux-kontext-pro',
        operationType: 'text-to-image',
        parameters: {
          prompt: params.prompt,
          aspectRatio,
          seed: params.seed,
        },
        costUsd: this.pricing.fluxKontextPro,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Image generation failed:', error);
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Edit existing image using Flux Kontext Pro
   */
  async editImage(params: ImageToImageParams): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    try {
      // Flux Kontext Pro: image editing with input_image
      const output = await this.client.run(this.models.fluxKontextPro as any, {
        input: {
          prompt: params.prompt,
          input_image: params.sourceImage, // Single image URL for editing
          aspect_ratio: 'match_input_image', // Keep same dimensions
          output_format: 'png',
          safety_tolerance: 2,
          seed: params.seed,
        },
      });

      const imageUrl = Array.isArray(output) ? output[0] : (output as unknown as string);

      return {
        imageUrl,
        width: 1024,
        height: 1024,
        model: 'flux-kontext-pro',
        operationType: 'image-to-image',
        parameters: {
          prompt: params.prompt,
          sourceImage: typeof params.sourceImage === 'string' ? params.sourceImage : '[buffer]',
        },
        costUsd: this.pricing.fluxKontextPro,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Image editing failed:', error);
      throw new Error(`Failed to edit image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Inpaint specific parts of an image
   */
  async inpaint(params: InpaintParams): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const dimensions = this.parseImageSize(params.size);
    const guidanceScale =
      params.guidanceScale || this.creativityToGuidanceScale(params.creativityMode);

    try {
      const output = (await this.client.run(this.models.sdxlInpaint as any, {
        input: {
          image: params.sourceImage,
          mask: params.maskImage,
          prompt: params.prompt,
          negative_prompt: params.negativePrompt || 'blurry, low quality',
          guidance_scale: guidanceScale,
          num_inference_steps: params.numInferenceSteps || 50,
          seed: params.seed,
        },
      })) as string[];

      const imageUrl = Array.isArray(output) ? output[0] : output;

      return {
        imageUrl,
        width: params.width || dimensions.width,
        height: params.height || dimensions.height,
        model: 'sdxl-inpaint',
        operationType: 'inpaint',
        parameters: {
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          guidanceScale,
          steps: params.numInferenceSteps || 50,
        },
        costUsd: this.pricing.inpaint,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Inpainting failed:', error);
      throw new Error(`Failed to inpaint image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upscale an image
   */
  async upscale(params: UpscaleParams): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    try {
      const output = await this.client.run(this.models.upscale as any, {
        input: {
          image: params.sourceImage,
          scale: params.scaleFactor || 2,
        },
      }) as unknown as string;

      return {
        imageUrl: output,
        width: 0, // Unknown until processing
        height: 0,
        model: 'real-esrgan',
        operationType: 'upscale',
        parameters: {
          scaleFactor: params.scaleFactor || 2,
        },
        costUsd: this.pricing.upscale,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Upscaling failed:', error);
      throw new Error(`Failed to upscale image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create variations of an image
   */
  async createVariations(params: VariationParams): Promise<ImageGenerationResult[]> {
    const numVariations = params.numVariations || 3;
    const results: ImageGenerationResult[] = [];

    for (let i = 0; i < numVariations; i++) {
      const seed = params.seed ? params.seed + i : undefined;
      const result = await this.editImage({
        sourceImage: params.sourceImage,
        prompt: 'Create a variation of this image',
        strength: 0.5,
        seed,
      });
      results.push(result);
    }

    return results;
  }
}
