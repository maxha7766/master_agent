import { ReplicateVideoService } from '../../services/video/replicate.js';
import { VideoStorageService } from '../../services/video/storage.js';
import { createClient } from '@supabase/supabase-js';
import type {
    TextToVideoParams,
    ImageToVideoParams,
    VideoEditingParams,
    VideoMetadata,
} from '../../services/video/types.js';

interface VideoAgentRequest {
    userId: string;
    conversationId?: string;
    operation: 'text-to-video' | 'image-to-video' | 'video-editing' | 'list-videos';
    parameters: any;
}

interface VideoAgentResponse {
    success: boolean;
    data?: VideoMetadata | VideoMetadata[] | string[];
    error?: string;
    costUsd?: number;
}

export class VideoAgent {
    private replicateService: ReplicateVideoService;
    private storageService: VideoStorageService;
    private supabase;

    constructor() {
        this.replicateService = new ReplicateVideoService();
        this.storageService = new VideoStorageService();

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
     * Process video generation request
     */
    async processRequest(request: VideoAgentRequest): Promise<VideoAgentResponse> {
        try {
            switch (request.operation) {
                case 'text-to-video':
                    return await this.handleTextToVideo(request);
                case 'image-to-video':
                    return await this.handleImageToVideo(request);
                case 'video-editing':
                    return await this.handleVideoEditing(request);
                case 'list-videos':
                    return await this.handleListVideos(request);
                default:
                    return {
                        success: false,
                        error: `Unknown operation: ${request.operation}`,
                    };
            }
        } catch (error) {
            console.error('Video agent error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    /**
     * Handle text-to-video generation
     */
    private async handleTextToVideo(request: VideoAgentRequest): Promise<VideoAgentResponse> {
        const params = request.parameters as TextToVideoParams;

        if (!params.prompt) {
            return { success: false, error: 'Prompt is required for text-to-video generation' };
        }

        // Generate video using Replicate
        const result = await this.replicateService.generateVideo(params);

        // Upload to Supabase Storage
        const { path, publicUrl } = await this.storageService.uploadFromUrl(
            result.videoUrl,
            request.userId,
            {
                conversationId: request.conversationId,
                operationType: 'text-to-video',
            }
        );

        // Save metadata to database
        const metadata = await this.saveVideoMetadata({
            userId: request.userId,
            conversationId: request.conversationId,
            prompt: params.prompt,
            negativePrompt: params.negativePrompt,
            videoUrl: publicUrl,
            storagePath: path,
            model: result.model,
            operationType: result.operationType,
            parameters: result.parameters,
            costUsd: result.costUsd,
            duration: result.duration,
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
     * Handle image-to-video generation
     */
    private async handleImageToVideo(request: VideoAgentRequest): Promise<VideoAgentResponse> {
        const params = request.parameters as ImageToVideoParams;

        if (!params.sourceImage || !params.prompt) {
            return { success: false, error: 'Source image and prompt are required' };
        }

        // Generate video
        const result = await this.replicateService.imageToVideo(params);

        // Upload to Supabase Storage
        const { path, publicUrl } = await this.storageService.uploadFromUrl(
            result.videoUrl,
            request.userId,
            {
                conversationId: request.conversationId,
                operationType: 'image-to-video',
            }
        );

        // Save metadata
        const metadata = await this.saveVideoMetadata({
            userId: request.userId,
            conversationId: request.conversationId,
            prompt: params.prompt,
            negativePrompt: params.negativePrompt,
            sourceUrl: params.sourceImage,
            videoUrl: publicUrl,
            storagePath: path,
            model: result.model,
            operationType: result.operationType,
            parameters: result.parameters,
            costUsd: result.costUsd,
            duration: result.duration,
        });

        return {
            success: true,
            data: metadata,
            costUsd: result.costUsd,
        };
    }

    /**
     * Handle video editing
     */
    private async handleVideoEditing(request: VideoAgentRequest): Promise<VideoAgentResponse> {
        const params = request.parameters as VideoEditingParams;

        if (!params.sourceVideo || !params.prompt) {
            return { success: false, error: 'Source video and prompt are required' };
        }

        // Edit video
        const result = await this.replicateService.editVideo(params);

        // Upload to Supabase Storage
        const { path, publicUrl } = await this.storageService.uploadFromUrl(
            result.videoUrl,
            request.userId,
            {
                conversationId: request.conversationId,
                operationType: 'video-editing',
            }
        );

        // Save metadata
        const metadata = await this.saveVideoMetadata({
            userId: request.userId,
            conversationId: request.conversationId,
            prompt: params.prompt,
            sourceUrl: params.sourceVideo,
            videoUrl: publicUrl,
            storagePath: path,
            model: result.model,
            operationType: result.operationType,
            parameters: result.parameters,
            costUsd: result.costUsd,
        });

        return {
            success: true,
            data: metadata,
            costUsd: result.costUsd,
        };
    }

    /**
     * List user's video history
     */
    private async handleListVideos(request: VideoAgentRequest): Promise<VideoAgentResponse> {
        const { data, error } = await this.supabase
            .from('videos')
            .select('*')
            .eq('user_id', request.userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: true,
            data: data as VideoMetadata[],
        };
    }

    /**
     * Save video metadata to database
     */
    private async saveVideoMetadata(
        metadata: Omit<VideoMetadata, 'id' | 'createdAt'>
    ): Promise<VideoMetadata> {
        const { data, error } = await this.supabase
            .from('videos')
            .insert({
                user_id: metadata.userId,
                conversation_id: metadata.conversationId,
                prompt: metadata.prompt,
                negative_prompt: metadata.negativePrompt,
                source_url: metadata.sourceUrl,
                video_url: metadata.videoUrl,
                thumbnail_url: metadata.thumbnailUrl,
                storage_path: metadata.storagePath,
                model: metadata.model,
                operation_type: metadata.operationType,
                parameters: metadata.parameters,
                cost_usd: metadata.costUsd,
                duration: metadata.duration,
                width: metadata.width,
                height: metadata.height,
                fps: metadata.fps,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to save video metadata: ${error.message}`);
        }

        return {
            id: data.id,
            userId: data.user_id,
            conversationId: data.conversation_id,
            prompt: data.prompt,
            negativePrompt: data.negative_prompt,
            sourceUrl: data.source_url,
            videoUrl: data.video_url,
            thumbnailUrl: data.thumbnail_url,
            storagePath: data.storage_path,
            model: data.model,
            operationType: data.operation_type,
            parameters: data.parameters,
            costUsd: data.cost_usd,
            duration: data.duration,
            width: data.width,
            height: data.height,
            fps: data.fps,
            createdAt: new Date(data.created_at),
        };
    }
}
