'use client';

/**
 * Research Results Component
 * Displays web research results with relevance scoring
 */

import { ExternalLink, FileText } from 'lucide-react';
import { Card } from '../ui/card';
import type { ResearchSource } from '../../lib/api';

interface ResearchResultsProps {
  query: string;
  sources: ResearchSource[];
  domain?: string;
}

export default function ResearchResults({
  query,
  sources,
  domain,
}: ResearchResultsProps) {
  if (sources.length === 0) {
    return (
      <div className="p-8 text-center bg-[#0a0a0a] rounded-lg border border-gray-700">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">
          No results found
        </h3>
        <p className="text-sm text-gray-400">
          Try a different search query or check your connection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {sources.length} {sources.length === 1 ? 'result' : 'results'} for{' '}
          <span className="text-white font-medium">"{query}"</span>
        </span>
        {domain && (
          <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
            {domain}
          </span>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {sources.map((source, index) => (
          <ResearchResultCard key={index} source={source} index={index} />
        ))}
      </div>
    </div>
  );
}

interface ResearchResultCardProps {
  source: ResearchSource;
  index: number;
}

function ResearchResultCard({ source, index }: ResearchResultCardProps) {
  const score = source.score;

  // Color-code by relevance score
  const getScoreColor = (score: number) => {
    if (score >= 0.8) {
      return 'bg-green-900/20 border-green-700';
    }
    if (score >= 0.5) {
      return 'bg-yellow-900/20 border-yellow-700';
    }
    return 'bg-gray-800 border-gray-700';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8)
      return { text: 'Highly relevant', color: 'text-green-400' };
    if (score >= 0.5) return { text: 'Relevant', color: 'text-yellow-400' };
    return { text: 'Possibly relevant', color: 'text-gray-400' };
  };

  const scoreLabel = getScoreLabel(score);

  // Get source icon/badge
  const getSourceBadge = (source: string) => {
    if (source === 'tavily') {
      return (
        <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs">
          Tavily
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs">
        Brave
      </span>
    );
  };

  return (
    <Card className={`p-4 border transition-colors ${getScoreColor(score)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">#{index + 1}</span>
            {getSourceBadge(source.source)}
          </div>
          <h4 className="font-medium text-white mb-1 line-clamp-2">
            {source.title}
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${scoreLabel.color}`}>
              {scoreLabel.text}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">
              Score: {score.toFixed(2)}
            </span>
            {source.author && (
              <>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">{source.author}</span>
              </>
            )}
            {source.published_date && (
              <>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">
                  {source.published_date}
                </span>
              </>
            )}
          </div>
        </div>

        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-white/5 rounded transition-colors flex-shrink-0"
          title="Open source"
        >
          <ExternalLink className="w-4 h-4 text-gray-400 hover:text-white" />
        </a>
      </div>

      {/* Content Snippet */}
      <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed">
        {source.content}
      </p>

      {/* URL */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 truncate block"
        >
          {source.url}
        </a>
      </div>
    </Card>
  );
}
