'use client';

/**
 * Settings Page
 * User preferences for LLM models and budget limits
 */

import { useEffect, useState } from 'react';
import { api, type UserSettings } from '../../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from 'sonner';

const AVAILABLE_MODELS = [
  // Claude Models (API Available)
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Latest - Best for Coding)' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast & Cheap)' },

  // GPT-5 Series (Latest - Reasoning Models)
  { value: 'gpt-5.1', label: 'GPT-5.1 (Latest Flagship)' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (Cost-Optimized)' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano (High-Throughput)' },

  // GPT-4 Series
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },

  // Reasoning Models
  { value: 'o1', label: 'o1 (Reasoning)' },

  // Google Gemini Models
  { value: 'gemini-3.0-flash-thinking-exp-1219', label: 'Gemini 3.0 Flash Thinking (Experimental)' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Fast & Smart)' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Long Context)' },
];

export default function SettingsPage() {
  const [, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [defaultChatModel, setDefaultChatModel] = useState('claude-sonnet-4-5-20250929');
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState(10);
  const [ragModel, setRagModel] = useState('');
  const [sqlModel, setSqlModel] = useState('');
  const [researchModel, setResearchModel] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);

      // Populate form
      setDefaultChatModel(data.default_chat_model);
      setMonthlyBudgetLimit(data.monthly_budget_limit);
      setRagModel(data.rag_model || '');
      setSqlModel(data.sql_model || '');
      setResearchModel(data.research_model || '');
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate budget
      if (monthlyBudgetLimit < 0 || monthlyBudgetLimit > 1000) {
        toast.error('Budget must be between $0 and $1000');
        return;
      }

      const updates: Partial<UserSettings> = {
        default_chat_model: defaultChatModel,
        monthly_budget_limit: monthlyBudgetLimit,
      };

      // Only include optional models if set
      if (ragModel) updates.rag_model = ragModel;
      if (sqlModel) updates.sql_model = sqlModel;
      if (researchModel) updates.research_model = researchModel;

      const updated = await api.updateSettings(updates);
      setSettings(updated);

      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#212121]">
        <p className="text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#212121] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
            <p className="text-gray-400">Manage your AI assistant preferences and budget</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-600 hover:bg-gray-700 text-white"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        <div className="space-y-6">
          {/* LLM Model Preferences */}
          <Card className="bg-[#171717] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">LLM Model Preferences</CardTitle>
              <CardDescription className="text-gray-400">
                Configure which AI models to use for different tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Default Chat Model */}
              <div className="space-y-2">
                <Label htmlFor="default-chat-model" className="text-gray-300">
                  Default Chat Model
                </Label>
                <select
                  id="default-chat-model"
                  value={defaultChatModel}
                  onChange={(e) => setDefaultChatModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-700 bg-[#212121] px-3 py-1 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Model used for general chat conversations
                </p>
              </div>

              {/* RAG Model */}
              <div className="space-y-2">
                <Label htmlFor="rag-model" className="text-gray-300">
                  RAG Model (Optional)
                </Label>
                <select
                  id="rag-model"
                  value={ragModel}
                  onChange={(e) => setRagModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-700 bg-[#212121] px-3 py-1 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  <option value="">Use default chat model</option>
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Model used for document search and Q&A
                </p>
              </div>

              {/* SQL Model */}
              <div className="space-y-2">
                <Label htmlFor="sql-model" className="text-gray-300">
                  SQL Model (Optional)
                </Label>
                <select
                  id="sql-model"
                  value={sqlModel}
                  onChange={(e) => setSqlModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-700 bg-[#212121] px-3 py-1 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  <option value="">Use default chat model</option>
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Model used for SQL query generation
                </p>
              </div>

              {/* Research Model */}
              <div className="space-y-2">
                <Label htmlFor="research-model" className="text-gray-300">
                  Research Model (Optional)
                </Label>
                <select
                  id="research-model"
                  value={researchModel}
                  onChange={(e) => setResearchModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-700 bg-[#212121] px-3 py-1 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  <option value="">Use default chat model</option>
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Model used for web research tasks
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Budget Settings */}
          <Card className="bg-[#171717] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Budget Settings</CardTitle>
              <CardDescription className="text-gray-400">
                Set your monthly spending limit for AI usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="monthly-budget" className="text-gray-300">
                  Monthly Budget Limit (USD)
                </Label>
                <Input
                  id="monthly-budget"
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={monthlyBudgetLimit}
                  onChange={(e) => setMonthlyBudgetLimit(Number(e.target.value))}
                  className="bg-[#212121] border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500">
                  Maximum amount to spend per month. You'll be warned at 80% usage.
                </p>
              </div>

              {/* Budget Info */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-400 mb-2">Budget Information</h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• You'll receive a warning when you reach 80% of your budget</li>
                  <li>• The system will block new requests when you reach 100%</li>
                  <li>• Budget resets on the 1st of each month</li>
                  <li>• Minimum: $0, Maximum: $1000</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
