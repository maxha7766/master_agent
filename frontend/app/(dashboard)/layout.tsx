'use client';

/**
 * Dashboard Layout
 * Main layout with navigation for authenticated users
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/auth';
import { wsClient } from '../../lib/websocket';
import { Button } from '../../components/ui/button';
import { MessageSquare, FileText, Upload, Database, Search, Settings, BarChart3 } from 'lucide-react';
import UploadDocuments from '../../components/documents/UploadDocuments';
import KnowledgeBase from '../../components/documents/KnowledgeBase';
import ResearchDialog from '../../components/research/ResearchDialog';
import ResearchProgress from '../../components/research/ResearchProgress';
import type { GraduateResearchProject } from '../../lib/api';
import { toast } from 'sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, signOut } = useAuthStore();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [activeResearchId, setActiveResearchId] = useState<string | null>(null);

  // Connect to WebSocket once at layout level
  useEffect(() => {
    if (user) {
      wsClient.connect().catch((err) => {
        console.error('WebSocket connection failed:', err);
      });

      // Listen for budget warnings
      const unsubscribe = wsClient.onMessage((message) => {
        if (message.kind === 'budget_warning') {
          const percentText = message.percentUsed.toFixed(1);
          toast.warning(`Budget Warning: ${percentText}% Used`, {
            description: `You've used $${message.currentCost.toFixed(2)} of your $${message.limit.toFixed(2)} monthly budget.`,
            duration: 10000, // Show for 10 seconds
            action: {
              label: 'View Usage',
              onClick: () => router.push('/usage'),
            },
          });
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user, router]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen bg-[#212121] flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <header className="bg-[#171717] border-b border-gray-800 flex-shrink-0">
        <div className="px-4">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-8">
              <h1 className="text-lg font-semibold text-white">Personal AI Assistant</h1>

              <nav className="flex items-center space-x-1">
                <Link
                  href="/"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
                </Link>
                <button
                  onClick={() => setUploadOpen(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Add Knowledge</span>
                </button>
                <button
                  onClick={() => setKnowledgeOpen(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Knowledge</span>
                </button>
                <Link
                  href="/databases"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <Database className="w-4 h-4" />
                  <span>Databases</span>
                </Link>
                <button
                  onClick={() => setResearchOpen(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Research</span>
                </button>
                <Link
                  href="/usage"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Usage</span>
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>

                {/* Active Research Progress */}
                {activeResearchId && (
                  <ResearchProgress
                    projectId={activeResearchId}
                    onComplete={(project) => {
                      console.log('Research complete:', project);
                      // Keep showing for a few seconds so user can download
                      setTimeout(() => setActiveResearchId(null), 10000);
                    }}
                    onError={(error) => {
                      console.error('Research error:', error);
                      // Clear after error
                      setTimeout(() => setActiveResearchId(null), 5000);
                    }}
                  />
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">{user.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-gray-300 hover:text-white hover:bg-gray-800 text-sm"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Height */}
      <main className="flex-1 overflow-hidden min-h-0">
        {children}
      </main>

      {/* Popup Modals */}
      <UploadDocuments open={uploadOpen} onOpenChange={setUploadOpen} />
      <KnowledgeBase open={knowledgeOpen} onOpenChange={setKnowledgeOpen} />
      <ResearchDialog
        isOpen={researchOpen}
        onClose={() => setResearchOpen(false)}
        onResearchStarted={(projectId) => {
          setActiveResearchId(projectId);
        }}
      />
    </div>
  );
}
