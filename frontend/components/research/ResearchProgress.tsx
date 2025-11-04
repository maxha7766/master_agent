'use client';

/**
 * Research Progress Indicator
 * Shows background research progress with stage-based indicators
 */

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, Search, Lightbulb, PenTool, Upload } from 'lucide-react';
import { api, type GraduateResearchProject } from '../../lib/api';

interface ResearchProgressProps {
  projectId: string;
  onComplete?: (project: GraduateResearchProject) => void;
  onError?: (error: string) => void;
}

interface Stage {
  id: string;
  label: string;
  icon: typeof Search;
  statuses: string[];
}

const STAGES: Stage[] = [
  {
    id: 'researching',
    label: 'Researching',
    icon: Search,
    statuses: ['planning', 'researching'],
  },
  {
    id: 'analyzing',
    label: 'Analyzing',
    icon: Lightbulb,
    statuses: ['analyzing'],
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: PenTool,
    statuses: ['writing'],
  },
  {
    id: 'uploading',
    label: 'Uploading',
    icon: Upload,
    statuses: ['assembling'],
  },
  {
    id: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    statuses: ['complete'],
  },
];

export default function ResearchProgress({
  projectId,
  onComplete,
  onError,
}: ResearchProgressProps) {
  const [project, setProject] = useState<GraduateResearchProject | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const data = await api.getResearchProject(projectId);
        setProject(data);

        if (data.status === 'complete') {
          clearInterval(interval);
          onComplete?.(data);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          const errorMsg = 'Research project failed';
          setError(errorMsg);
          onError?.(errorMsg);
        }
      } catch (err) {
        console.error('Failed to fetch research status:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch status';
        setError(errorMsg);
        clearInterval(interval);
        onError?.(errorMsg);
      }
    };

    // Poll immediately, then every 5 seconds
    pollStatus();
    interval = setInterval(pollStatus, 5000);

    return () => clearInterval(interval);
  }, [projectId, onComplete, onError]);

  if (error) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400">Research failed</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-blue-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Determine current stage
  const currentStatus = project.status || 'planning';
  const currentStageIndex = STAGES.findIndex(stage =>
    stage.statuses.includes(currentStatus)
  );

  const isComplete = project.status === 'complete';
  const progress = project.progress_metadata;

  // Build progress details
  const details = [];
  if (progress?.sources_count) details.push(`${progress.sources_count} sources`);
  if (progress?.themes_count) details.push(`${progress.themes_count} themes`);
  if (progress?.sections_completed) details.push(`${progress.sections_completed}/8 sections`);
  if (progress?.current_word_count) details.push(`${progress.current_word_count} words`);

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#1a1a1a] border border-gray-700 rounded-lg">
      {/* Stage Indicators */}
      <div className="flex items-center justify-between gap-2">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isActive = index === currentStageIndex;
          const isCompleted = index < currentStageIndex || (isComplete && stage.id === 'completed');
          const isPending = index > currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center gap-2 flex-1">
              {/* Stage Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : isCompleted
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-gray-800/50 text-gray-500 border border-gray-700/50'
                }`}
              >
                {isActive && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {!isActive && <Icon className="w-3.5 h-3.5" />}
                <span className="text-xs font-medium whitespace-nowrap">{stage.label}</span>
              </div>

              {/* Connector Line */}
              {index < STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-all ${
                    isCompleted ? 'bg-green-600/40' : 'bg-gray-700/50'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Details */}
      {details.length > 0 && !isComplete && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="text-gray-500">Progress:</span>
          <span>{details.join(' • ')}</span>
        </div>
      )}

      {/* Download Button for Completed */}
      {isComplete && (
        <button
          onClick={() => {
            // Download the report
            const blob = new Blob([project.final_report || ''], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.topic?.replace(/\s+/g, '-') || 'research'}-report.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 text-green-400 rounded text-sm font-medium transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>Download Report</span>
        </button>
      )}
    </div>
  );
}
