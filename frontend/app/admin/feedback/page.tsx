'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/app/lib/api';
import { 
  MessageSquare, AlertTriangle, ChevronRight, Calendar, Sparkles, Plus, 
  Search, Database, BookOpen, User, Clock, ArrowRight, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/app/components/ui/ModalPortal';

interface FeedbackLog {
  message_id: number;
  conversation_id: number;
  username: string;
  user_question: string;
  assistant_answer: string;
  feedback_text: string;
  feedback_category?: string;
  created_at: string;
  used_chunks: Array<{
    chunk_id: number;
    document_id: number;
    source: string;
    content: string;
    page_number?: number;
  }>;
}

export default function FeedbackManagementPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  // FAQ Form State
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'Sửa đổi tri thức',
    is_active: true
  });

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.listFeedback();
      setFeedbacks(res.data);
    } catch (error) {
      console.error('Error fetching feedback logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (log: FeedbackLog) => {
    setSelectedFeedback(log);
    setShowDetailModal(true);
  };

  const handleConvertToFAQ = async (log: FeedbackLog) => {
    setFaqForm({
      question: log.user_question,
      answer: 'Đang tải gợi ý từ AI...',
      category: 'Sửa đổi tri thức',
      is_active: true
    });
    setShowFAQModal(true);
    setIsDrafting(true);

    try {
      const res = await adminAPI.generateDraft(log.user_question);
      setFaqForm(prev => ({
        ...prev,
        answer: res.data.suggested_answer || 'AI không trích xuất được câu trả lời phù hợp, vui lòng tự biên soạn.'
      }));
    } catch (error) {
      console.error('Error drafting FAQ:', error);
      setFaqForm(prev => ({
        ...prev,
        answer: 'Không thể tự động soạn thảo. Vui lòng tự nhập câu trả lời chuẩn xác dựa trên tri thức tài liệu bên dưới.'
      }));
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSaveFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createFAQ(faqForm);
      alert('Tạo FAQ thành công từ đóng góp phản hồi!');
      setShowFAQModal(false);
      // Close detail too
      setShowDetailModal(false);
      setSelectedFeedback(null);
    } catch (error) {
      alert('Lỗi khi tạo FAQ');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 pb-10 font-be-vietnam">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-1 p-6 rounded-[2rem] border border-hairline shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-rose-500/10 dark:bg-rose-950/20 p-3 rounded-2xl text-rose-500 border border-rose-500/20">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-be-vietnam font-bold text-ink">Nhật ký Phản hồi lỗi</h2>
            <p className="text-xs text-ink-subtle font-medium">Xem các câu trả lời bị người dùng đánh giá Dislike và lý do lỗi</p>
          </div>
        </div>
        <button
          onClick={fetchFeedbacks}
          className="btn-secondary py-3 px-5 text-xs font-bold"
        >
          Làm mới danh sách
        </button>
      </div>

      {/* Main List */}
      <div className="bg-surface-1 rounded-[2rem] shadow-sm border border-hairline overflow-hidden">
        <div className="p-6 border-b border-hairline">
          <h3 className="text-sm font-bold text-ink-subtle uppercase tracking-wider flex items-center gap-2">
            <MessageSquare size={16} /> Danh sách phản hồi không hài lòng ({feedbacks.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Người dùng</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Câu hỏi & Lỗi</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Phân loại</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-rose-400 uppercase tracking-widest">Chi tiết góp ý</th>
                <th className="px-8 py-4 text-center text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Thời gian</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-ink-muted text-sm font-medium">
                    Không có phản hồi tiêu cực nào từ người dùng. Hệ thống đang hoạt động tuyệt vời! 🎉
                  </td>
                </tr>
              ) : feedbacks.map((log) => (
                <tr key={log.message_id} className="group hover:bg-surface-2/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold font-be-vietnam shrink-0">
                        {log.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-ink">{log.username}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 max-w-sm">
                    <p className="font-bold text-ink text-sm line-clamp-1 mb-1">{log.user_question}</p>
                    <p className="text-xs text-ink-subtle line-clamp-1 italic">"{log.assistant_answer}"</p>
                  </td>
                  <td className="px-8 py-5 max-w-[180px]">
                    {log.feedback_category ? (
                      <span className="text-xs font-semibold text-brand-lavender">
                        {log.feedback_category}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-subtle italic">Chưa phân loại</span>
                    )}
                  </td>
                  <td className="px-8 py-5 max-w-xs">
                    <p className="text-xs text-ink-muted line-clamp-2">
                      {log.feedback_text || "Không mô tả lý do"}
                    </p>
                  </td>
                  <td className="px-8 py-5 text-center text-xs text-ink-subtle font-medium">
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock size={12} />
                      {formatDate(log.created_at)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenDetail(log)} 
                        className="flex items-center gap-1 text-xs font-bold text-brand-lavender bg-brand-lavender/10 border border-brand-lavender/20 hover:bg-brand-lavender hover:text-white px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
                      >
                        Chi tiết
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-over Feedback Detail Modal (Glassmorphism & Framer Motion) */}
      <ModalPortal>
        <AnimatePresence>
          {showDetailModal && selectedFeedback && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedFeedback(null);
                }}
                className="modal-backdrop"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="modal-content max-w-2xl"
              >
                <div className="p-6 border-b border-hairline flex items-center justify-between bg-surface-1 rounded-t-3xl shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-rose-500" size={20} />
                    <h3 className="text-xl font-be-vietnam font-bold text-ink">Chi tiết phản hồi lỗi</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedFeedback(null);
                    }} 
                    className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar bg-surface-1">
                  {/* General Info */}
                  <div className="grid grid-cols-2 gap-4 bg-surface-2 p-4 rounded-2xl border border-hairline text-xs">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-ink-subtle" />
                      <span className="font-bold text-ink">Người dùng: {selectedFeedback.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-ink-subtle" />
                      <span className="font-bold text-ink">Thời gian: {formatDate(selectedFeedback.created_at)}</span>
                    </div>
                  </div>

                  {/* Question & Answer Flow */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">Câu hỏi của người dùng</label>
                      <div className="bg-surface-2 border border-hairline rounded-2xl p-4 text-sm font-semibold text-ink">
                        {selectedFeedback.user_question}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">Trợ lý trả lời (AI Answer)</label>
                      <div className="bg-surface-2 border border-hairline rounded-2xl p-4 text-xs leading-relaxed text-ink-muted bg-rose-500/[0.02]">
                        {selectedFeedback.assistant_answer}
                      </div>
                    </div>

                    {/* Góp ý Tối giản */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                        <span className="text-xs font-bold text-ink-subtle">Phân loại lỗi</span>
                        <span className="text-xs font-bold text-brand-lavender">
                          {selectedFeedback.feedback_category || "Chưa phân loại"}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-ink-subtle block">Chi tiết góp ý</span>
                        <div className="bg-surface-2 border border-hairline rounded-2xl p-4 text-xs leading-relaxed text-ink whitespace-pre-wrap">
                          {selectedFeedback.feedback_text || "Không có nội dung mô tả chi tiết lỗi từ người dùng."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Knowledge Source Used Chunks */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider flex items-center gap-1.5">
                      <Database size={12} /> Nguồn tri thức hệ thống đã dùng ({selectedFeedback.used_chunks.length})
                    </label>

                    <div className="space-y-3">
                      {selectedFeedback.used_chunks.length === 0 ? (
                        <div className="text-xs text-ink-subtle italic bg-surface-2 p-4 rounded-2xl text-center">
                          Không tìm thấy chunks tri thức nào đã được trích dẫn (Có thể AI trả lời bằng kiến thức nền hoặc bị lỗi trích xuất).
                        </div>
                      ) : (
                        selectedFeedback.used_chunks.map((chunk) => (
                          <div 
                            key={chunk.chunk_id}
                            className="bg-surface-2/60 hover:bg-surface-2 border border-hairline rounded-2xl p-4 space-y-2.5 transition-all text-xs"
                          >
                            <div className="flex items-center justify-between border-b border-hairline pb-2">
                              <span className="font-bold text-brand-lavender flex items-center gap-1">
                                <BookOpen size={12} /> {chunk.source}
                              </span>
                              {chunk.page_number && (
                                <span className="bg-surface-3 text-[10px] px-2 py-0.5 rounded font-bold text-ink-subtle">
                                  Trang {chunk.page_number}
                                </span>
                              )}
                            </div>
                            <p className="leading-relaxed text-ink-muted whitespace-pre-wrap italic">
                              "{chunk.content}"
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-hairline flex items-center gap-3 bg-surface-1 rounded-b-3xl shrink-0">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedFeedback(null);
                    }}
                    className="btn-secondary flex-1 justify-center py-4 text-xs font-bold"
                  >
                    Đóng lại
                  </button>
                  <button
                    onClick={() => handleConvertToFAQ(selectedFeedback)}
                    className="btn-primary flex-1 justify-center py-4 shadow-lg shadow-brand-lavender/25 text-xs font-bold"
                  >
                    <Sparkles size={16} />
                    Chuyển thành FAQ
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Convert to FAQ Editor Modal */}
      <ModalPortal>
        <AnimatePresence>
          {showFAQModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFAQModal(false)}
                className="modal-backdrop z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="modal-content max-w-xl z-[70]"
              >
                <div className="p-6 border-b border-hairline flex items-center justify-between bg-surface-1 rounded-t-3xl shrink-0">
                  <div>
                    <h3 className="text-xl font-be-vietnam font-bold text-ink flex items-center gap-2">
                      <Sparkles size={18} className="text-brand-lavender animate-pulse" />
                      Soạn thảo FAQ sửa đổi tri thức
                    </h3>
                    <p className="text-xs text-ink-subtle">Lưu tri thức chuẩn hóa để làm tài liệu huấn luyện bổ sung</p>
                  </div>
                  <button 
                    onClick={() => setShowFAQModal(false)} 
                    className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveFAQ} className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar bg-surface-1">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Câu hỏi</label>
                    <textarea
                      required
                      value={faqForm.question}
                      onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-2xl text-xs font-semibold focus:ring-1 focus:ring-brand-lavender/30 transition-all outline-none min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Câu trả lời chuẩn</label>
                      {isDrafting && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-brand-lavender animate-pulse">
                          <Sparkles size={12} /> AI ĐANG SOẠN THẢO...
                        </span>
                      )}
                    </div>
                    <textarea
                      required
                      value={faqForm.answer}
                      onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-2xl text-xs leading-relaxed focus:ring-1 focus:ring-brand-lavender/30 transition-all outline-none min-h-[160px] custom-scrollbar"
                      placeholder="Nội dung câu trả lời chuẩn xác..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Danh mục</label>
                      <input
                        type="text"
                        value={faqForm.category}
                        onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                        className="w-full px-4 py-3.5 bg-surface-2 border border-hairline text-ink rounded-xl text-xs font-semibold focus:ring-1 focus:ring-brand-lavender/30 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Trạng thái</label>
                      <select
                        value={faqForm.is_active ? 'true' : 'false'}
                        onChange={(e) => setFaqForm({ ...faqForm, is_active: e.target.value === 'true' })}
                        className="w-full px-4 py-3.5 bg-surface-2 border border-hairline text-ink rounded-xl text-xs font-semibold focus:ring-1 focus:ring-brand-lavender/30 transition-all outline-none cursor-pointer"
                      >
                        <option value="true">Kích hoạt ngay</option>
                        <option value="false">Tạm ẩn</option>
                      </select>
                    </div>
                  </div>
                </form>

                <div className="p-4 border-t border-hairline flex items-center gap-3 bg-surface-1 rounded-b-3xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFAQModal(false)}
                    className="btn-secondary flex-1 justify-center py-4 text-xs font-bold"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleSaveFAQ}
                    className="btn-primary flex-1 justify-center py-4 shadow-lg shadow-brand-lavender/25 text-xs font-bold"
                  >
                    <Save size={16} />
                    Lưu FAQ tri thức
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </ModalPortal>
    </div>
  );
}
