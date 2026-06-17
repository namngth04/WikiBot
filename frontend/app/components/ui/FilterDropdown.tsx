'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
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
        onSortChange(value, sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
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
              <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-surface-2 p-1.5 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={section.selected.includes(option.value)}
                  onChange={(e) => {
                    const newSelected = e.target.checked
                      ? [...section.selected, option.value]
                      : section.selected.filter(v => v !== option.value);
                    section.onChange(newSelected);
                  }}
                  className="w-4 h-4 text-brand-lavender border-hairline rounded focus:ring-brand-lavender/25 bg-surface-2 accent-brand-lavender"
                />
                <span className="text-sm text-ink-muted flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-ink-subtle bg-surface-3 px-2 py-0.5 rounded-md">
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
              <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-surface-2 p-1.5 rounded-lg transition-colors">
                <input
                  type="radio"
                  name={section.key}
                  checked={section.selected.includes(option.value)}
                  onChange={() => section.onChange([option.value])}
                  className="w-4 h-4 text-brand-lavender border-hairline focus:ring-brand-lavender/25 bg-surface-2 accent-brand-lavender"
                />
                <span className="text-sm text-ink-muted flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-ink-subtle bg-surface-3 px-2 py-0.5 rounded-md">
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
            className="w-full px-3 py-2 bg-surface-2 border border-hairline text-ink rounded-lg text-sm focus:ring-2 focus:ring-brand-lavender/10 outline-none cursor-pointer"
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
              <label className="text-xs text-ink-subtle font-medium">Từ ngày</label>
              <input
                type="date"
                value={section.selected[0] || ''}
                onChange={(e) => {
                  const newSelected = [...section.selected];
                  newSelected[0] = e.target.value;
                  section.onChange(newSelected);
                }}
                className="w-full px-3 py-2 bg-surface-2 border border-hairline text-ink rounded-lg text-sm focus:ring-2 focus:ring-brand-lavender/10 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-ink-subtle font-medium">Đến ngày</label>
              <input
                type="date"
                value={section.selected[1] || ''}
                onChange={(e) => {
                  const newSelected = [...section.selected];
                  newSelected[1] = e.target.value;
                  section.onChange(newSelected);
                }}
                className="w-full px-3 py-2 bg-surface-2 border border-hairline text-ink rounded-lg text-sm focus:ring-2 focus:ring-brand-lavender/10 outline-none"
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
          flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap min-w-max text-xs font-semibold
          ${hasActiveFilters 
            ? 'bg-brand-lavender/10 border-brand-lavender/30 text-brand-lavender' 
            : 'bg-surface-2 border-hairline text-ink-muted hover:bg-surface-3 hover:text-ink'
          }
        `}
      >
        <Filter size={14} />
        <span>
          {hasActiveFilters ? `Đã lọc (${sections.filter(s => s.selected.length > 0).length})` : 'Lọc dữ liệu'}
        </span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-80 bg-surface-1 rounded-2xl border border-hairline shadow-xl z-50 max-h-[300px] overflow-y-auto"
          >
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <h3 className="font-semibold text-ink text-sm">Bộ lọc</h3>
                <div className="flex items-center gap-2">
                  {onClearAll && hasActiveFilters && (
                    <button
                      onClick={onClearAll}
                      className="text-xs text-ink-subtle hover:text-rose-400 transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-ink-subtle hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Filter Sections */}
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.key} className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">{section.title}</h4>
                    {renderFilterContent(section)}
                  </div>
                ))}
              </div>

              {/* Sort Options */}
              {sortOptions && sortOptions.length > 0 && (
                <div className="border-t border-hairline pt-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Sắp xếp</h4>
                  <div className="space-y-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={`
                          w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors
                          ${sortBy === option.value
                            ? 'bg-brand-lavender/10 text-brand-lavender border border-brand-lavender/25'
                            : 'hover:bg-surface-2 text-ink-muted'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {sortBy === option.value && (
                            <span className="text-xs text-brand-lavender font-bold">
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
