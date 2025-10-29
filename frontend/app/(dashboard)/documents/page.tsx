'use client';

/**
 * Documents Page
 * Manage uploaded documents for RAG
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/auth';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Upload, FileText, Trash2, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ProcessingProgress {
  step: string;
  percent: number;
  message: string;
}

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'processing' | 'completed' | 'failed';
  chunk_count: number;
  created_at: string;
  processed_at?: string;
  processing_progress?: ProcessingProgress;
}

export default function DocumentsPage() {
  const { session } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!session?.access_token) {
      console.log('No session or access token', { session });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/documents', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch documents:', response.status, errorText);
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }

      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Poll for document status updates every 5 seconds
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [session]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.access_token) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3001/api/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to upload document');
      }

      const result = await response.json();

      // Check if it was a duplicate
      if (result.duplicate) {
        setError(result.message || 'This document has already been uploaded');
      }

      // Refresh document list
      await fetchDocuments();
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!session?.access_token) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Refresh document list
      await fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
    }
  };

  const renderProgressBar = (doc: Document) => {
    if (doc.status !== 'processing' || !doc.processing_progress) {
      return null;
    }

    const progress = doc.processing_progress;

    return (
      <div className="mt-3 space-y-2">
        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        {/* Progress message */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">{progress.message}</span>
          <span className="text-blue-400 font-medium">{progress.percent}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Documents</h1>
        <p className="text-gray-400">
          Upload documents to enhance AI responses with your own knowledge base
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-900/30 border-red-700 p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </Card>
      )}

      {/* Upload Section */}
      <Card className="bg-black border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Upload Document</h2>
        <div className="flex items-center gap-4">
          <label className="flex-1">
            <input
              type="file"
              accept=".txt,.pdf,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <Button
              asChild
              disabled={uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <label htmlFor="file-upload" className="cursor-pointer flex items-center justify-center gap-2">
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Choose File
                  </>
                )}
              </label>
            </Button>
          </label>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: .txt, .pdf, .docx (max 100MB)
        </p>
      </Card>

      {/* Documents List */}
      <Card className="bg-black border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Your Documents</h2>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-400 mt-4">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No documents uploaded yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Upload your first document to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <FileText className="w-6 h-6 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{doc.file_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{formatDate(doc.created_at)}</span>
                        {doc.status === 'completed' && doc.chunk_count > 0 && (
                          <span className="text-green-400">{doc.chunk_count} chunks</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    {getStatusIcon(doc.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Show progress bar for processing documents */}
                {renderProgressBar(doc)}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
