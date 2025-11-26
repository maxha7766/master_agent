/**
 * Image Generation Tool for Master Orchestrator
 * Allows the master agent to generate, edit, and manipulate images
 */

import { ImageAgent } from '../../image/agent.js';
import type {
  TextToImageParams,
  ImageToImageParams,
  InpaintParams,
  UpscaleParams,
  VariationParams,
} from '../../../services/image/types.js';

const imageAgent = new ImageAgent();

// Initialize the agent
imageAgent.initialize().catch((error) => {
  console.error('Failed to initialize image agent:', error);
});

export const imageGenerationToolDefinition = {
  name: 'generate_image',
  description: `Generate, edit, or manipulate images using AI.

Capabilities:
- text-to-image: Create images from text descriptions
- image-to-image: Edit existing images with new prompts
- inpaint: Fill in specific parts of an image using a mask
- upscale: Enhance image resolution (2x or 4x)
- variation: Create variations of an existing image

Use this tool when the user asks to:
- Create, generate, or make an image
- Edit or modify an existing image
- Upscale or enhance an image
- Create variations of an image
- Visualize something

You can also proactively suggest image generation when it would enhance the conversation, such as:
- "Would you like me to generate a diagram of that?"
- "I can create a visualization of that concept if helpful"`,
  input_schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['text-to-image', 'image-to-image', 'inpaint', 'upscale', 'variation'],
        description:
          'The type of image operation to perform: text-to-image (create new), image-to-image (edit existing), inpaint (fill masked area), upscale (enhance resolution), variation (create similar images)',
      },
      prompt: {
        type: 'string',
        description:
          'Text description of what to generate or how to modify the image. Be detailed and specific for best results.',
      },
      negativePrompt: {
        type: 'string',
        description:
          'Optional. Things to avoid in the image (e.g., "blurry, low quality, distorted"). Default: "blurry, low quality, distorted, ugly"',
      },
      sourceImage: {
        type: 'string',
        description:
          'Required for image-to-image, inpaint, upscale, and variation operations. URL of the source image.',
      },
      maskImage: {
        type: 'string',
        description:
          'Required for inpaint operation. URL of black and white mask image indicating areas to fill.',
      },
      size: {
        type: 'string',
        enum: ['square', 'portrait', 'landscape', '1024x1024', '1024x1792', '1792x1024'],
        description: 'Image size/aspect ratio. Default: square (1024x1024)',
      },
      creativityMode: {
        type: 'string',
        enum: ['precise', 'balanced', 'creative'],
        description:
          'Control creative freedom: precise (12 guidance, follows prompt closely), balanced (7.5 guidance, moderate), creative (4 guidance, more artistic freedom). Default: balanced',
      },
      strength: {
        type: 'number',
        description:
          'For image-to-image only. 0-1 scale. How much to transform the source image (0=minimal change, 1=complete transformation). Default: 0.8',
      },
      scaleFactor: {
        type: 'number',
        enum: [2, 4],
        description: 'For upscale only. How much to enlarge the image. Default: 2',
      },
      numVariations: {
        type: 'number',
        description: 'For variation only. Number of variations to create (1-5). Default: 3',
      },
      seed: {
        type: 'number',
        description: 'Optional. Random seed for reproducible results.',
      },
    },
    required: ['operation', 'prompt'],
  },
};

/**
 * Execute image generation tool
 */
export async function executeImageGenerationTool(
  params: {
    operation: string;
    prompt: string;
    negativePrompt?: string;
    sourceImage?: string;
    maskImage?: string;
    size?: string;
    creativityMode?: 'precise' | 'balanced' | 'creative';
    strength?: number;
    scaleFactor?: number;
    numVariations?: number;
    seed?: number;
  },
  userId: string,
  conversationId?: string
): Promise<{
  success: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  metadata?: any;
  error?: string;
  costUsd?: number;
}> {
  try {
    const result = await imageAgent.processRequest({
      userId,
      conversationId,
      operation: params.operation as any,
      parameters: {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        sourceImage: params.sourceImage,
        maskImage: params.maskImage,
        size: params.size as any,
        creativityMode: params.creativityMode,
        strength: params.strength,
        scaleFactor: params.scaleFactor,
        numVariations: params.numVariations,
        seed: params.seed,
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Image generation failed',
      };
    }

    // Handle single image result
    if (!Array.isArray(result.data)) {
      return {
        success: true,
        imageUrl: result.data.generatedImageUrl,
        metadata: result.data,
        costUsd: result.costUsd,
      };
    }

    // Handle multiple images (variations)
    return {
      success: true,
      imageUrls: result.data.map((img: any) => img.generatedImageUrl),
      metadata: result.data,
      costUsd: result.costUsd,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
