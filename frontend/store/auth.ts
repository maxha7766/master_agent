/**
 * Auth Zustand Store
 * Manages user session state
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user, loading: false }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, error: null });
  },

  initialize: async () => {
    set({ loading: true });

    // Get initial session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      set({
        user: {
          id: session.user.id,
          email: session.user.email || '',
        },
        session,
        loading: false,
      });
    } else {
      set({ user: null, session: null, loading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
          },
          session,
        });
      } else {
        set({ user: null, session: null });
      }
    });
  },
}));
