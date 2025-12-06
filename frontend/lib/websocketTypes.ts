/**
 * WebSocket Message Types (Frontend)
 * Mirrors backend types for type safety
 */

// ============================================================================
// Client -> Server Messages
// ============================================================================

export type ClientMessage =
  | ChatMessage
  | CancelMessage
  | PingMessage
  | ImageGenerateMessage
  | ImageListMessage
  | VideoGenerateMessage
  | VideoListMessage;

export interface ChatMessage {
  kind: 'chat';
  conversationId: string;
  content: string;
  attachedImageUrl?: string; // For image editing via chat
  settings?: {
    disciplineLevel: 'strict' | 'moderate' | 'exploration';
    minRelevanceScore: number;
    ragOnlyMode: boolean;
    fileTypes: string[];
    dateRange: {
      start: string | null;
      end: string | null;
    };
    topK: number;
    useReranking: boolean;
    hybridSearchBalance: number;
  };
}

export interface CancelMessage {
  kind: 'cancel';
  jobId: string;
}

export interface PingMessage {
  kind: 'ping';
  timestamp: number;
}

export interface ImageGenerateMessage {
  kind: 'image_generate';
  conversationId?: string;
  parameters: {
    prompt: string;
    inputImage?: string;
    aspectRatio?: string;
    outputFormat?: 'png' | 'jpg';
    safetyTolerance?: number;
    promptUpsampling?: boolean;
    seed?: number;
  };
}

export interface ImageListMessage {
  kind: 'image_list';
}

export interface VideoGenerateMessage {
  kind: 'video_generate';
  conversationId?: string;
  operation: 'text-to-video' | 'image-to-video' | 'video-editing';
  parameters: {
    prompt: string;
    negativePrompt?: string;
    sourceImage?: string;
    sourceVideo?: string;
    duration?: 5 | 10;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '720p' | '1080p';
    seed?: number;
    style?: string;
    model?: string;
  };
}

export interface VideoListMessage {
  kind: 'video_list';
}

// ============================================================================
// Server -> Client Messages
// ============================================================================

export type ServerMessage =
  | StreamStartMessage
  | StreamChunkMessage
  | StreamEndMessage
  | ProgressMessage
  | CitationMessage
  | ErrorMessage
  | BudgetWarningMessage
  | PongMessage
  | ConnectionMessage
  | CancelledMessage
  | ImageResultMessage
  | ImageListResultMessage
  | VideoResultMessage
  | VideoListResultMessage;

export interface StreamStartMessage {
  kind: 'stream_start';
  messageId: string;
  agent: string;
  model: string;
}

export interface StreamChunkMessage {
  kind: 'stream_chunk';
  messageId: string;
  chunk: string;
}

export interface StreamEndMessage {
  kind: 'stream_end';
  messageId: string;
  metadata: MessageMetadata;
}

export interface ProgressMessage {
  kind: 'progress';
  jobId: string;
  progressPercent: number;
  status: string;
}

export interface CitationMessage {
  kind: 'citation';
  messageId: string;
  sources: SearchSource[];
}

export interface ErrorMessage {
  kind: 'error';
  error: string;
  code: string;
  conversationId?: string;
  jobId?: string;
}

export interface BudgetWarningMessage {
  kind: 'budget_warning';
  currentCost: number;
  limit: number;
  percentUsed: number;
  threshold: number;
}

export interface PongMessage {
  kind: 'pong';
  timestamp: number;
  serverTime: number;
}

export interface ConnectionMessage {
  kind: 'connection';
  status: 'connected' | 'closing';
  userId?: string;
  reason?: string;
}

export interface CancelledMessage {
  kind: 'cancelled';
  jobId: string;
  status: string;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface MessageMetadata {
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  costUsd: number;
  latencyMs: number;
  finishReason: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageMetadata?: {
    operation: string;
    operationType?: string;
    width: number;
    height: number;
    prompt?: string;
    generatedImageUrl?: string;
  };
}

export interface SearchSource {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  relevanceScore: number;
  chunkIndex: number;
}

export interface ImageResultMessage {
  kind: 'image_result';
  jobId: string;
  data: any;
  costUsd?: number;
  processingTimeMs?: number;
}

export interface ImageListResultMessage {
  kind: 'image_list_result';
  data: any[];
}

export interface VideoResultMessage {
  kind: 'video_result';
  jobId: string;
  data: any;
  costUsd?: number;
  processingTimeMs?: number;
}

export interface VideoListResultMessage {
  kind: 'video_list_result';
  data: any[];
}
