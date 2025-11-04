'use client';

/**
 * Conversation Sidebar
 * Displays conversation history grouped by date with AI-generated titles
 */

import { useEffect } from 'react';
import { useConversationStore } from '../../store/conversation';
import { Button } from '../ui/button';
import { MessageSquarePlus, Loader2, MessageSquare } from 'lucide-react';

interface ConversationSidebarProps {
  currentConversationId?: string;
  onNewConversation: () => void;
}

export default function ConversationSidebar({
  currentConversationId,
  onNewConversation,
}: ConversationSidebarProps) {
  const { groupedConversations, loadGroupedConversations, loadConversation, loading, currentConversation } =
    useConversationStore();

  useEffect(() => {
    loadGroupedConversations();
  }, [loadGroupedConversations]);

  // Refresh sidebar when current conversation changes (to show updated titles)
  useEffect(() => {
    if (currentConversation) {
      // Reload conversations list to get updated titles
      loadGroupedConversations();
    }
  }, [currentConversation?.id, loadGroupedConversations]);

  const handleSelectConversation = async (conversationId: string) => {
    await loadConversation(conversationId);
  };

  const renderConversationGroup = (
    title: string,
    conversations: any[],
    emptyMessage: string
  ) => {
    if (!conversations || conversations.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
          {title}
        </h3>
        <div className="space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                currentConversationId === conv.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate">
                  {conv.title || 'New Conversation'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <Button
          onClick={onNewConversation}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <MessageSquarePlus className="w-4 h-4 mr-2" />
          New Conversation
        </Button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !groupedConversations ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No conversations yet</p>
          </div>
        ) : (
          <>
            {renderConversationGroup('Today', groupedConversations.today, 'No conversations today')}
            {renderConversationGroup(
              'Yesterday',
              groupedConversations.yesterday,
              'No conversations yesterday'
            )}
            {renderConversationGroup(
              'Last 7 Days',
              groupedConversations.lastWeek,
              'No recent conversations'
            )}
            {renderConversationGroup(
              'Older',
              groupedConversations.older,
              'No older conversations'
            )}
          </>
        )}
      </div>
    </div>
  );
}
