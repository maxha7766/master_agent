'use client';

/**
 * StreamingMessage Component
 * Displays streaming response with typing indicator
 */

interface StreamingMessageProps {
  message: {
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
  };
}

export default function StreamingMessage({ message }: StreamingMessageProps) {
  // Show bouncing dots if no content yet
  if (!message.content) {
    return (
      <div className="mb-6">
        <div className="text-xs text-gray-500 mb-1 font-medium text-left">Assistant</div>
        <div className="flex gap-1 items-center">
          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Agent label */}
      <div className="text-xs text-gray-500 mb-1 font-medium text-left">Assistant</div>

      {/* Content - no bubble, just text, aligned left, full width */}
      <div className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap text-left">
        {message.content}
        {/* Typing indicator */}
        {!message.isComplete && (
          <span className="inline-flex items-center ml-1">
            <span className="animate-pulse text-gray-400">▋</span>
          </span>
        )}
      </div>

      {/* Sources (if available) */}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Sources:</p>
          <div className="space-y-1">
            {message.sources.map((source, i) => (
              <div
                key={i}
                className="text-xs text-gray-400 bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1"
              >
                {source.documentTitle} (Score: {source.relevanceScore.toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
