'use client';

/**
 * Research Dialog
 * Modal for starting graduate-level research projects
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { api } from '../../lib/api';

interface ResearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResearchStarted?: (projectId: string) => void;
}

export default function ResearchDialog({
  isOpen,
  onClose,
  onResearchStarted,
}: ResearchDialogProps) {
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState(7500);
  const [citationStyle, setCitationStyle] = useState<'APA' | 'MLA' | 'Chicago'>('APA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic.trim()) {
      setError('Please enter a research topic');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await api.createGraduateResearch(topic, wordCount, citationStyle);

      if (result.success && result.projectId) {
        // Notify parent that research started
        onResearchStarted?.(result.projectId);

        // Close dialog
        onClose();

        // Reset form
        setTopic('');
        setWordCount(7500);
        setCitationStyle('APA');
      } else {
        setError('Failed to start research project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Graduate Research</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Research Topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The impact of artificial intelligence on education"
              rows={3}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Word Count */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Target Word Count
            </label>
            <select
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              disabled={isSubmitting}
            >
              <option value={5000}>5,000 words (Short)</option>
              <option value={7500}>7,500 words (Standard)</option>
              <option value={10000}>10,000 words (Extended)</option>
              <option value={15000}>15,000 words (Comprehensive)</option>
            </select>
          </div>

          {/* Citation Style */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Citation Style
            </label>
            <div className="flex gap-2">
              {(['APA', 'MLA', 'Chicago'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setCitationStyle(style)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    citationStyle === style
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-700'
                  }`}
                  disabled={isSubmitting}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-2 rounded text-xs">
            <p className="font-medium mb-1">This will generate a complete graduate-level research report with:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-300/80">
              <li>Multi-source academic research</li>
              <li>Thematic analysis</li>
              <li>8 structured sections</li>
              <li>Proper citations and references</li>
            </ul>
            <p className="mt-2 text-blue-300/80">
              This process takes 3-5 minutes. You can continue chatting while it runs in the background.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !topic.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Starting...' : 'Start Research'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
