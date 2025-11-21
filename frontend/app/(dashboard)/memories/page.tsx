'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Users,
  TrendingUp,
  Trash2,
  RefreshCw,
  Sparkles,
  Calendar,
  Eye,
} from 'lucide-react';

interface Memory {
  id: string;
  memory_type: 'fact' | 'preference' | 'insight' | 'event';
  content: string;
  confidence_score: number;
  importance_score: number;
  tags: string[];
  access_count: number;
  created_at: string;
  last_accessed_at: string;
}

interface Entity {
  id: string;
  entity_type: 'person' | 'place' | 'organization' | 'product' | 'concept' | 'event';
  name: string;
  description: string | null;
  mention_count: number;
  importance_score: number;
  attributes: Record<string, any>;
}

interface Stats {
  totalMemories: number;
  memoryTypes: Record<string, number>;
  totalEntities: number;
  entityTypes: Record<string, number>;
  avgConfidence: number;
  avgImportance: number;
}

export default function MemoriesPage() {
  const { user, session } = useAuthStore();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('memories');

  useEffect(() => {
    if (user && session?.access_token) {
      loadData();
    }
  }, [user, session]);

  async function loadData() {
    try {
      setLoading(true);

      const [memoriesRes, entitiesRes, statsRes] = await Promise.all([
        fetch('http://localhost:3001/api/memories', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        fetch('http://localhost:3001/api/memories/entities', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        fetch('http://localhost:3001/api/memories/stats', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
      ]);

      const memoriesData = await memoriesRes.json();
      const entitiesData = await entitiesRes.json();
      const statsData = await statsRes.json();

      setMemories(memoriesData.memories || []);
      setEntities(entitiesData.entities || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    try {
      await fetch(`http://localhost:3001/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  }

  async function handleConsolidate() {
    try {
      const res = await fetch('http://localhost:3001/api/memories/consolidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ threshold: 0.95 }),
      });
      const data = await res.json();
      alert(`Consolidated ${data.autoMerged} similar memories`);
      await loadData();
    } catch (error) {
      console.error('Failed to consolidate:', error);
    }
  }

  async function handleRecalculateImportance() {
    try {
      const res = await fetch('http://localhost:3001/api/memories/recalculate-importance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      alert(data.message);
      await loadData();
    } catch (error) {
      console.error('Failed to recalculate:', error);
    }
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      fact: 'bg-blue-500',
      preference: 'bg-purple-500',
      insight: 'bg-green-500',
      event: 'bg-orange-500',
      person: 'bg-pink-500',
      place: 'bg-cyan-500',
      organization: 'bg-indigo-500',
      product: 'bg-yellow-500',
      concept: 'bg-teal-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">Loading memories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Brain className="w-8 h-8" />
                Memory System
              </h1>
              <p className="text-gray-400 mt-2">
                View and manage your AI's learned memories and entities
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConsolidate} variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Consolidate
              </Button>
              <Button onClick={handleRecalculateImportance} variant="outline" size="sm">
                <TrendingUp className="w-4 h-4 mr-2" />
                Recalculate
              </Button>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Total Memories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{stats.totalMemories}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Total Entities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{stats.totalEntities}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Avg Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">
                    {(stats.avgConfidence * 100).toFixed(0)}%
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Avg Importance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">
                    {(stats.avgImportance * 100).toFixed(0)}%
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a] border-gray-800">
            <TabsTrigger value="memories">
              <Brain className="w-4 h-4 mr-2" />
              Memories ({memories.length})
            </TabsTrigger>
            <TabsTrigger value="entities">
              <Users className="w-4 h-4 mr-2" />
              Entities ({entities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="memories" className="mt-4">
            <div className="grid grid-cols-1 gap-4">
              {memories.map((memory) => (
                <Card key={memory.id} className="bg-[#1a1a1a] border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getTypeColor(memory.memory_type)}>
                            {memory.memory_type}
                          </Badge>
                          {memory.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-gray-400">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-white mb-3">{memory.content}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Confidence: {(memory.confidence_score * 100).toFixed(0)}%
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Importance: {(memory.importance_score * 100).toFixed(0)}%
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Accessed: {memory.access_count}x
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDeleteMemory(memory.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {memories.length === 0 && (
                <Card className="bg-[#1a1a1a] border-gray-800">
                  <CardContent className="p-8 text-center text-gray-400">
                    No memories yet. Start chatting with your AI to build memories!
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="entities" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => (
                <Card key={entity.id} className="bg-[#1a1a1a] border-gray-800">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white">{entity.name}</CardTitle>
                        <Badge className={`${getTypeColor(entity.entity_type)} mt-2`}>
                          {entity.entity_type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{entity.mention_count}</div>
                        <div className="text-xs text-gray-500">mentions</div>
                      </div>
                    </div>
                  </CardHeader>
                  {entity.description && (
                    <CardContent>
                      <p className="text-sm text-gray-400">{entity.description}</p>
                      {Object.keys(entity.attributes).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-800">
                          <div className="text-xs text-gray-500 space-y-1">
                            {Object.entries(entity.attributes).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
              {entities.length === 0 && (
                <Card className="bg-[#1a1a1a] border-gray-800 col-span-full">
                  <CardContent className="p-8 text-center text-gray-400">
                    No entities yet. Start chatting to extract entities from conversations!
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
