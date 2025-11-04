'use client';

/**
 * Client-side Providers
 * Initializes auth and WebSocket connections
 */

import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '../store/auth';
import { wsClient } from '../lib/websocket';

export function Providers({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Initialize auth on mount
    initializeAuth();

    // Cleanup on unmount
    return () => {
      wsClient.disconnect();
    };
  }, [initializeAuth]);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
