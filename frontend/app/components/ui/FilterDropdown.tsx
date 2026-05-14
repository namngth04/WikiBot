'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterSection {
  title: string;
  type: 'checkbox' | 'radio' | 'date' | 'select';
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  key: string;
}

export interface SortOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  sections: FilterSection[];
  sortOptions?: SortOption[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  onClearAll?: () => void;
  className?: string;
}

export default function FilterDropdown({
  sections,
  sortOptions,
  sortBy,
  sortOrder,
  onSortChange,
  onClearAll,
  className = ''
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters = sections.some(section => section.selected.length > 0);

  const handleSortChange = (value: string) => {
    if (onSortChange) {
      if (sortBy === value) {
        // Toggle sort order if same field
        onSortChange(value, sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        // New field, default to asc
        onSortChange(value, 'asc');
      }
    }
  };

  const renderFilterContent = (section: FilterSection) => {
    switch (section.type) {
      case 'checkbox':
        return (
          <div className="space-y-2">
            {section.options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={section.selected.includes(option.value)}
                  onChange={(e) => {
                    const newSelected = e.target.checked
                      ? [...section.selected, option.value]
                      : section.selected.filter(v => v !== option.value);
                    section.onChange(newSelected);
                  }}
                  className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700 flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {option.count}
                  </span>
                )}
              </label>
            ))}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {section.options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input
                  type="radio"
                  name={section.key}
                  checked={section.selected.includes(option.value)}
                  onChange={() => section.onChange([option.value])}
                  className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700 flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {option.count}
                  </span>
                )}
              </label>
            ))}
          </div>
        );

      case 'select':
        return (
          <select
            value={section.selected[0] || ''}
            onChange={(e) => section.onChange(e.target.value ? [e.target.value] : [])}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/10 outline-none"
          >
            <option value="">Tất cả</option>
            {section.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.count !== undefined && ` (${option.count})`}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-500 font-medium">Từ ngày</label>
              <input
                type="date"
                value={section.selected[0] || ''}
                onChange={(e) => {
                  const newSelected = [...section.selected];
                  newSelected[0] = e.target.value;
                  section.onChange(newSelected);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/10 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Đến ngày</label>
              <input
                type="date"
                value={section.selected[1] || ''}
                onChange={(e) => {
                  const newSelected = [...section.selected];
                  newSelected[1] = e.target.value;
                  section.onChange(newSelected);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/10 outline-none"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap min-w-max
          ${hasActiveFilters 
            ? 'bg-primary-50 border-primary-200 text-primary-700' 
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }
        `}
      >
        <Filter size={16} />
        <span className="text-sm font-medium">
          {hasActiveFilters ? `Đã lọc (${sections.filter(s => s.selected.length > 0).length})` : 'Lọc dữ liệu'}
        </span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900">Bộ lọc</h3>
                <div className="flex items-center gap-2">
                  {onClearAll && hasActiveFilters && (
                    <button
                      onClick={onClearAll}
                      className="text-xs text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={16} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Filter Sections */}
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.key} className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-700">{section.title}</h4>
                    {renderFilterContent(section)}
                  </div>
                ))}
              </div>

              {/* Sort Options */}
              {sortOptions && sortOptions.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">Sắp xếp</h4>
                  <div className="space-y-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={`
                          w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                          ${sortBy === option.value
                            ? 'bg-primary-50 text-primary-700 border border-primary-200'
                            : 'hover:bg-slate-50 text-slate-600'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {sortBy === option.value && (
                            <span className="text-xs text-primary-600">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
