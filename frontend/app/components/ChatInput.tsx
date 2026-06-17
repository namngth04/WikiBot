'use client';

import { useState } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@/app/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop?: () => void;
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  loading = false,
  placeholder = "Nhập câu hỏi của bạn...",
  disabled = false
}: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-canvas border-t border-hairline">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={onSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || loading}
              rows={1}
              className={cn(
                "w-full px-5 py-3 bg-surface-2 border border-hairline rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-lavender/10 focus:border-brand-lavender transition-all text-sm resize-none text-ink placeholder-ink-subtle",
                isFocused && "bg-surface-3 border-brand-lavender",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={{
                minHeight: '48px',
                maxHeight: '120px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            
            {/* Character count for long messages */}
            {value.length > 100 && (
              <div className="absolute bottom-2 right-2 text-xs text-ink-subtle">
                {value.length}
              </div>
            )}
          </div>
          
          {loading ? (
            <button
              type="button"
              onClick={onStop}
              className="p-3 rounded-xl transition-all active:scale-[0.93] shrink-0 border bg-surface-2 text-ink border-ink-subtle hover:bg-surface-3 shadow-sm"
              title="Dừng tạo câu trả lời"
            >
              <Square size={20} className="fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim() || disabled}
              className={cn(
                "p-3 rounded-xl transition-all active:scale-[0.93] shrink-0 border",
                value.trim() && !disabled
                  ? "bg-brand-lavender text-ink border-brand-lavender/30 hover:bg-brand-lavender/90 shadow-lg shadow-brand-lavender/10"
                  : "bg-surface-2 text-ink-tertiary border-hairline cursor-not-allowed"
              )}
              title={value.trim() ? "Gửi tin nhắn" : "Nhập câu hỏi trước"}
            >
              <Send size={20} />
            </button>
          )}
        </form>
        
        {/* Help text */}
        <div className="mt-3 flex items-center justify-end">
          {/* Keyboard shortcut hint */}
          <p className="text-[10px] text-ink-tertiary">
            Enter để gửi, Shift+Enter để xuống dòng
          </p>
        </div>
      </div>
    </div>
  );
}
