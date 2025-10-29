/**
 * Documents Zustand Store
 * Manages document uploads and search
 */

import { create } from 'zustand';
import { api, Document, DocumentDetail, SearchResult } from '../lib/api';

interface DocumentsState {
  // Data
  documents: Document[];
  currentDocument: DocumentDetail | null;
  searchResults: SearchResult[];

  // UI State
  loading: boolean;
  uploading: boolean;
  searching: boolean;
  error: string | null;
  uploadProgress: number;

  // Actions
  loadDocuments: () => Promise<void>;
  loadDocument: (id: string) => Promise<void>;
  uploadDocument: (file: File, metadata?: Record<string, any>) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  searchDocuments: (query: string, limit?: number) => Promise<void>;
  clearSearch: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  // Initial state
  documents: [],
  currentDocument: null,
  searchResults: [],
  loading: false,
  uploading: false,
  searching: false,
  error: null,
  uploadProgress: 0,

  // Load all documents
  loadDocuments: async () => {
    set({ loading: true, error: null });
    try {
      const documents = await api.getDocuments();
      set({ documents, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load documents',
        loading: false,
      });
    }
  },

  // Load specific document with chunks
  loadDocument: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const document = await api.getDocument(id);
      set({ currentDocument: document, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load document',
        loading: false,
      });
    }
  },

  // Upload document
  uploadDocument: async (file: File, metadata?: Record<string, any>) => {
    set({ uploading: true, error: null, uploadProgress: 0 });

    try {
      // Note: Progress tracking would require XMLHttpRequest or fetch with ReadableStream
      // For now, we'll use the API client directly
      const document = await api.uploadDocument(file, metadata);

      set((state) => ({
        documents: [document, ...state.documents],
        uploading: false,
        uploadProgress: 100,
      }));

      // Reset progress after delay
      setTimeout(() => {
        set({ uploadProgress: 0 });
      }, 1000);

      return document;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to upload document',
        uploading: false,
        uploadProgress: 0,
      });
      throw error;
    }
  },

  // Delete document
  deleteDocument: async (id: string) => {
    try {
      await api.deleteDocument(id);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete document',
      });
    }
  },

  // Search documents
  searchDocuments: async (query: string, limit?: number) => {
    if (!query.trim()) {
      set({ searchResults: [], searching: false });
      return;
    }

    set({ searching: true, error: null });
    try {
      const results = await api.searchDocuments(query, limit);
      set({ searchResults: results, searching: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        searching: false,
      });
    }
  },

  // Clear search results
  clearSearch: () => {
    set({ searchResults: [] });
  },

  // Set error
  setError: (error: string | null) => {
    set({ error });
  },

  // Reset state
  reset: () => {
    set({
      documents: [],
      currentDocument: null,
      searchResults: [],
      loading: false,
      uploading: false,
      searching: false,
      error: null,
      uploadProgress: 0,
    });
  },
}));
