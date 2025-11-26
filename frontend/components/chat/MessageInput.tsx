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

interface MessageInputProps {
  onSend: (content: string, attachedImageUrl?: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed, attachedImage || undefined);
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
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setAttachedImage(data.url);
      toast.success('Image attached');
    } catch (error) {
      console.error('Upload error:', error);
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
        <div className="flex items-center gap-2 px-5">
          <div className="relative inline-block">
            <img
              src={attachedImage}
              alt="Attached"
              className="h-16 rounded border border-gray-600"
            />
            <button
              onClick={clearAttachment}
              className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
          <span className="text-xs text-gray-400">Image attached - describe how to edit it</span>
        </div>
      )}

      <div className="flex gap-3 items-start bg-[#2f2f2f] border-2 border-gray-600 rounded-3xl shadow-lg px-5 py-3 focus-within:border-gray-500 transition-all">
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
          className="rounded-full h-9 w-9 p-0 transition-all mt-1 bg-gray-700 hover:bg-gray-600 text-gray-300"
          size="icon"
          title="Attach Image"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachedImage ? "Describe how to edit this image..." : "Message..."}
          disabled={disabled}
          rows={4}
          className="flex-1 bg-transparent border-0 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] px-0 resize-none min-h-[96px]"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={`rounded-full h-9 w-9 p-0 transition-all mt-1 ${
            message.trim()
              ? 'bg-white hover:bg-gray-200 text-black'
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
