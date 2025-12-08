'use client';

/**
 * MessageList Component
 * Displays conversation history
 */

import type { Message } from '../../lib/api';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center max-w-md">
          <p className="text-2xl font-medium text-gray-200 mb-2">What can I help with?</p>
          <p className="text-sm text-gray-500">
            Ask me anything - I can help with research, analysis, and more!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`mb-6 ${message.role === 'user' ? 'ml-auto max-w-2xl' : ''}`}
        >
          {/* Label */}
          {/* Label Removed for Cleaner UI */}

          {/* Message Content - Bubble Style */}
          <div
            className={`px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap ${message.role === 'user'
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-[#2f2f2f] text-gray-100 rounded-tl-sm border border-gray-700/50'
              }`}
          >
            {message.content}
          </div>

          {/* Image Display */}
          {message.imageUrl && (
            <div className={`mt-3 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
              <div className="relative inline-block max-w-lg">
                <img
                  src={message.imageUrl}
                  alt={message.imageMetadata?.prompt || 'Generated image'}
                  className="rounded-lg border border-gray-700 shadow-lg max-w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Citations */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Sources:
              </p>
              <div className="space-y-1.5">
                {message.sources.map((source, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-400 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 hover:border-gray-600 transition-colors"
                  >
                    <span className="font-medium">{source.documentTitle}</span>
                    <span className="text-gray-500 ml-2">(Score: {source.relevanceScore.toFixed(2)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
