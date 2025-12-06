import Replicate from 'replicate';
import type {
    TextToVideoParams,
    ImageToVideoParams,
    VideoEditingParams,
    VideoGenerationResult,
} from './types.js';

export class ReplicateVideoService {
    private client: Replicate;

    // Model versions (stable hashes or aliases)
    private readonly models = {
        // Text-to-Video
        veo3: 'google/veo-3', // High quality, cinematic
        wan25: 'wan-video/wan-2.5-t2v-14b', // Fast, open source

        // Image-to-Video
        kling: 'kuaishou/kling-2.1', // High quality motion
        hailuo: 'minimax/hailuo-02', // Alternative high quality

        // Editing
        lumaModify: 'luma/modify-video',
        upscale: 'lucataco/real-esrgan-video',
    };

    // Approximate pricing per generation (USD)
    private readonly pricing = {
        veo3: 0.40, // Estimate for high quality
        wan25: 0.10,
        kling: 0.50, // Often more expensive
        hailuo: 0.30,
        editing: 0.20,
        upscale: 0.10,
    };

    constructor(apiKey?: string) {
        this.client = new Replicate({
            auth: apiKey || process.env.REPLICATE_API_TOKEN,
        });
    }

    /**
     * Generate video from text prompt
     */
    async generateVideo(params: TextToVideoParams): Promise<VideoGenerationResult> {
        const startTime = Date.now();

        // Default to Veo 3 for quality, or Wan 2.5 for speed/cost if specified (logic can be added later)
        // For now, let's default to Wan 2.5 as it's more cost effective for general use, 
        // or Veo 3 if we want "best". The plan said Veo 3 is primary.
        const modelId = this.models.veo3;
        const modelName = 'veo-3';
        const cost = this.pricing.veo3;

        try {
            // Veo 3 inputs
            const input = {
                prompt: params.prompt,
                negative_prompt: params.negativePrompt,
                aspect_ratio: params.aspectRatio || '16:9',
                resolution: params.resolution || '1080p',
                // Veo specific params might differ, adjusting to common Replicate patterns
            };

            // Run inference
            const output = await this.client.run(modelId as any, { input });

            // Output is usually a URL string
            const videoUrl = output as unknown as string;

            return {
                videoUrl,
                model: modelName,
                operationType: 'text-to-video',
                parameters: params,
                costUsd: cost,
                duration: params.duration || 5, // Veo usually does 5-10s
                processingTimeMs: Date.now() - startTime,
            };
        } catch (error) {
            console.error('Video generation failed:', error);
            throw new Error(`Failed to generate video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate video from image (Image-to-Video)
     */
    async imageToVideo(params: ImageToVideoParams): Promise<VideoGenerationResult> {
        const startTime = Date.now();
        const modelId = this.models.kling;
        const modelName = 'kling-2.1';
        const cost = this.pricing.kling;

        try {
            const input = {
                prompt: params.prompt,
                start_image: params.sourceImage,
                duration: params.duration || 5,
                cfg_scale: 0.5, // Standard for Kling
            };

            const output = await this.client.run(modelId as any, { input });
            const videoUrl = output as unknown as string;

            return {
                videoUrl,
                model: modelName,
                operationType: 'image-to-video',
                parameters: params,
                costUsd: cost,
                duration: params.duration || 5,
                processingTimeMs: Date.now() - startTime,
            };
        } catch (error) {
            console.error('Image-to-video failed:', error);
            throw new Error(`Failed to animate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Edit existing video
     */
    async editVideo(params: VideoEditingParams): Promise<VideoGenerationResult> {
        const startTime = Date.now();
        const modelId = this.models.lumaModify;
        const modelName = 'luma-modify';
        const cost = this.pricing.editing;

        try {
            const input = {
                video: params.sourceVideo,
                prompt: params.prompt,
                style: params.style || 'realistic',
            };

            const output = await this.client.run(modelId as any, { input });
            const videoUrl = output as unknown as string;

            return {
                videoUrl,
                model: modelName,
                operationType: 'video-editing',
                parameters: params,
                costUsd: cost,
                processingTimeMs: Date.now() - startTime,
            };
        } catch (error) {
            console.error('Video editing failed:', error);
            throw new Error(`Failed to edit video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
