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
  | PingMessage;

export interface ChatMessage {
  kind: 'chat';
  conversationId: string;
  content: string;
}

export interface CancelMessage {
  kind: 'cancel';
  jobId: string;
}

export interface PingMessage {
  kind: 'ping';
  timestamp: number;
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
  | PongMessage
  | ConnectionMessage
  | CancelledMessage;

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
}

export interface SearchSource {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  relevanceScore: number;
  chunkIndex: number;
}
