/**
 * Graded Cards Types
 */

export interface GradedCard {
  id: number;
  card_year: number;
  brand: string;
  card_number: string;
  player_name: string;
  attributes: string | null;
  grade: string;
  cost: number | null;
  grading_cost: number | null;
  total_cost: number | null;
  estimated_value: number | null;
  created_at: string;
}

export type GradeLevel = 'gem' | 'mint' | 'near_mint' | 'other';

export function getGradeLevel(grade: string): GradeLevel {
  const normalized = grade.toUpperCase().trim();
  if (normalized.includes('10')) return 'gem';
  if (normalized.includes('9')) return 'mint';
  if (normalized.includes('8')) return 'near_mint';
  return 'other';
}

export function getGradeColor(grade: string): string {
  const level = getGradeLevel(grade);
  switch (level) {
    case 'gem':
      return 'text-green-400';
    case 'mint':
      return 'text-blue-400';
    case 'near_mint':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

export function getGradeBadgeColor(grade: string): string {
  const level = getGradeLevel(grade);
  switch (level) {
    case 'gem':
      return 'bg-red-900/30 text-red-400 border-red-700';
    case 'mint':
      return 'bg-blue-900/30 text-blue-400 border-blue-700';
    case 'near_mint':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
    default:
      return 'bg-gray-700 text-gray-400 border-gray-600';
  }
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

// Match details for LLM confidence scoring
export interface MatchDetails {
  year: boolean;
  brand: boolean;
  cardNumber: boolean;
  player: boolean;
  attributes: boolean;
  grade: boolean;
}

// Search result types for eBay sold listings
export interface SearchResultCard {
  title: string;
  price: string;
  grade: string;
  status: string;
  url?: string;
  date?: string;
  confidence?: number; // 0-100 match score from LLM
  matchDetails?: MatchDetails; // Field-by-field match info
}

// Helper to get confidence badge color
export function getConfidenceBadgeColor(confidence: number | undefined): string {
  if (!confidence) return 'bg-gray-700 text-gray-400 border-gray-600';
  if (confidence >= 95) return 'bg-green-900/30 text-green-400 border-green-700';
  if (confidence >= 90) return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
  return 'bg-red-900/30 text-red-400 border-red-700';
}

export interface CardSearchResult {
  searchDescription: string;
  cards: SearchResultCard[];
  searchedAt: string;
  sourceUrl?: string;
}

// Generate search description from card data
export function generateSearchDescription(card: GradedCard): string {
  const parts = [
    card.card_year.toString(),
    card.brand,
    card.card_number,
    card.player_name,
    card.attributes || '',
    card.grade,
  ];
  return parts.filter(Boolean).join(' ');
}
