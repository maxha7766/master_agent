'use client';

/**
 * Chat Settings Modal
 * Allows users to configure RAG behavior and document filtering
 */

import { useChatSettingsStore, type DisciplineLevel } from '../../src/store/chatSettingsStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';

interface ChatSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatSettings({ open, onOpenChange }: ChatSettingsProps) {
  const { settings, setDisciplineLevel, setRagOnlyMode, setFileTypes, setDateRange, setTopK, setUseReranking, setHybridSearchBalance, resetToDefaults } =
    useChatSettingsStore();

  // Available file types (in real implementation, fetch from backend)
  const availableFileTypes = ['pdf', 'txt', 'md', 'docx', 'csv'];

  const handleFileTypeToggle = (type: string) => {
    const newTypes = settings.fileTypes.includes(type)
      ? settings.fileTypes.filter((t) => t !== type)
      : [...settings.fileTypes, type];
    setFileTypes(newTypes);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    if (type === 'start') {
      setDateRange(date, settings.dateRange.end);
    } else {
      setDateRange(settings.dateRange.start, date);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#2f2f2f] border-2 border-gray-600 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Chat Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure how the AI searches and responds to your queries
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Knowledge Source Mode */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rag-only" className="text-base font-semibold text-white cursor-pointer">
                  RAG Only Mode
                </Label>
                <p className="text-sm text-gray-400 mt-1">
                  Only use information from uploaded documents and tables. Disable to allow general knowledge responses.
                </p>
              </div>
              <Checkbox
                id="rag-only"
                checked={settings.ragOnlyMode}
                onCheckedChange={(checked) => setRagOnlyMode(checked as boolean)}
              />
            </div>
          </div>

          {/* Agent Discipline Level */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold text-white">Agent Discipline Level</Label>
              <p className="text-sm text-gray-400 mt-1">
                Control how strictly the AI filters results by relevance
              </p>
            </div>

            <RadioGroup
              value={settings.disciplineLevel}
              onValueChange={(value) => setDisciplineLevel(value as DisciplineLevel)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="strict" id="strict" />
                <Label htmlFor="strict" className="font-normal cursor-pointer text-white">
                  <div>
                    <div className="font-medium">Strict Mode</div>
                    <div className="text-xs text-gray-400">
                      Only highly relevant results (threshold: 0.7)
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="moderate" />
                <Label htmlFor="moderate" className="font-normal cursor-pointer text-white">
                  <div>
                    <div className="font-medium">Moderate Mode</div>
                    <div className="text-xs text-gray-400">
                      Balanced relevance (threshold: 0.5)
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="exploration" id="exploration" />
                <Label htmlFor="exploration" className="font-normal cursor-pointer text-white">
                  <div>
                    <div className="font-medium">Exploration Mode</div>
                    <div className="text-xs text-gray-400">
                      Cast a wider net (threshold: 0.3)
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* File Type Filters */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold text-white">File Type Filters</Label>
              <p className="text-sm text-gray-400 mt-1">
                Select which file types to include in search results
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {availableFileTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`file-${type}`}
                    checked={settings.fileTypes.includes(type)}
                    onCheckedChange={() => handleFileTypeToggle(type)}
                  />
                  <Label htmlFor={`file-${type}`} className="font-normal cursor-pointer text-white">
                    .{type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold text-white">Date Range</Label>
              <p className="text-sm text-gray-400 mt-1">
                Filter documents by upload date
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-start" className="text-white">Start Date</Label>
                <Input
                  id="date-start"
                  type="date"
                  value={formatDate(settings.dateRange.start)}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="bg-[#1a1a1a] border-2 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-end" className="text-white">End Date</Label>
                <Input
                  id="date-end"
                  type="date"
                  value={formatDate(settings.dateRange.end)}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="bg-[#1a1a1a] border-2 border-gray-600 text-white"
                />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4 pt-4 border-t border-gray-700">
            <Label className="text-base font-semibold text-white">Advanced Settings</Label>

            {/* Number of Results (topK) */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="topK" className="text-white">Number of Chunks to Retrieve</Label>
                <span className="text-sm text-gray-400">{settings.topK}</span>
              </div>
              <Slider
                id="topK"
                min={1}
                max={20}
                step={1}
                value={[settings.topK]}
                onValueChange={(value) => setTopK(value[0])}
              />
              <p className="text-xs text-gray-400">
                More chunks provide more context but may include less relevant results
              </p>
            </div>

            {/* Hybrid Search Balance */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="balance" className="text-white">Hybrid Search Balance</Label>
                <span className="text-sm text-gray-400">
                  {settings.hybridSearchBalance === 0
                    ? 'Keyword'
                    : settings.hybridSearchBalance === 1
                    ? 'Semantic'
                    : 'Balanced'}
                </span>
              </div>
              <Slider
                id="balance"
                min={0}
                max={1}
                step={0.1}
                value={[settings.hybridSearchBalance]}
                onValueChange={(value) => setHybridSearchBalance(value[0])}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Pure Keyword</span>
                <span>Pure Semantic</span>
              </div>
            </div>

            {/* Reranking Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reranking" className="cursor-pointer text-white">
                  Enable Result Reranking
                </Label>
                <p className="text-xs text-gray-400 mt-1">
                  Use advanced reranking for more accurate results (may be slower)
                </p>
              </div>
              <Checkbox
                id="reranking"
                checked={settings.useReranking}
                onCheckedChange={(checked) => setUseReranking(checked as boolean)}
              />
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t border-gray-700">
            <Button variant="outline" onClick={resetToDefaults} className="w-full bg-[#1a1a1a] border-2 border-gray-600 text-white hover:bg-[#252525] hover:text-white">
              Reset to Defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
