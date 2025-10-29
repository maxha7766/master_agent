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
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-800 text-white border border-gray-700 shadow-md">
        {/* Content */}
        <div className="prose prose-sm max-w-none prose-invert">
          {message.content.split('\n').map((line, i) => (
            <p key={i} className="text-white m-0">{line || '\u00A0'}</p>
          ))}

          {/* Typing indicator */}
          {!message.isComplete && (
            <span className="inline-flex items-center">
              <span className="animate-pulse text-blue-400">▋</span>
            </span>
          )}
        </div>

        {/* Metadata (shown when complete) */}
        {message.isComplete && message.metadata && (
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex items-center gap-3">
            <span>Agent: {message.agent}</span>
            <span>Model: {message.model}</span>
            <span>Tokens: {message.metadata.tokensUsed.total.toLocaleString()}</span>
            <span>Cost: ${message.metadata.costUsd.toFixed(4)}</span>
            <span>Time: {(message.metadata.latencyMs / 1000).toFixed(1)}s</span>
          </div>
        )}

        {/* Sources (if available) */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-700">
            <p className="text-xs font-medium text-gray-300 mb-2">Sources:</p>
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
  );
}
