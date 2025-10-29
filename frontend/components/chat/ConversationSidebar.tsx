'use client';

/**
 * ConversationSidebar Component
 * Lists user's conversations with create/delete functionality
 */

import { useEffect } from 'react';
import { useConversationStore } from '../../store/conversation';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export default function ConversationSidebar() {
  const {
    conversations,
    currentConversation,
    loadConversations,
    loadConversation,
    createConversation,
    deleteConversation,
  } = useConversationStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleCreateNew = async () => {
    const newConv = await createConversation('New Conversation');
    await loadConversation(newConv.id);
  };

  const handleSelectConversation = (id: string) => {
    loadConversation(id);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await deleteConversation(id);
    }
  };

  return (
    <Card className="h-full flex flex-col p-4 bg-black border border-gray-700 shadow-lg">
      <div className="mb-4">
        <Button
          onClick={handleCreateNew}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-500"
        >
          New Conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`p-3 rounded cursor-pointer hover:bg-gray-800 transition-colors border ${
                currentConversation?.id === conv.id
                  ? 'bg-gray-800 border-blue-600 border-l-4'
                  : 'bg-gray-900 border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{conv.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="text-gray-500 hover:text-red-500 ml-2"
                  title="Delete conversation"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
