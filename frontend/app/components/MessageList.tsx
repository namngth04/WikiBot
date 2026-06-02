'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, AlertCircle, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { ChatMessage } from '@/app/types/chat';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
  showSources?: boolean;
  onRetryMessage?: (content: string) => void;
  onRateMessage?: (messageId: number, rating: number) => void;
  onSetFeedback?: (messageIndex: number, type: 'up' | 'down') => void;
  onShowSource?: (docId: number, pageNum: number) => void;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  ratingMessageId?: number | null;
}

export default function MessageList({
  messages,
  loading = false,
  showSources = true,
  onRetryMessage,
  onRateMessage,
  onSetFeedback,
  onShowSource,
  messagesEndRef,
  ratingMessageId
}: MessageListProps) {
  if (messages.length === 0 && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 bg-brand-lavender/10 text-brand-lavender rounded-3xl flex items-center justify-center mb-6 animate-bounce shadow-soft border border-brand-lavender/20">
          <MessageSquare size={32} />
        </div>
        <h3 className="text-2xl font-be-vietnam font-bold text-ink mb-2">Chào mừng đến WikiBot!</h3>
        <p className="text-ink-subtle max-w-md mb-8 text-sm">
          Tôi là trợ lý thông minh của bạn. Hãy đặt câu hỏi về quy trình, tài liệu hoặc bất cứ điều gì bạn cần hỗ trợ.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
          {[
            'Quy định nghỉ phép năm nay?',
            'Làm thế nào để đổi mật khẩu?',
            'Quy trình tạm ứng lương?',
            'Liên hệ hỗ trợ kỹ thuật?'
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => {
                // This will be handled by parent component
                const event = new CustomEvent('suggestedQuestion', { detail: q });
                window.dispatchEvent(event);
              }}
              className="p-4 bg-surface-2 border border-hairline rounded-2xl text-left text-sm text-ink-muted hover:border-hairline-strong hover:bg-surface-3 hover:text-ink transition-all group active:scale-[0.98]"
            >
              <span className="font-medium">{q}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => (
          <MessageItem
            key={msg.id || index}
            message={msg}
            index={index}
            showSources={showSources}
            onRetryMessage={onRetryMessage}
            onRateMessage={onRateMessage}
            onSetFeedback={onSetFeedback}
            onShowSource={onShowSource}
            ratingMessageId={ratingMessageId}
          />
        ))}
      </AnimatePresence>
      
      <div ref={messagesEndRef} />
    </div>
  );
}
