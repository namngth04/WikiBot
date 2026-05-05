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

interface MessageItemProps {
  message: ChatMessage;
  index: number;
  showSources?: boolean;
  onRetryMessage?: (content: string) => void;
  onRateMessage?: (messageId: number, rating: number) => void;
  onSetFeedback?: (messageIndex: number, type: 'up' | 'down') => void;
}

export default function MessageItem({
  message,
  index,
  showSources = true,
  onRetryMessage,
  onRateMessage,
  onSetFeedback
}: MessageItemProps) {
  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-amber-600 bg-amber-100';
      case 'low':
        return 'text-orange-600 bg-orange-100';
      case 'very_low':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-slate-600 bg-slate-100';
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
        "flex flex-col",
        message.role === 'user' ? "items-end" : "items-start"
      )}
    >
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] p-4 shadow-soft transition-all relative",
        message.role === 'user' 
          ? "bg-primary-600 text-white rounded-2xl rounded-tr-none" 
          : cn(
              "bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-tl-none",
              message.status === 'failed' && "border-rose-200 bg-rose-50"
            )
      )}>
        {/* Status indicator for sending messages */}
        {message.status === 'sending' && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
          </div>
        )}
        
        {/* Status indicator for failed messages */}
        {message.status === 'failed' && (
          <div className="absolute top-2 right-2">
            <AlertCircle size={16} className="text-rose-500" />
          </div>
        )}
        
        {/* Message content */}
        <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        
        {/* Error message for failed messages */}
        {message.status === 'failed' && message.error && (
          <div className="mt-2 text-xs text-rose-600 bg-rose-100 px-2 py-1 rounded">
            Lỗi: {message.error}
          </div>
        )}
        
        {/* Query processing info */}
        {message.queryProcessing && (message.queryProcessing.was_corrected || message.queryProcessing.was_expanded) && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
              <Brain size={12} />
              <span className="font-medium">Xử lý câu hỏi</span>
            </div>
            {message.queryProcessing.was_corrected && (
              <div className="text-xs text-slate-600 mb-1">
                <span className="font-medium">Sửa lỗi:</span> "{message.queryProcessing.original}" → "{message.queryProcessing.corrected}"
              </div>
            )}
            {message.queryProcessing.was_expanded && (
              <div className="text-xs text-slate-600">
                <span className="font-medium">Mở rộng:</span> {message.queryProcessing.expanded}
              </div>
            )}
          </div>
        )}
        
        {/* Retrieval stats */}
        {message.retrievalStats && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
              <Search size={12} />
              <span className="font-medium">Thống kê tìm kiếm</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>Vector: {message.retrievalStats.vector_results} kết quả</div>
              <div>Keyword: {message.retrievalStats.keyword_results} kết quả</div>
              <div>Trùng lặp: {message.retrievalStats.overlap_percentage.toFixed(1)}%</div>
              <div>Tổng cộng: {message.retrievalStats.total_unique} kết quả</div>
            </div>
          </div>
        )}
        
        {/* Confidence score */}
        {message.confidence && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <TrendingUp size={12} />
                <span className="font-medium">Độ tin cậy</span>
              </div>
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                getConfidenceColor(message.confidence.level)
              )}>
                {getConfidenceIcon(message.confidence.level)}
                <span>{getConfidenceLabel(message.confidence.level)}</span>
                <span>({Math.round(message.confidence.overall * 100)}%)</span>
              </div>
            </div>
            
            {/* Confidence breakdown */}
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Độ phủ nguồn:</span>
                <span>{Math.round((message.confidence.source_coverage || 0) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Tương đồng ngữ nghĩa:</span>
                <span>{Math.round((message.confidence.semantic_similarity || 0) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Độ hoàn chỉnh:</span>
                <span>{Math.round((message.confidence.answer_completeness || 0) * 100)}%</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && showSources && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Nguồn trích dẫn:</p>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((cite, i) => (
                <div key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="font-bold">[{i+1}]</span> {cite.source}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Action buttons for assistant messages */}
      {message.role === 'assistant' && (
        <div className="flex items-center gap-1 mt-1">
          {/* Retry button for failed messages */}
          {message.status === 'failed' && message.retryable && onRetryMessage && (
            <button 
              onClick={() => onRetryMessage(message.content)}
              className="p-1.5 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
              title="Thử lại"
            >
              <RefreshCw size={14} />
            </button>
          )}
          
          {/* Feedback buttons */}
          {onSetFeedback && (
            <>
              <button 
                onClick={() => onSetFeedback(index, 'up')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  message.feedback === 'up' ? "bg-primary-100 text-primary-600" : "text-slate-400 hover:text-primary-600 hover:bg-slate-100"
                )}
                title="Hữu ích"
              >
                <ThumbsUp size={14} />
              </button>
              <button 
                onClick={() => onSetFeedback(index, 'down')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  message.feedback === 'down' ? "bg-rose-100 text-rose-600" : "text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                )}
                title="Không hữu ích"
              >
                <ThumbsDown size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
