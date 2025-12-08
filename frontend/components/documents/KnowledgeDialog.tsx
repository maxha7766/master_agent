'use client';

/**
 * Knowledge Dialog
 * Combined modal for viewing and uploading documents
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import {
  X,
  Upload,
  FileText,
  Table,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react';

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

interface UploadingDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed' | 'duplicate';
  processing_progress?: number;
  error_message?: string;
}

interface KnowledgeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type KnowledgeTab = 'view' | 'add';

function isTabularFile(mimeType: string): boolean {
  return [
    'text/csv',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ].includes(mimeType);
}

export default function KnowledgeDialog({ isOpen, onClose }: KnowledgeDialogProps) {
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('view');

  // View Knowledge state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Knowledge state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTableMode, setIsTableMode] = useState(false);
  const [tableDescription, setTableDescription] = useState('');
  const [uploadingDocs, setUploadingDocs] = useState<UploadingDocument[]>([]);

  // Fetch documents when View tab is opened
  const fetchDocuments = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setViewError(null);

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
      setViewError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'view') {
      fetchDocuments();
    }
  }, [isOpen, activeTab, session]);

  const handleDeleteDocument = async (documentId: string) => {
    if (!session?.access_token) return;

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
        const errorMsg =
          typeof errorData.error === 'string'
            ? errorData.error
            : errorData.error?.message ||
            errorData.message ||
            `Failed to delete document (${response.status})`;
        throw new Error(errorMsg);
      }

      await fetchDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      setViewError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !session?.access_token) return;

    setUploading(true);
    setUploadError(null);

    const filesArray = Array.from(files);

    for (const file of filesArray) {
      await uploadSingleFile(file);
    }

    setUploading(false);
    setTableDescription('');
    event.target.value = '';
  };

  const uploadSingleFile = async (file: File) => {
    if (!session?.access_token) return;

    const tempDoc: UploadingDocument = {
      id: `temp-${Date.now()}-${Math.random()}`,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      status: 'uploading',
      processing_progress: 0,
    };

    setUploadingDocs((prev) => [...prev, tempDoc]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (isTableMode && tableDescription.trim()) {
        formData.append('description', tableDescription.trim());
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          typeof errorData.error === 'string'
            ? errorData.error
            : errorData.error?.message || errorData.message || 'Failed to upload document';
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.duplicate) {
        setUploadingDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempDoc.id ? { ...doc, status: 'duplicate', error_message: 'Document already exists' } : doc
          )
        );
        setTimeout(() => {
          setUploadingDocs((prev) => prev.filter((d) => d.id !== tempDoc.id));
        }, 3000);
      } else {
        setUploadingDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempDoc.id ? { ...doc, id: result.id, status: 'processing', processing_progress: 0 } : doc
          )
        );
        pollDocumentStatus(result.id);
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setUploadingDocs((prev) =>
        prev.map((doc) => (doc.id === tempDoc.id ? { ...doc, status: 'failed' } : doc))
      );
    }
  };

  const pollDocumentStatus = async (documentId: string) => {
    if (!session?.access_token) return;

    const checkStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/documents/${documentId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) return;

        const doc = await response.json();

        const progress =
          typeof doc.processing_progress === 'object' && doc.processing_progress !== null
            ? doc.processing_progress.percent || 0
            : doc.processing_progress || 0;

        setUploadingDocs((prev) =>
          prev.map((d) =>
            d.id === documentId
              ? {
                ...d,
                status: doc.status,
                processing_progress: progress,
              }
              : d
          )
        );

        if (doc.status === 'completed' || doc.status === 'failed') {
          setTimeout(() => {
            setUploadingDocs((prev) => prev.filter((d) => d.id !== documentId));
          }, 3000);
        } else {
          setTimeout(checkStatus, 1000);
        }
      } catch (err) {
        console.error('Error polling document status:', err);
      }
    };

    checkStatus();
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

  const getStatusIcon = (status: Document['status'] | UploadingDocument['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'duplicate':
        return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
    }
  };

  const renderProgressBar = (doc: UploadingDocument) => {
    if (doc.status !== 'processing' && doc.status !== 'uploading') {
      return null;
    }

    const percent = doc.processing_progress || 0;
    const isTableFile = isTabularFile(doc.file_type);

    return (
      <div className="mt-3 space-y-2">
        <div className="w-full bg-[#0a0a0a] rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${isTableFile ? 'bg-blue-500' : 'bg-green-500'
              }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {doc.status === 'uploading'
              ? 'Uploading...'
              : isTableFile
                ? 'Processing tabular data...'
                : 'Processing document...'}
          </span>
          <span className={`font-medium ${isTableFile ? 'text-blue-400' : 'text-green-400'}`}>{percent}%</span>
        </div>
      </div>
    );
  };

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = (doc.title || doc.file_name).toLowerCase();
    const fileType = doc.file_type.toLowerCase();
    return title.includes(query) || fileType.includes(query);
  });

  const handleClose = () => {
    setUploadingDocs([]);
    setViewError(null);
    setUploadError(null);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Knowledge</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('view')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'view'
                ? 'bg-[#1a1a1a] text-white border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]/50'
              }`}
          >
            View Knowledge
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'add'
                ? 'bg-[#1a1a1a] text-white border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]/50'
              }`}
          >
            Add Knowledge
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* VIEW KNOWLEDGE TAB */}
          {activeTab === 'view' && (
            <div className="space-y-4">
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

              {/* Error Message */}
              {viewError && (
                <div className="bg-red-900/20 border border-red-700/50 text-red-400 p-4 rounded-lg">
                  <p>{viewError}</p>
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
                    {searchQuery ? 'Try a different search term' : 'Switch to "Add Knowledge" tab to upload'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
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

                        <div className="flex-shrink-0">{getStatusIcon(doc.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADD KNOWLEDGE TAB */}
          {activeTab === 'add' && (
            <div className="space-y-6">
              {/* Error Message */}
              {uploadError && (
                <div className="bg-red-900/20 border border-red-700/50 text-red-400 p-4 rounded-lg">
                  <p>{typeof uploadError === 'string' ? uploadError : JSON.stringify(uploadError)}</p>
                </div>
              )}

              {/* Upload Section */}
              <Card className="bg-[#212121] border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Upload Documents</h3>

                  {/* Mode Toggle */}
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${!isTableMode ? 'text-white' : 'text-gray-500'}`}>
                      <FileText className="w-4 h-4 inline mr-1" />
                      RAG Docs
                    </span>
                    <Switch checked={isTableMode} onCheckedChange={setIsTableMode} />
                    <span className={`text-sm font-medium ${isTableMode ? 'text-white' : 'text-gray-500'}`}>
                      <Table className="w-4 h-4 inline mr-1" />
                      Table Data
                    </span>
                  </div>
                </div>

                {/* Context Field for Table Mode */}
                {isTableMode && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Data Context (Optional)</label>
                    <Textarea
                      value={tableDescription}
                      onChange={(e) => setTableDescription(e.target.value)}
                      placeholder="e.g., 'Q4 2024 sales data from Northeast region' or 'Customer database with purchase history'"
                      className="bg-[#171717] border border-gray-700 text-white placeholder:text-gray-500 min-h-[80px]"
                      disabled={uploading}
                    />
                    <p className="text-xs text-gray-500 mt-1">Help the AI understand your data by describing what it contains</p>
                  </div>
                )}

                {/* File Upload */}
                <div className="flex items-center gap-4">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept={isTableMode ? '.csv,.xlsx,.xls' : '.txt,.pdf,.docx,.epub,application/epub+zip,application/x-epub'}
                      onChange={handleFileUpload}
                      disabled={uploading}
                      multiple
                      className="hidden"
                      id="file-upload-dialog"
                    />
                    <Button
                      asChild
                      disabled={uploading}
                      className="w-full bg-[#171717] hover:bg-gray-700 text-white border border-gray-700"
                    >
                      <label htmlFor="file-upload-dialog" className="cursor-pointer flex items-center justify-center gap-2">
                        {uploading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5" />
                            Choose Files
                          </>
                        )}
                      </label>
                    </Button>
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {isTableMode
                    ? 'Supported formats: .csv, .xlsx, .xls (max 100MB each) • Select multiple files'
                    : 'Supported formats: .txt, .pdf, .docx, .epub (max 100MB each) • Select multiple files'}
                </p>
              </Card>

              {/* Uploading Documents List */}
              {uploadingDocs.length > 0 && (
                <Card className="bg-[#212121] border border-gray-800 p-5">
                  <h3 className="text-lg font-semibold text-white mb-4">Uploading</h3>
                  <div className="space-y-3">
                    {uploadingDocs.map((doc) => (
                      <div key={doc.id} className="p-4 bg-[#171717] border border-gray-700 rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            {isTabularFile(doc.file_type) ? (
                              <Table className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <FileText className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-medium break-words">{doc.file_name}</h4>
                              <div className="flex items-center gap-4 text-sm mt-1">
                                <span className="text-gray-500">{formatFileSize(doc.file_size)}</span>
                                {doc.status === 'duplicate' && <span className="text-orange-400">Already uploaded</span>}
                                {doc.status === 'failed' && doc.error_message && (
                                  <span className="text-red-400">{doc.error_message}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0">{getStatusIcon(doc.status)}</div>
                        </div>
                        {renderProgressBar(doc)}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
