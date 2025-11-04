'use client';

/**
 * Knowledge Base Popup
 * Modal for viewing all uploaded documents
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { FileText, Table, Trash2, Loader2, CheckCircle2, AlertCircle, Search } from 'lucide-react';

interface Document {
  id: string;
  file_name: string;
  title?: string;
  file_type: string;
  file_size: number;
  status: 'processing' | 'completed' | 'failed';
  chunk_count?: number;
  row_count?: number;
  column_count?: number;
  user_description?: string;
  created_at: string;
  processed_at?: string;
  processing_progress?: number;
}

interface KnowledgeBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isTabularFile(mimeType: string): boolean {
  return ['text/csv', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(mimeType);
}

export default function KnowledgeBase({ open, onOpenChange }: KnowledgeBaseProps) {
  const { session } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocuments = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/documents`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
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
    if (open) {
      fetchDocuments();
    }
  }, [open, session]);

  const handleDeleteDocument = async (documentId: string) => {
    if (!session?.access_token) return;

    // Use native browser confirm
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = typeof errorData.error === 'string'
          ? errorData.error
          : errorData.error?.message || errorData.message || `Failed to delete document (${response.status})`;
        throw new Error(errorMsg);
      }

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

  // Filter documents based on search query
  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = (doc.title || doc.file_name).toLowerCase();
    const fileType = doc.file_type.toLowerCase();
    return title.includes(query) || fileType.includes(query);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2f2f2f] border-2 border-gray-600 text-white w-[700px] max-w-[90vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">Knowledge Base</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
          />
        </div>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 text-red-400 p-4 rounded-lg">
              <p>{error}</p>
            </div>
          )}

          {/* Documents List */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-400 mt-4">Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-500 mb-4" />
              <p className="text-gray-400">
                {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery ? 'Try a different search term' : 'Upload your first document to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-x-hidden">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    {isTabularFile(doc.file_type) ? (
                      <Table className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{doc.title || doc.file_name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                        <span className="capitalize">{doc.file_type.split('/')[1] || doc.file_type}</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span className="whitespace-nowrap">{formatDate(doc.created_at)}</span>
                        {doc.status === 'completed' && (
                          <>
                            {doc.chunk_count != null && doc.chunk_count > 0 && (
                              <span className="text-green-400 whitespace-nowrap">{doc.chunk_count} chunks</span>
                            )}
                            {doc.row_count != null && doc.row_count > 0 && (
                              <span className="text-blue-400 whitespace-nowrap">
                                {doc.row_count} rows × {doc.column_count} cols
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {getStatusIcon(doc.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

    </Dialog>
  );
}
