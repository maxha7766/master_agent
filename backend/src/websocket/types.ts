/**
 * WebSocket Message Type Definitions
 * Based on websocket-protocol.md
 */

// Client → Server Messages
export type ClientMessage =
  | {
      kind: 'chat';
      conversationId: string;
      content: string;
    }
  | {
      kind: 'cancel';
      jobId: string;
    }
  | {
      kind: 'ping';
      timestamp: number;
    };

// Server → Client Messages
export type ServerMessage =
  | {
      kind: 'connection';
      connectionId: string;
      userId: string;
    }
  | {
      kind: 'stream_start';
      messageId: string;
      agent: string;
      model: string;
    }
  | {
      kind: 'stream_chunk';
      messageId: string;
      chunk: string;
    }
  | {
      kind: 'stream_end';
      messageId: string;
      metadata: MessageMetadata;
    }
  | {
      kind: 'progress';
      jobId: string;
      progressPercent: number;
      status: string;
    }
  | {
      kind: 'citation';
      messageId: string;
      sources: SearchSource[];
    }
  | {
      kind: 'cancelled';
      jobId: string;
    }
  | {
      kind: 'error';
      error: string;
      code: string;
      conversationId?: string;
    }
  | {
      kind: 'budget_warning';
      currentCost: number;
      limit: number;
      percentUsed: number;
      threshold: number;
    }
  | {
      kind: 'pong';
      timestamp: number;
      serverTime: number;
    };

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
  imageMetadata?: any;
}

export interface SearchSource {
  url: string;
  title: string;
  snippet: string;
  credibilityScore?: number;
}

/**
 * WebSocket connection context
 */
export interface WSContext {
  userId: string;
  connectionId: string;
  connectedAt: Date;
  lastActivity: Date;
}
