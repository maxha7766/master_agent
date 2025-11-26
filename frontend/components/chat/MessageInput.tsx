'use client';

/**
 * MessageInput Component
 * Input field for sending chat messages
 */

import { useState, KeyboardEvent } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  onImageClick?: () => void;
}

export default function MessageInput({ onSend, disabled, onImageClick }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');
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

  return (
    <div className="flex gap-3 items-start bg-[#2f2f2f] border-2 border-gray-600 rounded-3xl shadow-lg px-5 py-3 focus-within:border-gray-500 transition-all">
      {onImageClick && (
        <Button
          onClick={onImageClick}
          disabled={disabled}
          className="rounded-full h-9 w-9 p-0 transition-all mt-1 bg-gray-700 hover:bg-gray-600 text-gray-300"
          size="icon"
          title="Generate Image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </Button>
      )}
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message..."
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
  );
}
