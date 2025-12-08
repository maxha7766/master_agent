'use client';

/**
 * Upload Documents Popup
 * Modal for uploading documents with progress tracking
 */

import { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Upload, FileText, Table, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface UploadingDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed' | 'duplicate';
  processing_progress?: number;
  error_message?: string;
}

interface UploadDocumentsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isTabularFile(mimeType: string): boolean {
  return ['text/csv', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(mimeType);
}

export default function UploadDocuments({ open, onOpenChange }: UploadDocumentsProps) {
  const { session } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTableMode, setIsTableMode] = useState(false);
  const [tableDescription, setTableDescription] = useState('');
  const [uploadingDocs, setUploadingDocs] = useState<UploadingDocument[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !session?.access_token) return;

    setUploading(true);
    setError(null);

    // Convert FileList to Array and process each file
    const filesArray = Array.from(files);

    // Upload files sequentially to avoid overwhelming the server
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
        const errorMessage = typeof errorData.error === 'string'
          ? errorData.error
          : errorData.error?.message || errorData.message || 'Failed to upload document';
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.duplicate) {
        setUploadingDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempDoc.id
              ? { ...doc, status: 'duplicate', error_message: 'Document already exists' }
              : doc
          )
        );
        // Remove duplicate after 3 seconds
        setTimeout(() => {
          setUploadingDocs((prev) => prev.filter((d) => d.id !== tempDoc.id));
        }, 3000);
      } else {
        // Update to processing status
        setUploadingDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempDoc.id
              ? { ...doc, id: result.id, status: 'processing', processing_progress: 0 }
              : doc
          )
        );

        // Poll for completion
        pollDocumentStatus(result.id);
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setUploadingDocs((prev) =>
        prev.map((doc) =>
          doc.id === tempDoc.id
            ? { ...doc, status: 'failed' }
            : doc
        )
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

        // Extract percent from processing_progress if it's an object
        const progress = typeof doc.processing_progress === 'object' && doc.processing_progress !== null
          ? doc.processing_progress.percent || 0
          : (doc.processing_progress || 0);

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
          // Keep in list for 3 seconds then remove
          setTimeout(() => {
            setUploadingDocs((prev) => prev.filter((d) => d.id !== documentId));
          }, 3000);
        } else {
          // Continue polling
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

  const getStatusIcon = (status: UploadingDocument['status']) => {
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
          <span className={`font-medium ${isTableFile ? 'text-blue-400' : 'text-green-400'}`}>
            {percent}%
          </span>
        </div>
      </div>
    );
  };

  // Clear upload list when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Clear the upload list when closing
      setUploadingDocs([]);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border border-gray-700 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">Add Knowledge</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 text-red-400 p-4 rounded-lg">
              <p>{typeof error === 'string' ? error : JSON.stringify(error)}</p>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data Context (Optional)
                </label>
                <Textarea
                  value={tableDescription}
                  onChange={(e) => setTableDescription(e.target.value)}
                  placeholder="e.g., 'Q4 2024 sales data from Northeast region' or 'Customer database with purchase history'"
                  className="bg-[#171717] border border-gray-700 text-white placeholder:text-gray-500 min-h-[80px]"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Help the AI understand your data by describing what it contains
                </p>
              </div>
            )}

            {/* File Upload */}
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept={isTableMode ? '.csv, .xlsx, .xls' : '.txt, .pdf, .docx, .epub, application/epub+zip'}
                  onChange={handleFileUpload}
                  disabled={uploading}
                  multiple
                  className="hidden"
                  id="file-upload-popup"
                />
                <Button
                  asChild
                  disabled={uploading}
                  className="w-full bg-[#171717] hover:bg-gray-700 text-white border border-gray-700"
                >
                  <label htmlFor="file-upload-popup" className="cursor-pointer flex items-center justify-center gap-2">
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
                  <div
                    key={doc.id}
                    className="p-4 bg-[#171717] border border-gray-700 rounded-lg"
                  >
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
                            {doc.status === 'duplicate' && (
                              <span className="text-orange-400">Already uploaded</span>
                            )}
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
      </DialogContent>
    </Dialog>
  );
}
