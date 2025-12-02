'use client';

/**
 * Search Results Modal
 * Displays card pricing results from eBay sold listings
 * Allows selecting cards to calculate estimated value
 */

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import type { SearchResultCard } from '../../types/gradedCards';
import { getGradeBadgeColor, getConfidenceBadgeColor } from '../../types/gradedCards';

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchDescription: string;
  results: SearchResultCard[];
  loading: boolean;
  error?: string | null;
  onUpdateValue?: (averagePrice: number) => void;
}

// Parse price string to number
function parsePriceToNumber(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export default function SearchResultsModal({
  isOpen,
  onClose,
  searchDescription,
  results,
  loading,
  error,
  onUpdateValue,
}: SearchResultsModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Reset selections when results change
  useEffect(() => {
    setSelectedIndices(new Set());
  }, [results]);

  if (!isOpen) return null;

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const toggleAll = () => {
    if (selectedIndices.size === results.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(results.map((_, i) => i)));
    }
  };

  const calculateAverage = (): number => {
    if (selectedIndices.size === 0) return 0;
    const selectedPrices = Array.from(selectedIndices).map(i =>
      parsePriceToNumber(results[i].price)
    );
    const sum = selectedPrices.reduce((acc, price) => acc + price, 0);
    return sum / selectedPrices.length;
  };

  const handleUpdateValue = () => {
    const avg = calculateAverage();
    if (avg > 0 && onUpdateValue) {
      onUpdateValue(avg);
      onClose();
    }
  };

  const averagePrice = calculateAverage();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-gray-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">Search Results</h2>
            <p className="text-sm text-gray-400 mt-1">{searchDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        {!loading && !error && results.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-[#252525] border-b border-gray-700">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {selectedIndices.size} of {results.length} selected
              </span>
              {selectedIndices.size > 0 && (
                <span className="text-sm text-green-400 font-medium">
                  Average: ${averagePrice.toFixed(2)}
                </span>
              )}
            </div>
            <button
              onClick={handleUpdateValue}
              disabled={selectedIndices.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              Update Value
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-gray-400">Searching eBay sold listings...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 text-red-400 p-4 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No sold listings found on eBay
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 bg-[#2f2f2f]">
                    <th className="text-center px-3 py-3 text-gray-300 font-semibold text-sm w-12">
                      <input
                        type="checkbox"
                        checked={selectedIndices.size === results.length && results.length > 0}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </th>
                    <th className="text-center px-3 py-3 text-gray-300 font-semibold text-sm w-16">Match</th>
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold text-sm">Title</th>
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold text-sm">Grade</th>
                    <th className="text-right px-4 py-3 text-gray-300 font-semibold text-sm">Price</th>
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold text-sm">Date</th>
                    <th className="text-center px-4 py-3 text-gray-300 font-semibold text-sm">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((card, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer ${
                        selectedIndices.has(index) ? 'bg-blue-900/20' : ''
                      }`}
                      onClick={() => toggleSelection(index)}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIndices.has(index)}
                          onChange={() => toggleSelection(index)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {card.confidence !== undefined ? (
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold border ${getConfidenceBadgeColor(
                              card.confidence
                            )}`}
                          >
                            {card.confidence}%
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white max-w-[300px]">
                        <span className="line-clamp-2">{card.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold border ${getGradeBadgeColor(
                            card.grade
                          )}`}
                        >
                          {card.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium">
                        {card.price}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {card.date || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {card.url && (
                          <a
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4 inline" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            Source: eBay Sold Listings
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
