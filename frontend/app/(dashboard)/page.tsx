'use client';

/**
 * Chat Page (Main Dashboard)
 * Main chat interface with conversation sidebar
 */

import { useEffect, useState } from 'react';
import { useConversationStore } from '../../store/conversation';
import { useAuthStore } from '../../store/auth';
import { wsClient } from '../../lib/websocket';
import MessageList from '../../components/chat/MessageList';
import MessageInput from '../../components/chat/MessageInput';
import StreamingMessage from '../../components/chat/StreamingMessage';
import ConversationSidebar from '../../components/chat/ConversationSidebar';
import { Card } from '../../components/ui/card';

export default function ChatPage() {
  const user = useAuthStore((state) => state.user);
  const {
    currentConversation,
    streamingMessage,
    loadConversation,
    createConversation,
    sendMessage,
    error,
    sending,
  } = useConversationStore();

  const [wsConnected, setWsConnected] = useState(false);

  // Connect to WebSocket on mount
  useEffect(() => {
    if (user) {
      wsClient.connect().catch((err) => {
        console.error('WebSocket connection failed:', err);
      });

      const unsubscribe = wsClient.onConnectionChange((connected) => {
        setWsConnected(connected);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user]);

  // Create initial conversation if none exists
  useEffect(() => {
    if (user && !currentConversation) {
      createConversation().then((conv) => {
        loadConversation(conv.id);
      }).catch((err) => {
        console.error('Failed to create/load conversation:', err);
      });
    }
  }, [user, currentConversation, createConversation, loadConversation]);

  const handleSendMessage = async (content: string) => {
    if (!currentConversation || !wsConnected) return;
    await sendMessage(currentConversation.id, content);
  };

  if (!currentConversation) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] bg-black">
        <p className="text-gray-400">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] bg-black">
      {/* Conversation Sidebar */}
      <aside className="w-64 flex-shrink-0">
        <ConversationSidebar />
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col p-6 bg-black border border-gray-700 shadow-lg">
          {/* Connection Status */}
          {!wsConnected && (
            <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-2 rounded mb-4">
              Connecting to server...
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4">
            <MessageList messages={currentConversation.messages} />
            {streamingMessage && (
              <StreamingMessage message={streamingMessage} />
            )}
          </div>

          {/* Input */}
          <MessageInput
            onSend={handleSendMessage}
            disabled={!wsConnected || sending}
          />
        </Card>
      </div>
    </div>
  );
}
