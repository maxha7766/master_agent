'use client';

/**
 * MessageInput Component
 * Input field for sending chat messages
 */

import { useState, KeyboardEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me anything..."
        disabled={disabled}
        className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500"
      >
        Send
      </Button>
    </div>
  );
}
