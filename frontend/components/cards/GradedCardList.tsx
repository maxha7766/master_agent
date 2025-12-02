'use client';

/**
 * Graded Card List Component
 * Displays a list of graded trading cards
 */

import { Card } from '../ui/card';
import { Award, Calendar, Tag, DollarSign } from 'lucide-react';
import type { GradedCard } from '../../types/gradedCards';
import { getGradeBadgeColor, formatCurrency } from '../../types/gradedCards';

interface GradedCardListProps {
  cards: GradedCard[];
  onSelect?: (card: GradedCard) => void;
}

export default function GradedCardList({ cards, onSelect }: GradedCardListProps) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">No graded cards</h3>
        <p className="text-gray-400">Your graded card collection will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card
          key={card.id}
          className="p-4 bg-[#1a1a1a] border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
          onClick={() => onSelect?.(card)}
        >
          <div className="flex flex-col gap-3">
            {/* Header: Player Name & Grade Badge */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-white font-semibold text-lg leading-tight">
                {card.player_name}
              </h3>
              <span
                className={`px-2 py-1 rounded text-xs font-bold border whitespace-nowrap ${getGradeBadgeColor(
                  card.grade
                )}`}
              >
                {card.grade}
              </span>
            </div>

            {/* Card Details */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{card.card_year} {card.brand}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Tag className="w-4 h-4 flex-shrink-0" />
                <span>#{card.card_number}</span>
              </div>
              {card.attributes && (
                <div className="text-sm text-gray-500 italic pl-6">
                  {card.attributes}
                </div>
              )}
            </div>

            {/* Cost Info */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <DollarSign className="w-4 h-4" />
                <span>Total Cost</span>
              </div>
              <span className="text-white font-medium">
                {formatCurrency(card.total_cost)}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
