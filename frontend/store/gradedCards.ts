/**
 * Graded Cards Zustand Store
 * Manages graded cards state with direct Supabase connection
 */

import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';
import type { GradedCard } from '../types/gradedCards';

// Direct Supabase connection for graded cards
// Using service role key for local development
const supabaseUrl = 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tandveXlocGRhd2p4c2JwYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYwNDIxNSwiZXhwIjoyMDc3MTgwMjE1fQ.Y1LtWOoavDEGSwFYCfDcwpFwGxc2ZT-91lMmG4prOe0';

const supabaseCards = createClient(supabaseUrl, supabaseKey);

// Editable fields type
export type EditableField = 'card_year' | 'brand' | 'card_number' | 'player_name' | 'attributes' | 'grade' | 'total_cost' | 'estimated_value';

interface GradedCardsState {
  cards: GradedCard[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchCards: () => Promise<void>;
  setCards: (cards: GradedCard[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateEstimatedValue: (cardId: number, estimatedValue: number) => Promise<void>;
  updateTotalCost: (cardId: number, totalCost: number) => Promise<void>;
  updateCardField: (cardId: number, field: EditableField, value: string | number | null) => Promise<void>;
  addCard: (card: Omit<GradedCard, 'id' | 'created_at'>) => Promise<void>;
}

export const useGradedCardsStore = create<GradedCardsState>((set, get) => ({
  cards: [],
  loading: false,
  error: null,

  setCards: (cards) => set({ cards }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchCards: async () => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabaseCards
        .from('graded_cards')
        .select('*')
        .order('player_name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      set({ cards: data || [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch cards',
        loading: false,
      });
    }
  },

  updateEstimatedValue: async (cardId: number, estimatedValue: number) => {
    try {
      const { error } = await supabaseCards
        .from('graded_cards')
        .update({ estimated_value: estimatedValue })
        .eq('id', cardId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      const cards = get().cards.map((card) =>
        card.id === cardId ? { ...card, estimated_value: estimatedValue } : card
      );
      set({ cards });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update estimated value',
      });
    }
  },

  updateTotalCost: async (cardId: number, totalCost: number) => {
    try {
      const { error } = await supabaseCards
        .from('graded_cards')
        .update({ total_cost: totalCost })
        .eq('id', cardId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      const cards = get().cards.map((card) =>
        card.id === cardId ? { ...card, total_cost: totalCost } : card
      );
      set({ cards });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update total cost',
      });
    }
  },

  updateCardField: async (cardId: number, field: EditableField, value: string | number | null) => {
    try {
      const { error } = await supabaseCards
        .from('graded_cards')
        .update({ [field]: value })
        .eq('id', cardId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state
      const cards = get().cards.map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card
      );
      set({ cards });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update card field',
      });
    }
  },

  addCard: async (card) => {
    try {
      const { data, error } = await supabaseCards
        .from('graded_cards')
        .insert([card])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Add to local state
      const cards = [...get().cards, data].sort((a, b) =>
        a.player_name.localeCompare(b.player_name)
      );
      set({ cards });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to add card',
      });
      throw err;
    }
  },
}));
