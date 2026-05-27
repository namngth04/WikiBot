'use client';

import { motion } from 'framer-motion';
import { 
  AlertCircle, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown,
  CheckCircle2,
  XCircle,
  Info,
  TrendingUp,
  Search,
  Brain
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { ChatMessage } from '@/app/types/chat';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  showSources?: boolean;
  onRetryMessage?: (content: string) => void;
  onRateMessage?: (messageId: number, rating: number) => void;
  onSetFeedback?: (messageIndex: number, type: 'up' | 'down') => void;
  ratingMessageId?: number | null;
}

export default function MessageItem({
  message,
  index,
  showSources = true,
  onRetryMessage,
  onRateMessage,
  onSetFeedback,
  ratingMessageId
}: MessageItemProps) {
  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-semantic-success bg-semantic-success/10 border border-semantic-success/20';
      case 'medium':
        return 'text-semantic-warning bg-semantic-warning/10 border border-semantic-warning/20';
      case 'low':
        return 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
      case 'very_low':
        return 'text-red-400 bg-red-500/10 border border-red-500/20';
      default:
        return 'text-ink-subtle bg-surface-2 border border-hairline';
    }
  };

  const getConfidenceIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <CheckCircle2 size={14} />;
      case 'medium':
        return <Info size={14} />;
      case 'low':
        return <AlertCircle size={14} />;
      case 'very_low':
        return <XCircle size={14} />;
      default:
        return <Info size={14} />;
    }
  };

  const getConfidenceLabel = (level: string) => {
    switch (level) {
      case 'high':
        return 'Độ tin cậy cao';
      case 'medium':
        return 'Độ tin cậy trung bình';
      case 'low':
        return 'Độ tin cậy thấp';
      case 'very_low':
        return 'Độ tin cậy rất thấp';
      default:
        return 'Độ tin cậy không xác định';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex flex-col w-full",
        message.role === 'user' ? "items-end" : "items-start"
      )}
    >
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] p-4 shadow-soft transition-all relative rounded-2xl",
        message.role === 'user' 
          ? "bg-brand-lavender text-white rounded-tr-none border border-brand-lavender/30 shadow-md shadow-brand-lavender/10" 
          : cn(
              "bg-surface-1 border border-hairline text-ink rounded-tl-none",
              message.status === 'failed' && "border-red-900 bg-red-950/20 text-red-200"
            )
      )}>
        {/* Status indicator for sending messages */}
        {message.status === 'sending' && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-semantic-warning rounded-full animate-pulse"></div>
          </div>
        )}
        
        {/* Status indicator for failed messages */}
        {message.status === 'failed' && (
          <div className="absolute top-2 right-2">
            <AlertCircle size={16} className="text-red-400" />
          </div>
        )}
        
        {/* Message content */}
        <div className={cn(
          "text-sm md:text-base leading-relaxed",
          message.role === 'user' ? "whitespace-pre-wrap font-medium text-white" : "text-ink-muted"
        )}>
          {message.role === 'user' ? (
            message.content
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
        
        {/* Error message for failed messages */}
        {message.status === 'failed' && message.error && (
          <div className="mt-2 text-xs text-red-400 bg-red-950/40 border border-red-900/30 px-2.5 py-1.5 rounded-lg">
            Lỗi: {message.error}
          </div>
        )}
        
        {/* Query processing info */}
        {message.queryProcessing && (message.queryProcessing.was_corrected || message.queryProcessing.was_expanded) && (
          <div className="mt-3 pt-3 border-t border-hairline">
            <div className="flex items-center gap-1 text-xs text-ink-subtle mb-2">
              <Brain size={12} className="text-brand-lavender" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Xử lý câu hỏi</span>
            </div>
            {message.queryProcessing.was_corrected && (
              <div className="text-xs text-ink-muted mb-1">
                <span className="font-medium text-ink-subtle">Sửa lỗi:</span> "{message.queryProcessing.original}" → <span className="text-brand-lavender">"{message.queryProcessing.corrected}"</span>
              </div>
            )}
            {message.queryProcessing.was_expanded && (
              <div className="text-xs text-ink-muted">
                <span className="font-medium text-ink-subtle">Mở rộng:</span> {message.queryProcessing.expanded}
              </div>
            )}
          </div>
        )}
        
        {/* Retrieval stats */}
        {message.retrievalStats && (
          <div className="mt-3 pt-3 border-t border-hairline">
            <div className="flex items-center gap-1 text-xs text-ink-subtle mb-2">
              <Search size={12} className="text-brand-lavender" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Thống kê tìm kiếm</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
              <div>Vector: <span className="text-ink font-semibold">{message.retrievalStats.vector_results}</span> kết quả</div>
              <div>Keyword: <span className="text-ink font-semibold">{message.retrievalStats.keyword_results}</span> kết quả</div>
              <div>Trùng lặp: <span className="text-ink font-semibold">{message.retrievalStats.overlap_percentage.toFixed(1)}%</span></div>
              <div>Tổng cộng: <span className="text-ink font-semibold">{message.retrievalStats.total_unique}</span> kết quả</div>
            </div>
          </div>
        )}
        
        {/* Confidence score */}
        {message.confidence && (
          <div className="mt-3 pt-3 border-t border-hairline">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-xs text-ink-subtle">
                <TrendingUp size={12} className="text-brand-lavender" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Độ tin cậy</span>
              </div>
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                getConfidenceColor(message.confidence.level)
              )}>
                {getConfidenceIcon(message.confidence.level)}
                <span>{getConfidenceLabel(message.confidence.level)}</span>
                <span>({Math.round(message.confidence.overall * 100)}%)</span>
              </div>
            </div>
            
            {/* Confidence breakdown */}
            <div className="space-y-1 text-xs text-ink-muted">
              <div className="flex justify-between">
                <span className="text-ink-subtle">Độ phủ nguồn:</span>
                <span className="font-semibold text-ink">{Math.round((message.confidence.source_coverage || 0) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-subtle">Tương đồng ngữ nghĩa:</span>
                <span className="font-semibold text-ink">{Math.round((message.confidence.semantic_similarity || 0) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-subtle">Độ hoàn chỉnh:</span>
                <span className="font-semibold text-ink">{Math.round((message.confidence.answer_completeness || 0) * 100)}%</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && showSources && (
          <div className="mt-4 pt-4 border-t border-hairline">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-2">Nguồn trích dẫn:</p>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((cite, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-1.5 text-[11px] bg-surface-2 text-ink-muted px-2.5 py-1.5 rounded-lg border border-hairline hover:bg-surface-3 transition-colors"
                >
                  <span className="font-bold text-brand-lavender">[{i+1}]</span> 
                  <span>{cite.source}</span>
                  {cite.is_public_community && (
                    <span 
                      className="text-[9px] font-bold uppercase bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20 px-1 rounded shrink-0" 
                      title="Nguồn từ cộng đồng, cần xác minh thêm"
                    >
                      Cộng đồng
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Questions */}
      {message.role === 'assistant' && message.suggested_questions && message.suggested_questions.length > 0 && (
        <div className="flex flex-col gap-2 mt-3 ml-2 max-w-[85%] md:max-w-[75%]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1.5">
            <Brain size={12} className="text-brand-lavender animate-pulse" /> Câu hỏi gợi ý tiếp theo:
          </p>
          <div className="flex flex-col gap-1.5">
            {message.suggested_questions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  const event = new CustomEvent('suggestedQuestion', { detail: q });
                  window.dispatchEvent(event);
                }}
                className="text-left text-xs bg-surface-2 hover:bg-surface-3 text-ink-muted hover:text-ink font-medium px-3.5 py-2.5 rounded-xl border border-hairline hover:border-hairline-strong transition-all duration-200 active:scale-[0.99] shadow-soft"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Action buttons for assistant messages */}
      {message.role === 'assistant' && (
        <div className="flex items-center gap-1.5 mt-1.5 ml-2">
          {/* Retry button for failed messages */}
          {message.status === 'failed' && message.retryable && onRetryMessage && (
            <button 
              onClick={() => onRetryMessage(message.content)}
              className="p-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-900/30 transition-colors"
              title="Thử lại"
            >
              <RefreshCw size={13} />
            </button>
          )}
          
          {/* Rating buttons */}
          {onRateMessage && (
            <>
              <button 
                onClick={() => onRateMessage(Number(message.id), message.rating === 1 ? 0 : 1)}
                disabled={ratingMessageId === Number(message.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  message.rating === 1 
                    ? "bg-brand-lavender/10 text-brand-lavender border-brand-lavender/30" 
                    : "text-ink-subtle border-transparent hover:text-brand-lavender hover:bg-surface-2",
                  ratingMessageId === Number(message.id) && "opacity-50 cursor-not-allowed animate-pulse"
                )}
                title="Hữu ích"
              >
                <ThumbsUp size={13} />
              </button>
              <button 
                onClick={() => onRateMessage(Number(message.id), message.rating === -1 ? 0 : -1)}
                disabled={ratingMessageId === Number(message.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  message.rating === -1 
                    ? "bg-red-950/40 text-red-400 border-red-900/30" 
                    : "text-ink-subtle border-transparent hover:text-red-400 hover:bg-surface-2",
                  ratingMessageId === Number(message.id) && "opacity-50 cursor-not-allowed animate-pulse"
                )}
                title="Không hữu ích"
              >
                <ThumbsDown size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
