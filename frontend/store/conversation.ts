/**
 * Conversation Zustand Store
 * Manages conversation state and real-time message streaming
 */

import { create } from 'zustand';
import { api, Conversation, ConversationDetail, Message } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { ServerMessage } from '../lib/websocketTypes';

interface StreamingMessage {
  messageId: string;
  agent: string;
  model: string;
  content: string;
  isComplete: boolean;
  metadata?: {
    tokensUsed: { input: number; output: number; total: number };
    costUsd: number;
    latencyMs: number;
  };
  sources?: Array<{
    documentId: string;
    documentTitle: string;
    chunkContent: string;
    relevanceScore: number;
  }>;
}

interface ConversationState {
  // Data
  conversations: Conversation[];
  currentConversation: ConversationDetail | null;
  streamingMessage: StreamingMessage | null;

  // UI State
  loading: boolean;
  sending: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  updateConversation: (id: string, updates: { title?: string; archived?: boolean }) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  clearStreamingMessage: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => {
  // Subscribe to WebSocket messages
  wsClient.onMessage((message: ServerMessage) => {
    handleWebSocketMessage(message, get, set);
  });

  return {
    // Initial state
    conversations: [],
    currentConversation: null,
    streamingMessage: null,
    loading: false,
    sending: false,
    error: null,

    // Load all conversations
    loadConversations: async () => {
      set({ loading: true, error: null });
      try {
        const conversations = await api.getConversations();
        set({ conversations, loading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load conversations',
          loading: false,
        });
      }
    },

    // Load specific conversation with messages
    loadConversation: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const conversation = await api.getConversation(id);
        set({ currentConversation: conversation, loading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load conversation',
          loading: false,
        });
      }
    },

    // Create new conversation
    createConversation: async (title?: string) => {
      set({ loading: true, error: null });
      try {
        const conversation = await api.createConversation(title);
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          loading: false,
        }));
        return conversation;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to create conversation',
          loading: false,
        });
        throw error;
      }
    },

    // Update conversation
    updateConversation: async (id: string, updates) => {
      try {
        const updated = await api.updateConversation(id, updates);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? updated : c
          ),
          currentConversation:
            state.currentConversation?.id === id
              ? { ...state.currentConversation, ...updates }
              : state.currentConversation,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update conversation',
        });
      }
    },

    // Delete conversation
    deleteConversation: async (id: string) => {
      try {
        await api.deleteConversation(id);
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          currentConversation:
            state.currentConversation?.id === id ? null : state.currentConversation,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to delete conversation',
        });
      }
    },

    // Send message via WebSocket
    sendMessage: async (conversationId: string, content: string) => {
      if (!wsClient.isConnected()) {
        set({ error: 'Not connected to server' });
        return;
      }

      set({ sending: true, error: null, streamingMessage: null });

      try {
        wsClient.send({
          kind: 'chat',
          conversationId,
          content,
        });

        // Add user message to UI immediately
        set((state) => ({
          currentConversation: state.currentConversation
            ? {
                ...state.currentConversation,
                messages: [
                  ...state.currentConversation.messages,
                  {
                    id: `temp-${Date.now()}`,
                    conversationId,
                    role: 'user' as const,
                    content,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to send message',
          sending: false,
        });
      }
    },

    // Clear streaming message
    clearStreamingMessage: () => {
      set({ streamingMessage: null });
    },

    // Set error
    setError: (error: string | null) => {
      set({ error });
    },

    // Reset state
    reset: () => {
      set({
        conversations: [],
        currentConversation: null,
        streamingMessage: null,
        loading: false,
        sending: false,
        error: null,
      });
    },
  };
});

// ============================================================================
// WebSocket Message Handler
// ============================================================================

function handleWebSocketMessage(
  message: ServerMessage,
  get: () => ConversationState,
  set: (partial: Partial<ConversationState>) => void
): void {
  switch (message.kind) {
    case 'stream_start':
      set({
        streamingMessage: {
          messageId: message.messageId,
          agent: message.agent,
          model: message.model,
          content: '',
          isComplete: false,
        },
        sending: false,
      });
      break;

    case 'stream_chunk':
      set((state) => ({
        streamingMessage: state.streamingMessage
          ? {
              ...state.streamingMessage,
              content: state.streamingMessage.content + message.chunk,
            }
          : null,
      }));
      break;

    case 'stream_end':
      const streamingMsg = get().streamingMessage;
      if (streamingMsg) {
        // Add completed message to conversation
        set((state) => ({
          streamingMessage: {
            ...streamingMsg,
            isComplete: true,
            metadata: message.metadata,
          },
          currentConversation: state.currentConversation
            ? {
                ...state.currentConversation,
                messages: [
                  ...state.currentConversation.messages,
                  {
                    id: message.messageId,
                    conversationId: state.currentConversation.id,
                    role: 'assistant' as const,
                    content: streamingMsg.content,
                    agent: streamingMsg.agent,
                    model: streamingMsg.model,
                    tokensUsed: message.metadata.tokensUsed.total,
                    costUsd: message.metadata.costUsd,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null,
          sending: false,
        }));

        // Clear streaming message after delay
        setTimeout(() => {
          set({ streamingMessage: null });
        }, 500);
      }
      break;

    case 'citation':
      set((state) => ({
        streamingMessage: state.streamingMessage
          ? {
              ...state.streamingMessage,
              sources: message.sources,
            }
          : null,
      }));
      break;

    case 'error':
      set({
        error: message.error,
        sending: false,
        streamingMessage: null,
      });
      break;

    case 'pong':
      // Handle pong (connection health check)
      console.log('[WebSocket] Pong received, latency:', Date.now() - message.timestamp, 'ms');
      break;

    default:
      // Ignore other message types
      break;
  }
}
