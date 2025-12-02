'use client';

/**
 * Add Card Modal
 * Allows manually adding a new graded card
 */

import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (card: NewCardData) => Promise<void>;
}

export interface NewCardData {
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
}

export default function AddCardModal({ isOpen, onClose, onAdd }: AddCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<NewCardData>({
    card_year: new Date().getFullYear(),
    brand: '',
    card_number: '',
    player_name: '',
    attributes: null,
    grade: '',
    cost: null,
    grading_cost: null,
    total_cost: null,
    estimated_value: null,
  });

  if (!isOpen) return null;

  const handleChange = (field: keyof NewCardData, value: string) => {
    setFormData((prev) => {
      if (field === 'card_year') {
        return { ...prev, [field]: parseInt(value) || new Date().getFullYear() };
      }
      if (['cost', 'grading_cost', 'total_cost', 'estimated_value'].includes(field)) {
        const numVal = parseFloat(value);
        return { ...prev, [field]: isNaN(numVal) ? null : numVal };
      }
      if (field === 'attributes') {
        return { ...prev, [field]: value.trim() || null };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.brand || !formData.player_name || !formData.grade) {
      return;
    }

    setLoading(true);
    try {
      await onAdd(formData);
      // Reset form
      setFormData({
        card_year: new Date().getFullYear(),
        brand: '',
        card_number: '',
        player_name: '',
        attributes: null,
        grade: '',
        cost: null,
        grading_cost: null,
        total_cost: null,
        estimated_value: null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-gray-700 rounded-lg w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Add New Card</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Row 1: Year, Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Year *</label>
              <input
                type="number"
                value={formData.card_year}
                onChange={(e) => handleChange('card_year', e.target.value)}
                className="w-full px-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Brand *</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                placeholder="e.g., Topps Chrome"
                className="w-full px-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Row 2: Card Number, Player Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Card #</label>
              <input
                type="text"
                value={formData.card_number}
                onChange={(e) => handleChange('card_number', e.target.value)}
                placeholder="e.g., 50"
                className="w-full px-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Player Name *</label>
              <input
                type="text"
                value={formData.player_name}
                onChange={(e) => handleChange('player_name', e.target.value)}
                placeholder="e.g., Aaron Judge"
                className="w-full px-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Row 3: Attributes, Grade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Attributes/Parallel</label>
              <input
                type="text"
                value={formData.attributes || ''}
                onChange={(e) => handleChange('attributes', e.target.value)}
                placeholder="e.g., Raywave, Rookie"
                className="w-full px-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Grade *</label>
              <input
                type="text"
                value={formData.grade}
                onChange={(e) => handleChange('grade', e.target.value)}
                placeholder="e.g., PSA 10"
                className="w-full px-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-500 mb-3">Cost Information (optional)</p>
          </div>

          {/* Row 4: Cost, Grading Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Purchase Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost ?? ''}
                  onChange={(e) => handleChange('cost', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Grading Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.grading_cost ?? ''}
                  onChange={(e) => handleChange('grading_cost', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Total Cost, Estimated Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Total Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_cost ?? ''}
                  onChange={(e) => handleChange('total_cost', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Estimated Value</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.estimated_value ?? ''}
                  onChange={(e) => handleChange('estimated_value', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-[#2f2f2f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.brand || !formData.player_name || !formData.grade}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {loading ? 'Adding...' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
