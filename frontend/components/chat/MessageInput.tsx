'use client';

/**
 * MessageInput Component
 * Input field for sending chat messages with optional image attachment
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface MessageInputProps {
  onSend: (content: string, attachedImageUrl?: string) => void;
  disabled?: boolean;
}

interface AttachedImage {
  url: string;
  filename: string;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug: log render state
  console.log('[MessageInput] Render - attachedImage:', attachedImage, 'uploading:', uploading);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    console.log('[MessageInput] Sending message with attachedImageUrl:', attachedImage?.url);
    onSend(trimmed, attachedImage?.url);
    setMessage('');
    setAttachedImage(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without shift sends the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Space inserts a space
    else if (e.key === ' ' && e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = message.substring(0, start) + ' ' + message.substring(end);
      setMessage(newValue);
      // Set cursor position after the inserted space
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[MessageInput] File selected:', file?.name, file?.type, file?.size);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setUploading(true);
    console.log('[MessageInput] Starting upload to:', `${process.env.NEXT_PUBLIC_API_URL}/api/images/upload`);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      console.log('[MessageInput] Auth token present:', !!token);

      if (!token) {
        toast.error('Please sign in to upload images');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log('[MessageInput] Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MessageInput] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[MessageInput] Upload success, URL:', data.url);

      setAttachedImage({
        url: data.url,
        filename: file.name,
      });
      console.log('[MessageInput] State updated with attached image');
      toast.success('Image attached');
    } catch (error) {
      console.error('[MessageInput] Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearAttachment = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {/* Attached image preview */}
      {attachedImage && (
        <div className="flex items-center gap-2 px-5 mb-1">
          <div className="flex items-center gap-3 bg-gray-700/60 rounded-lg px-3 py-2">
            <img
              src={attachedImage.url}
              alt="Attached"
              className="h-10 w-10 rounded object-cover"
            />
            <div className="flex flex-col">
              <span className="text-sm text-gray-200 truncate max-w-[200px]">
                {attachedImage.filename}
              </span>
              <span className="text-xs text-gray-400">Describe how to edit it</span>
            </div>
            <button
              onClick={clearAttachment}
              className="ml-2 p-1.5 hover:bg-gray-600 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end bg-[#2f2f2f] rounded-[24px] px-4 py-2 border border-gray-700 focus-within:border-gray-500 transition-all">
        {/* Attachment button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="chat-image-upload"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="rounded-full h-8 w-8 p-0 transition-all flex-shrink-0 text-gray-400 hover:text-white bg-transparent hover:bg-gray-700/50 mb-0.5"
          size="icon"
          title="Attach Image"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </Button>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachedImage?.url ? "Describe how to edit..." : "Message"}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent border-0 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-[16px] px-0 py-1.5 resize-none min-h-[36px] max-h-[120px]"
        />

        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={`rounded-full h-8 w-8 p-0 transition-all flex-shrink-0 mb-0.5 ${message.trim()
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          size="icon"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
