/**
 * Chat Settings Store
 * Manages RAG and chat behavior settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DisciplineLevel = 'strict' | 'moderate' | 'exploration';

export interface ChatSettings {
  // Agent Discipline Level
  disciplineLevel: DisciplineLevel;
  minRelevanceScore: number;

  // Knowledge Source Mode
  ragOnlyMode: boolean; // If true, only use RAG/table data, no general knowledge

  // Document Filters
  fileTypes: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  selectedDocuments: string[]; // Document IDs

  // Advanced Settings
  topK: number; // Number of chunks to retrieve
  useReranking: boolean;
  hybridSearchBalance: number; // 0-1, 0=pure keyword, 1=pure semantic
}

interface ChatSettingsStore {
  settings: ChatSettings;

  // Actions
  setDisciplineLevel: (level: DisciplineLevel) => void;
  setRagOnlyMode: (ragOnly: boolean) => void;
  setFileTypes: (types: string[]) => void;
  setDateRange: (start: Date | null, end: Date | null) => void;
  setSelectedDocuments: (docIds: string[]) => void;
  setTopK: (topK: number) => void;
  setUseReranking: (use: boolean) => void;
  setHybridSearchBalance: (balance: number) => void;
  resetToDefaults: () => void;
}

// Default settings
const defaultSettings: ChatSettings = {
  disciplineLevel: 'moderate',
  minRelevanceScore: 0.2, // Works with Cohere reranking scores
  ragOnlyMode: false,
  fileTypes: [],
  dateRange: {
    start: null,
    end: null,
  },
  selectedDocuments: [],
  topK: 5,
  useReranking: true,
  hybridSearchBalance: 0.5,
};

// Discipline level presets
// NOTE: These values work with RRF + Cohere reranking scores
// Cohere reranking returns scores typically between 0-1, where higher is better
// After reranking, most relevant results score 0.8-1.0
const disciplinePresets: Record<DisciplineLevel, number> = {
  strict: 0.5,      // Only very relevant results (reranked score > 0.5)
  moderate: 0.2,    // Moderately relevant results (reranked score > 0.2)
  exploration: 0.0, // All results, let reranking do the filtering
};

export const useChatSettingsStore = create<ChatSettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      setDisciplineLevel: (level) =>
        set((state) => ({
          settings: {
            ...state.settings,
            disciplineLevel: level,
            minRelevanceScore: disciplinePresets[level],
          },
        })),

      setRagOnlyMode: (ragOnly) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ragOnlyMode: ragOnly,
          },
        })),

      setFileTypes: (types) =>
        set((state) => ({
          settings: {
            ...state.settings,
            fileTypes: types,
          },
        })),

      setDateRange: (start, end) =>
        set((state) => ({
          settings: {
            ...state.settings,
            dateRange: { start, end },
          },
        })),

      setSelectedDocuments: (docIds) =>
        set((state) => ({
          settings: {
            ...state.settings,
            selectedDocuments: docIds,
          },
        })),

      setTopK: (topK) =>
        set((state) => ({
          settings: {
            ...state.settings,
            topK,
          },
        })),

      setUseReranking: (use) =>
        set((state) => ({
          settings: {
            ...state.settings,
            useReranking: use,
          },
        })),

      setHybridSearchBalance: (balance) =>
        set((state) => ({
          settings: {
            ...state.settings,
            hybridSearchBalance: balance,
          },
        })),

      resetToDefaults: () =>
        set({
          settings: defaultSettings,
        }),
    }),
    {
      name: 'chat-settings-storage',
    }
  )
);
