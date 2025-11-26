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
import ChatSettings from '../../components/chat/ChatSettings';
import { Button } from '../../components/ui/button';
import { GearIcon } from '@radix-ui/react-icons';

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Monitor WebSocket connection status (connection handled at layout level)
  useEffect(() => {
    const unsubscribe = wsClient.onConnectionChange((connected) => {
      setWsConnected(connected);
    });

    // Check initial connection status
    setWsConnected(wsClient.isConnected());

    return () => {
      unsubscribe();
    };
  }, []);

  // Create initial conversation if none exists
  useEffect(() => {
    if (user && !currentConversation) {
      createConversation().catch((err) => {
        console.error('Failed to create conversation:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleNewConversation = async () => {
    const newConv = await createConversation();
    await loadConversation(newConv.id);
  };

  const handleSendMessage = async (content: string, attachedImageUrl?: string) => {
    if (!currentConversation || !wsConnected) return;
    await sendMessage(currentConversation.id, content, attachedImageUrl);
  };

  if (!currentConversation) {
    return (
      <div className="flex items-center justify-center h-full bg-[#212121]">
        <p className="text-gray-400">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#212121] overflow-hidden">
      {/* Conversation Sidebar - Hidden on mobile */}
      <aside className="hidden md:block w-64 flex-shrink-0 bg-[#171717] border-r border-gray-800 overflow-hidden">
        <ConversationSidebar
          currentConversationId={currentConversation?.id}
          onNewConversation={handleNewConversation}
        />
      </aside>

      {/* Main Chat Area - Full height with flex layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-full">
        {/* Settings Button - Fixed Position at top right of chat area */}
        <div className="absolute top-3 right-2 sm:right-4 z-50">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-gray-700/50 bg-[#212121]"
            onClick={() => setSettingsOpen(true)}
            title="Chat Settings"
          >
            <GearIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Connection Status */}
        {!wsConnected && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 text-yellow-400 px-2 sm:px-4 py-3 mx-2 sm:mx-4 mt-4 mb-2 rounded-lg flex-shrink-0 text-sm">
            Connecting to server...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/50 text-red-400 px-2 sm:px-4 py-3 mx-2 sm:mx-4 mt-4 mb-2 rounded-lg flex-shrink-0 text-sm">
            {error}
          </div>
        )}

        {/* Messages - Scrollable Area with proper mobile sizing */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 md:px-6 py-4 sm:py-6 min-h-0">
          <MessageList messages={currentConversation.messages} />
          {streamingMessage && (
            <StreamingMessage message={streamingMessage} />
          )}
        </div>

        {/* Input Container - Fixed at Bottom with safe area for mobile keyboards */}
        <div className="flex-shrink-0 border-t border-gray-800 bg-[#212121] px-3 sm:px-4 py-3 sm:py-4 pb-safe">
          <div className="max-w-3xl mx-auto">
            <MessageInput
              onSend={handleSendMessage}
              disabled={!wsConnected || sending}
            />
          </div>
        </div>
      </div>

      {/* Chat Settings Modal */}
      <ChatSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
