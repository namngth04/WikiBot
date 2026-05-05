'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/app/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
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
    <div className="p-4 md:p-6 bg-white border-t border-slate-100">
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
                "w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm resize-none",
                isFocused && "bg-white border-primary-300",
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
              <div className="absolute bottom-2 right-2 text-xs text-slate-400">
                {value.length}
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={!value.trim() || loading || disabled}
            className={cn(
              "p-3 rounded-xl transition-all active:scale-90 shrink-0",
              value.trim() && !loading && !disabled
                ? "bg-primary-600 text-white shadow-lg shadow-primary-200"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
            title={value.trim() ? "Gửi tin nhắn" : "Nhập câu hỏi trước"}
          >
            <Send size={20} className={cn(loading && "animate-pulse")} />
          </button>
        </form>
        
        {/* Help text */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-center text-slate-400 font-medium">
            WikiBot có thể cung cấp thông tin không chính xác. Hãy kiểm tra các nguồn trích dẫn quan trọng.
          </p>
          
          {/* Keyboard shortcut hint */}
          <p className="text-[10px] text-slate-400">
            Enter để gửi, Shift+Enter để xuống dòng
          </p>
        </div>
      </div>
    </div>
  );
}
