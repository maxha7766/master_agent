/**
 * Conversation Zustand Store
 * Manages conversation state and real-time message streaming
 */

import { create } from 'zustand';
import { api, Conversation, ConversationDetail } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { ServerMessage } from '../lib/websocketTypes';
import { useChatSettingsStore } from '../src/store/chatSettingsStore';

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
  groupedConversations: {
    today: Conversation[];
    yesterday: Conversation[];
    lastWeek: Conversation[];
    older: Conversation[];
  } | null;
  currentConversation: ConversationDetail | null;
  streamingMessage: StreamingMessage | null;

  // UI State
  loading: boolean;
  sending: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  loadGroupedConversations: () => Promise<void>;
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
    groupedConversations: null,
    currentConversation: null,
    streamingMessage: null,
    loading: false,
    sending: false,
    error: null,

    // Load all conversations
    loadConversations: async () => {
      set({ loading: true, error: null });
      try {
        const conversations = await api.getConversations(false) as Conversation[];
        set({ conversations, loading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load conversations',
          loading: false,
        });
      }
    },

    // Load conversations grouped by date
    loadGroupedConversations: async () => {
      set({ loading: true, error: null });
      try {
        const grouped = await api.getConversations(true) as {
          today: Conversation[];
          yesterday: Conversation[];
          lastWeek: Conversation[];
          older: Conversation[];
        };
        set({ groupedConversations: grouped, loading: false });
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
        // Ensure messages array exists (new conversations start with no messages)
        const conversationWithMessages = {
          ...conversation,
          messages: [],
        };
        set((state) => ({
          conversations: [conversationWithMessages, ...state.conversations],
          currentConversation: conversationWithMessages,
          loading: false,
        }));
        return conversationWithMessages;
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
        // Get current chat settings
        const chatSettings = useChatSettingsStore.getState().settings;

        wsClient.send({
          kind: 'chat',
          conversationId,
          content,
          settings: {
            disciplineLevel: chatSettings.disciplineLevel,
            minRelevanceScore: chatSettings.minRelevanceScore,
            ragOnlyMode: chatSettings.ragOnlyMode,
            fileTypes: chatSettings.fileTypes,
            dateRange: {
              start: chatSettings.dateRange.start?.toISOString() || null,
              end: chatSettings.dateRange.end?.toISOString() || null,
            },
            topK: chatSettings.topK,
            useReranking: chatSettings.useReranking,
            hybridSearchBalance: chatSettings.hybridSearchBalance,
          },
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
        groupedConversations: null,
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
  set: (partial: Partial<ConversationState> | ((state: ConversationState) => Partial<ConversationState>)) => void
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
        // Add completed message to conversation and clear streaming immediately
        set((state) => ({
          streamingMessage: null, // Clear immediately to prevent duplicate display
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
                    sources: streamingMsg.sources, // Include sources if available
                  },
                ],
              }
            : null,
          sending: false,
        }));
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
