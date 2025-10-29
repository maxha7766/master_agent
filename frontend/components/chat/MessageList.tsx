'use client';

/**
 * MessageList Component
 * Displays conversation history
 */

import { useEffect, useRef } from 'react';
import type { Message } from '../../lib/api';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium text-white">Start a conversation</p>
          <p className="text-sm mt-2">
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
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-3 shadow-md ${
              message.role === 'user'
                ? 'bg-blue-600 text-white border border-blue-500'
                : 'bg-gray-800 text-white border border-gray-700'
            }`}
          >
            {/* Message Content */}
            <div className="prose prose-sm max-w-none prose-invert">
              {message.content.split('\n').map((line, i) => (
                <p key={i} className="text-white m-0">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>

            {/* Message Metadata */}
            {message.role === 'assistant' && (
              <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex items-center gap-3">
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
              <div className="mt-3 pt-2 border-t border-gray-700">
                <p className="text-xs font-medium text-gray-300 mb-2">
                  Sources:
                </p>
                <div className="space-y-1">
                  {message.sources.map((source, i) => (
                    <div
                      key={i}
                      className="text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded px-2 py-1"
                    >
                      {source.documentTitle} (Score: {source.relevanceScore.toFixed(2)})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
