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
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

export default function MessageList({
  messages,
  loading = false,
  showSources = true,
  onRetryMessage,
  onRateMessage,
  onSetFeedback,
  messagesEndRef
}: MessageListProps) {
  if (messages.length === 0 && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce shadow-soft">
          <MessageSquare size={32} />
        </div>
        <h3 className="text-2xl font-be-vietnam font-bold text-slate-900 mb-2">Chào mừng đến WikiBot!</h3>
        <p className="text-slate-500 max-w-md mb-8">
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
              className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left text-sm text-slate-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-all group"
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
          />
        ))}
      </AnimatePresence>
      
      {/* Loading indicator */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3"
        >
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <MessageSquare size={16} className="text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
