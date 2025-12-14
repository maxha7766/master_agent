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
        <div className="text-xs text-gray-500 mb-1 font-medium text-left">Bob</div>
        <div className="relative w-8 h-8">
          <div className="absolute top-0 left-0 w-full h-full border-2 border-gray-600 rounded-full animate-spin border-t-transparent" style={{ animationDuration: '1s' }}></div>
          <div className="absolute top-1 left-1 w-6 h-6 border-2 border-gray-500 rounded-full animate-spin border-t-transparent" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
          <div className="absolute top-2 left-2 w-4 h-4 border-2 border-gray-400 rounded-full animate-spin border-t-transparent" style={{ animationDuration: '0.8s' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Agent label */}
      <div className="text-xs text-gray-500 mb-1 font-medium text-left">Bob</div>

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
