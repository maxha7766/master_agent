'use client';

/**
 * Graded Card Table Component
 * Displays graded cards in a searchable, sortable table format
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Award, Search, ChevronUp, ChevronDown, Loader2, Pencil } from 'lucide-react';
import type { GradedCard } from '../../types/gradedCards';
import { getGradeBadgeColor, formatCurrency, generateSearchDescription } from '../../types/gradedCards';
import type { SearchResultCard } from '../../types/gradedCards';
import SearchResultsModal from './SearchResultsModal';
import { useGradedCardsStore, type EditableField } from '../../store/gradedCards';

interface GradedCardTableProps {
  cards: GradedCard[];
  onSelect?: (card: GradedCard) => void;
}

type SortKey = 'card_year' | 'brand' | 'card_number' | 'player_name' | 'attributes' | 'grade' | 'total_cost' | 'estimated_value' | 'gain_loss';
type SortDirection = 'asc' | 'desc';

// Default column widths
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  search: 80,
  card_year: 70,
  brand: 150,
  card_number: 60,
  player_name: 150,
  attributes: 180,
  grade: 80,
  total_cost: 120,
  estimated_value: 130,
  gain_loss: 120,
};

// Helper to calculate gain/loss
function calculateGainLoss(card: GradedCard): number | null {
  if (card.estimated_value === null || card.total_cost === null) return null;
  return card.estimated_value - card.total_cost;
}

export default function GradedCardTable({ cards, onSelect }: GradedCardTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('player_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Price search state
  const [searchingCardId, setSearchingCardId] = useState<number | null>(null);
  const [currentSearchCardId, setCurrentSearchCardId] = useState<number | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchDescription, setSearchDescription] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Manual edit state
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  const { updateEstimatedValue, updateTotalCost, updateCardField } = useGradedCardsStore();

  // Column resize handlers
  const handleResizeStart = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[column];
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, resizeStartWidth.current + diff);
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCardId !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCardId, editingField]);

  // Handle price search for a card
  const handlePriceSearch = async (card: GradedCard, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click

    const description = generateSearchDescription(card);
    setSearchDescription(description);
    setSearchingCardId(card.id);
    setCurrentSearchCardId(card.id);
    setSearchModalOpen(true);
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch('/api/search-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchDescription: description,
          cardData: {
            card_year: card.card_year,
            brand: card.brand,
            card_number: card.card_number,
            player_name: card.player_name,
            attributes: card.attributes,
            grade: card.grade,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.cards || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchLoading(false);
      setSearchingCardId(null);
    }
  };

  const closeSearchModal = () => {
    setSearchModalOpen(false);
    setSearchResults([]);
    setSearchError(null);
    setCurrentSearchCardId(null);
  };

  const handleUpdateValue = async (averagePrice: number) => {
    if (currentSearchCardId) {
      await updateEstimatedValue(currentSearchCardId, averagePrice);
    }
  };

  // Handle manual edit
  const handleStartEdit = (card: GradedCard, field: EditableField, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCardId(card.id);
    setEditingField(field);
    const value = card[field];
    setEditValue(value?.toString() || '');
  };

  const handleSaveEdit = async (cardId: number) => {
    if (!editingField) return;

    // For numeric fields (total_cost, estimated_value, card_year)
    if (editingField === 'estimated_value' || editingField === 'total_cost') {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue) && numValue >= 0) {
        if (editingField === 'estimated_value') {
          await updateEstimatedValue(cardId, numValue);
        } else {
          await updateTotalCost(cardId, numValue);
        }
      }
    } else if (editingField === 'card_year') {
      const numValue = parseInt(editValue);
      if (!isNaN(numValue) && numValue > 1900 && numValue <= new Date().getFullYear() + 1) {
        await updateCardField(cardId, editingField, numValue);
      }
    } else {
      // For string fields (brand, card_number, player_name, attributes, grade)
      const trimmedValue = editValue.trim();
      // attributes can be null/empty, others require a value
      if (editingField === 'attributes') {
        await updateCardField(cardId, editingField, trimmedValue || null);
      } else if (trimmedValue) {
        await updateCardField(cardId, editingField, trimmedValue);
      }
    }

    setEditingCardId(null);
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditingField(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, cardId: number) => {
    if (e.key === 'Enter') {
      handleSaveEdit(cardId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Handle column header click
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter and sort cards
  const filteredAndSortedCards = useMemo(() => {
    // First filter
    let result = cards.filter((card) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        card.player_name.toLowerCase().includes(query) ||
        card.brand.toLowerCase().includes(query) ||
        card.card_number.toLowerCase().includes(query) ||
        card.card_year.toString().includes(query) ||
        card.grade.toLowerCase().includes(query) ||
        (card.attributes && card.attributes.toLowerCase().includes(query))
      );
    });

    // Then sort
    result.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortKey) {
        case 'card_year':
          aVal = a.card_year;
          bVal = b.card_year;
          break;
        case 'brand':
          aVal = a.brand.toLowerCase();
          bVal = b.brand.toLowerCase();
          break;
        case 'card_number':
          aVal = a.card_number.toLowerCase();
          bVal = b.card_number.toLowerCase();
          break;
        case 'player_name':
          aVal = a.player_name.toLowerCase();
          bVal = b.player_name.toLowerCase();
          break;
        case 'attributes':
          aVal = (a.attributes || '').toLowerCase();
          bVal = (b.attributes || '').toLowerCase();
          break;
        case 'grade':
          aVal = a.grade.toLowerCase();
          bVal = b.grade.toLowerCase();
          break;
        case 'total_cost':
          aVal = a.total_cost ?? 0;
          bVal = b.total_cost ?? 0;
          break;
        case 'estimated_value':
          aVal = a.estimated_value ?? 0;
          bVal = b.estimated_value ?? 0;
          break;
        case 'gain_loss':
          aVal = calculateGainLoss(a) ?? 0;
          bVal = calculateGainLoss(b) ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cards, searchQuery, sortKey, sortDirection]);

  // Sort indicator component
  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <span className="ml-1 text-gray-600">⇅</span>;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="inline w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="inline w-4 h-4 ml-1" />
    );
  };

  // Resizable column header component
  const ResizableHeader = ({
    column,
    sortable = true,
    sortKey: columnSortKey,
    align = 'left',
    children,
  }: {
    column: string;
    sortable?: boolean;
    sortKey?: SortKey;
    align?: 'left' | 'right' | 'center';
    children: React.ReactNode;
  }) => (
    <th
      style={{ width: columnWidths[column], minWidth: 50 }}
      className={`relative text-${align} px-4 py-3 text-gray-300 font-semibold text-sm ${
        sortable ? 'cursor-pointer hover:text-white' : ''
      } select-none`}
      onClick={sortable && columnSortKey ? () => handleSort(columnSortKey) : undefined}
    >
      {children}
      {sortable && columnSortKey && <SortIndicator columnKey={columnSortKey} />}
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 group"
        onMouseDown={(e) => handleResizeStart(column, e)}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-600 group-hover:bg-blue-500" />
      </div>
    </th>
  );

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
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="text-sm text-gray-400">
          Showing {filteredAndSortedCards.length} of {cards.length} cards
        </div>
      )}

      {/* Table */}
      <div className={`overflow-x-auto ${resizingColumn ? 'select-none' : ''}`}>
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b border-gray-700 bg-[#2f2f2f]">
              <ResizableHeader column="search" sortable={false} align="center">
                Search
              </ResizableHeader>
              <ResizableHeader column="card_year" sortKey="card_year">
                Year
              </ResizableHeader>
              <ResizableHeader column="brand" sortKey="brand">
                Brand
              </ResizableHeader>
              <ResizableHeader column="card_number" sortKey="card_number">
                #
              </ResizableHeader>
              <ResizableHeader column="player_name" sortKey="player_name">
                Player
              </ResizableHeader>
              <ResizableHeader column="attributes" sortKey="attributes">
                Attributes
              </ResizableHeader>
              <ResizableHeader column="grade" sortKey="grade">
                Grade
              </ResizableHeader>
              <ResizableHeader column="total_cost" sortKey="total_cost" align="right">
                Total Cost
              </ResizableHeader>
              <ResizableHeader column="estimated_value" sortKey="estimated_value" align="right">
                Est. Value
              </ResizableHeader>
              <ResizableHeader column="gain_loss" sortKey="gain_loss" align="right">
                Gain/Loss
              </ResizableHeader>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedCards.map((card) => (
              <tr
                key={card.id}
                onClick={() => onSelect?.(card)}
                className="border-b border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer"
              >
                <td className="px-3 py-3 text-center">
                  <button
                    onClick={(e) => handlePriceSearch(card, e)}
                    disabled={searchingCardId === card.id}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-medium rounded transition-colors"
                  >
                    {searchingCardId === card.id ? (
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    ) : (
                      'Search'
                    )}
                  </button>
                </td>
                {/* Year - editable */}
                <td className="px-4 py-3">
                  {editingCardId === card.id && editingField === 'card_year' ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-16 px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="text-white">{card.card_year}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'card_year', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit year"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                {/* Brand - editable */}
                <td className="px-4 py-3">
                  {editingCardId === card.id && editingField === 'brand' ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-full px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="text-white">{card.brand}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'brand', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit brand"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                {/* Card Number - editable */}
                <td className="px-4 py-3">
                  {editingCardId === card.id && editingField === 'card_number' ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-12 px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="text-gray-400">{card.card_number}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'card_number', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit card number"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                {/* Player Name - editable */}
                <td className="px-4 py-3">
                  {editingCardId === card.id && editingField === 'player_name' ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-full px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span className="text-white font-medium">{card.player_name}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'player_name', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit player name"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                {/* Attributes - editable */}
                <td className="px-4 py-3">
                  {editingCardId === card.id && editingField === 'attributes' ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-full px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-sm focus:outline-none"
                        placeholder="Optional"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group max-w-[200px]">
                      <span className="text-gray-400 text-sm truncate">{card.attributes || '-'}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'attributes', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                        title="Edit attributes"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                {/* Grade - editable */}
                <td className="px-4 py-3">
                  {editingCardId === card.id && editingField === 'grade' ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-20 px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-sm focus:outline-none"
                        placeholder="e.g., PSA 10"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold border ${getGradeBadgeColor(
                          card.grade
                        )}`}
                      >
                        {card.grade}
                      </span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'grade', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit grade"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingCardId === card.id && editingField === 'total_cost' ? (
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-gray-400">$</span>
                      <input
                        ref={editInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-24 px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-right text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-400 font-medium">{formatCurrency(card.total_cost)}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'total_cost', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                        title="Edit total cost"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingCardId === card.id && editingField === 'estimated_value' ? (
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-gray-400">$</span>
                      <input
                        ref={editInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, card.id)}
                        onBlur={() => handleSaveEdit(card.id)}
                        className="w-24 px-2 py-1 bg-[#2f2f2f] border border-blue-500 rounded text-white text-right text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-green-400 font-medium">{formatCurrency(card.estimated_value)}</span>
                      <button
                        onClick={(e) => handleStartEdit(card, 'estimated_value', e)}
                        className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                        title="Edit estimated value"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {(() => {
                    const gainLoss = calculateGainLoss(card);
                    if (gainLoss === null) return <span className="text-gray-500">-</span>;
                    const isPositive = gainLoss >= 0;
                    return (
                      <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                        {isPositive ? '+' : ''}{formatCurrency(gainLoss)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* No results message */}
      {filteredAndSortedCards.length === 0 && searchQuery && (
        <div className="text-center py-8 text-gray-400">
          No cards match "{searchQuery}"
        </div>
      )}

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={searchModalOpen}
        onClose={closeSearchModal}
        searchDescription={searchDescription}
        results={searchResults}
        loading={searchLoading}
        error={searchError}
        onUpdateValue={handleUpdateValue}
      />
    </div>
  );
}
