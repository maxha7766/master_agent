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
          <div
            className={`text-xs text-gray-500 mb-1 font-medium ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>

          {/* Message Content - no bubble */}
          <div
            className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
              message.role === 'user' ? 'text-white text-right' : 'text-gray-100 text-left'
            }`}
          >
            {message.content}
          </div>

          {/* Message Metadata - only for assistant */}
          {message.role === 'assistant' && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-4">
              {message.model && <span>Model: {message.model}</span>}
              {message.tokensUsed && (
                <span>Tokens: {message.tokensUsed.toLocaleString()}</span>
              )}
              {message.costUsd && (
                <span>Cost: ${message.costUsd.toFixed(4)}</span>
              )}
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
