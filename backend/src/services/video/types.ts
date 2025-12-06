export type VideoOperationType = 'text-to-video' | 'image-to-video' | 'video-editing';

export interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl?: string;
    model: string;
    operationType: VideoOperationType;
    parameters: any;
    costUsd: number;
    duration?: number;
    width?: number;
    height?: number;
    processingTimeMs?: number;
}

export interface TextToVideoParams {
    prompt: string;
    negativePrompt?: string;
    duration?: 5 | 10; // Seconds
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '720p' | '1080p';
    seed?: number;
}

export interface ImageToVideoParams {
    sourceImage: string; // URL or base64
    prompt: string;
    negativePrompt?: string;
    duration?: 5 | 10;
    motionBucketId?: number; // 1-255, controls motion amount
    seed?: number;
}

export interface VideoEditingParams {
    sourceVideo: string;
    prompt: string;
    style?: string;
    seed?: number;
}

export interface VideoMetadata {
    id: string;
    userId: string;
    conversationId?: string;
    prompt: string;
    negativePrompt?: string;
    sourceUrl?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    storagePath: string;
    model: string;
    operationType: VideoOperationType;
    parameters: any;
    costUsd: number;
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    createdAt: Date;
}
