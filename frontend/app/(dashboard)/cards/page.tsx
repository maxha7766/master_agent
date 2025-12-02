'use client';

/**
 * Graded Cards Page
 * Displays the user's graded card collection
 */

import { useEffect, useState } from 'react';
import { Award, TrendingUp, Hash, DollarSign, Plus } from 'lucide-react';
import { useGradedCardsStore } from '../../../store/gradedCards';
import GradedCardTable from '../../../components/cards/GradedCardTable';
import AddCardModal, { type NewCardData } from '../../../components/cards/AddCardModal';
import { formatCurrency } from '../../../types/gradedCards';
import type { GradedCard } from '../../../types/gradedCards';

export default function CardsPage() {
  const { cards, loading, error, fetchCards, addCard } = useGradedCardsStore();
  const [selectedCard, setSelectedCard] = useState<GradedCard | null>(null);
  const [addCardModalOpen, setAddCardModalOpen] = useState(false);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleAddCard = async (cardData: NewCardData) => {
    await addCard(cardData);
  };

  // Calculate stats
  const totalCost = cards.reduce((sum, card) => sum + (card.total_cost || 0), 0);
  const totalEstimatedValue = cards.reduce((sum, card) => sum + (card.estimated_value || 0), 0);
  const totalGainLoss = totalEstimatedValue - totalCost;
  const gem10Count = cards.filter((c) => c.grade.includes('10')).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="border-b border-gray-700 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-400" />
              Graded Cards
            </h1>
            <p className="text-gray-400 mt-1">
              Your graded card collection
            </p>
          </div>

          {/* Stats and Add Button */}
          <div className="flex gap-4 flex-wrap items-center">
            <button
              onClick={() => setAddCardModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors h-fit"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
            <div className="bg-[#2f2f2f] rounded-lg px-4 py-2 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <Hash className="w-3 h-3" />
                <span>Total Cards</span>
              </div>
              <div className="text-xl font-bold text-white">{cards.length}</div>
            </div>
            <div className="bg-[#2f2f2f] rounded-lg px-4 py-2 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <DollarSign className="w-3 h-3" />
                <span>Total Cost</span>
              </div>
              <div className="text-xl font-bold text-gray-400">{formatCurrency(totalCost)}</div>
            </div>
            <div className="bg-[#2f2f2f] rounded-lg px-4 py-2 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <TrendingUp className="w-3 h-3" />
                <span>Total Est. Value</span>
              </div>
              <div className="text-xl font-bold text-green-400">{formatCurrency(totalEstimatedValue)}</div>
            </div>
            <div className="bg-[#2f2f2f] rounded-lg px-4 py-2 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <TrendingUp className="w-3 h-3" />
                <span>Total Gain/Loss</span>
              </div>
              <div className={`text-xl font-bold ${totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)}
              </div>
            </div>
            <div className="bg-[#2f2f2f] rounded-lg px-4 py-2 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <Award className="w-3 h-3" />
                <span>Gem Mint 10s</span>
              </div>
              <div className="text-xl font-bold text-blue-400">{gem10Count}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        <GradedCardTable cards={cards} onSelect={setSelectedCard} />

        {/* Card Detail Modal (simple) */}
        {selectedCard && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCard(null)}
          >
            <div
              className="bg-[#2f2f2f] border border-gray-700 rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4">
                {selectedCard.player_name}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Year</span>
                  <span className="text-white">{selectedCard.card_year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Brand</span>
                  <span className="text-white">{selectedCard.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Card Number</span>
                  <span className="text-white">{selectedCard.card_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Grade</span>
                  <span className="text-white font-bold">{selectedCard.grade}</span>
                </div>
                {selectedCard.attributes && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Attributes</span>
                    <span className="text-white text-right">{selectedCard.attributes}</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Purchase Cost</span>
                    <span className="text-white">{formatCurrency(selectedCard.cost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Grading Cost</span>
                    <span className="text-white">{formatCurrency(selectedCard.grading_cost)}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2">
                    <span className="text-gray-300">Total Cost</span>
                    <span className="text-gray-400">{formatCurrency(selectedCard.total_cost)}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2">
                    <span className="text-gray-300">Est. Value</span>
                    <span className="text-green-400">{formatCurrency(selectedCard.estimated_value)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={addCardModalOpen}
        onClose={() => setAddCardModalOpen(false)}
        onAdd={handleAddCard}
      />
    </div>
  );
}
