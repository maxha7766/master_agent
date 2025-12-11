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
import { MessageSquare, FileText, Database, Search, Settings, BarChart3, Brain, Menu, X, ImageIcon, Award } from 'lucide-react';
import KnowledgeDialog from '../../components/documents/KnowledgeDialog';
import ResearchDialog from '../../components/research/ResearchDialog';
import { UnifiedMediaDialog } from '../../components/input/UnifiedMediaDialog';
import type { ImageGenerationParams } from '../../components/images/ImageGenerationDialog'; // Keep type import or move it
import ResearchProgress from '../../components/research/ResearchProgress';
import { toast } from 'sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, signOut } = useAuthStore();
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [activeResearchId, setActiveResearchId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // Handle image generation from header dialog
  const handleGenerateImage = (params: ImageGenerationParams) => {
    if (!wsClient.isConnected()) {
      toast.error('Not connected to server');
      return;
    }

    wsClient.send({
      kind: 'image_generate',
      parameters: params,
    });

    toast.success('Image generation started...');
  };

  // Connect to WebSocket once at layout level
  useEffect(() => {
    if (!user) return;

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
    <div className="h-full bg-[#212121] flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <header className="bg-[#171717] border-b border-gray-800 flex-shrink-0">
        <div className="px-2 sm:px-4">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-2 sm:space-x-8">
              <h1 className="text-sm sm:text-lg font-semibold text-white">Bob</h1>

              {/* Desktop Navigation - Hidden on mobile */}
              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  href="/"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
                </Link>
                <button
                  onClick={() => setKnowledgeDialogOpen(true)}
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
                  href="/memories"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <Brain className="w-4 h-4" />
                  <span>Memories</span>
                </Link>
                <Link
                  href="/usage"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Usage</span>
                </Link>
                <Link
                  href="/cards"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <Award className="w-4 h-4" />
                  <span>Cards</span>
                </Link>
                <button
                  onClick={() => setImageDialogOpen(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Media</span>
                </button>
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

            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="hidden sm:inline text-sm text-gray-400">{user.email}</span>

              {/* Desktop Sign Out - Hidden on mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="hidden md:block text-gray-300 hover:text-white hover:bg-gray-800 text-xs sm:text-sm"
              >
                Sign Out
              </Button>

              {/* Mobile Hamburger Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-gray-300 hover:text-white hover:bg-gray-800 p-2"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-[#171717] z-50 transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="h-full flex flex-col">
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Menu</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-300 hover:text-white p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation Section */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Navigation</h3>
            <nav className="space-y-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Chat</span>
              </Link>
              <button
                onClick={() => {
                  setKnowledgeDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span>Knowledge</span>
              </button>
              <Link
                href="/databases"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <Database className="w-5 h-5" />
                <span>Databases</span>
              </Link>
              <button
                onClick={() => {
                  setResearchOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <Search className="w-5 h-5" />
                <span>Research</span>
              </button>
              <Link
                href="/memories"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <Brain className="w-5 h-5" />
                <span>Memories</span>
              </Link>
              <Link
                href="/usage"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <BarChart3 className="w-5 h-5" />
                <span>Usage</span>
              </Link>
              <Link
                href="/cards"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <Award className="w-5 h-5" />
                <span>Cards</span>
              </Link>
              <button
                onClick={() => {
                  setImageDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
                <span>Media</span>
              </button>
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
            </nav>
          </div>

          {/* Conversations Section - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Conversations</h3>
            {/* ConversationSidebar content will be moved here */}
            <p className="text-sm text-gray-500">Conversation history will appear here</p>
          </div>

          {/* Bottom Section - User Info & Sign Out */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-sm text-gray-400 mb-2">{user.email}</div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Height */}
      <main className="flex-1 overflow-hidden min-h-0">
        {children}
      </main>

      {/* Popup Modals */}
      <KnowledgeDialog isOpen={knowledgeDialogOpen} onClose={() => setKnowledgeDialogOpen(false)} />
      <ResearchDialog
        isOpen={researchOpen}
        onClose={() => setResearchOpen(false)}
        onResearchStarted={(projectId) => {
          setActiveResearchId(projectId);
        }}
      />
      <UnifiedMediaDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onGenerateImage={handleGenerateImage}
      />
    </div>
  );
}
