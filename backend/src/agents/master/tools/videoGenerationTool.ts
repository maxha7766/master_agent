/**
 * Video Generation Tool for Master Orchestrator
 * Allows the master agent to generate and edit videos
 */

import { VideoAgent } from '../../video/agent.js';

const videoAgent = new VideoAgent();

// Initialize the agent
videoAgent.initialize().catch((error) => {
    console.error('Failed to initialize video agent:', error);
});

export const videoGenerationToolDefinition = {
    name: 'generate_video',
    description: `Generate or edit videos using AI.

Capabilities:
- text-to-video: Create videos from text descriptions
- image-to-video: Animate existing images
- video-editing: Edit existing videos with new prompts

Use this tool when the user asks to:
- Create, generate, or make a video
- Animate an image or picture
- Edit or modify a video
- "Make a video of..."

You can also proactively suggest video generation when it would enhance the conversation.`,
    input_schema: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['text-to-video', 'image-to-video', 'video-editing'],
                description:
                    'The type of video operation to perform.',
            },
            prompt: {
                type: 'string',
                description:
                    'Text description of what to generate or how to modify the video. Be detailed and specific.',
            },
            negativePrompt: {
                type: 'string',
                description:
                    'Optional. Things to avoid in the video.',
            },
            sourceImage: {
                type: 'string',
                description:
                    'Required for image-to-video. URL of the source image.',
            },
            sourceVideo: {
                type: 'string',
                description:
                    'Required for video-editing. URL of the source video.',
            },
            duration: {
                type: 'number',
                enum: [5, 10],
                description: 'Duration in seconds. Default: 5',
            },
            resolution: {
                type: 'string',
                enum: ['720p', '1080p'],
                description: 'Video resolution. Default: 720p',
            },
            aspectRatio: {
                type: 'string',
                enum: ['16:9', '9:16', '1:1'],
                description: 'Aspect ratio. Default: 16:9',
            },
        },
        required: ['operation', 'prompt'],
    },
};

/**
 * Execute video generation tool
 */
export async function executeVideoGenerationTool(
    params: {
        operation: string;
        prompt: string;
        negativePrompt?: string;
        sourceImage?: string;
        sourceVideo?: string;
        duration?: number;
        resolution?: string;
        aspectRatio?: string;
    },
    userId: string,
    conversationId?: string
): Promise<{
    success: boolean;
    videoUrl?: string;
    metadata?: any;
    error?: string;
    costUsd?: number;
}> {
    try {
        const result = await videoAgent.processRequest({
            userId,
            conversationId,
            operation: params.operation as any,
            parameters: {
                prompt: params.prompt,
                negativePrompt: params.negativePrompt,
                sourceImage: params.sourceImage,
                sourceVideo: params.sourceVideo,
                duration: params.duration as any,
                resolution: params.resolution as any,
                aspectRatio: params.aspectRatio as any,
            },
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Video generation failed',
            };
        }

        const data = result.data as any;

        return {
            success: true,
            videoUrl: data.videoUrl,
            metadata: data,
            costUsd: result.costUsd,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
