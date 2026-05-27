'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/app/lib/api';
import { FAQ, SuggestedFAQ } from '@/app/lib/types';
import { 
  Plus, Search, Edit2, Trash2, CheckCircle, XCircle, Sparkles, MessageSquare, Save, X,
  ArrowRight, Filter, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/app/components/ui/ModalPortal';

export default function FAQManagementPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [suggested, setSuggested] = useState<SuggestedFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '',
    is_active: true
  });

  useEffect(() => {
    fetchFAQs();
    fetchSuggested();
  }, []);

  const fetchFAQs = async () => {
    try {
      const res = await adminAPI.listFAQs(search);
      setFaqs(res.data);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggested = async () => {
    try {
      const res = await adminAPI.getSuggestedFAQs();
      setSuggested(res.data);
    } catch (error) {
      console.error('Error fetching suggested FAQs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await adminAPI.updateFAQ(editingFaq.id, formData);
      } else {
        await adminAPI.createFAQ(formData);
      }
      setShowModal(false);
      setEditingFaq(null);
      setFormData({ question: '', answer: '', category: '', is_active: true });
      fetchFAQs();
    } catch (error) {
      alert('Lỗi khi lưu FAQ');
    }
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '',
      is_active: faq.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa FAQ này?')) {
      try {
        await adminAPI.deleteFAQ(id);
        fetchFAQs();
      } catch (error) {
        alert('Lỗi khi xóa FAQ');
      }
    }
  };

  const handleGenerateDraft = async (question: string) => {
    setIsDrafting(true);
    setFormData(prev => ({ ...prev, question }));
    setShowModal(true);
    try {
      const res = await adminAPI.generateDraft(question);
      setFormData(prev => ({ ...prev, answer: res.data.suggested_answer }));
    } catch (error) {
      alert('Lỗi khi AI soạn thảo');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-1 p-6 rounded-[2rem] border border-hairline shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 dark:bg-primary-950/30 p-3 rounded-2xl text-primary-600">
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="text-xl font-be-vietnam font-bold text-ink">Thư viện FAQ</h2>
            <p className="text-xs text-ink-subtle font-medium">Quản lý câu hỏi thường gặp và tri thức chuẩn</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingFaq(null);
            setFormData({ question: '', answer: '', category: '', is_active: true });
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} />
          Thêm FAQ mới
        </button>
      </div>

      {/* Suggested from AI - Bento Style */}
      {suggested.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-1 border border-hairline rounded-[2rem] p-8 text-ink relative overflow-hidden group shadow-sm"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-be-vietnam font-bold mb-4 flex items-center gap-2 text-ink">
              <Sparkles className="text-brand-lavender" size={20} />
              Câu hỏi đang "Trending"
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggested.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGenerateDraft(s.question)}
                  className="flex items-center justify-between p-4 bg-surface-2 hover:bg-surface-3 border border-hairline rounded-2xl transition-all group/item text-ink"
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-ink line-clamp-1">{s.question}</p>
                    <p className="text-[10px] text-ink-subtle uppercase font-bold mt-1">{s.occurrence} lượt tra cứu</p>
                  </div>
                  <ArrowRight size={16} className="text-brand-lavender opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-5 text-ink">
            <Sparkles size={120} />
          </div>
        </motion.div>
      )}

      {/* Search & List */}
      <div className="bg-surface-1 rounded-[2rem] shadow-sm border border-hairline overflow-hidden">
        <div className="p-6 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFAQs()}
              className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary py-3">
              <Filter size={18} />
              Bộ lọc
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Nội dung câu hỏi</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Danh mục</th>
                <th className="px-8 py-4 text-center text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Lượt xem</th>
                <th className="px-8 py-4 text-center text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Trạng thái</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : faqs.map((faq) => (
                <tr key={faq.id} className="group hover:bg-surface-2/50 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-bold text-ink text-sm line-clamp-1 mb-1">{faq.question}</p>
                    <p className="text-xs text-ink-subtle line-clamp-1">{faq.answer}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 border border-primary-200/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {faq.category || 'Chung'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-sm font-be-vietnam font-bold text-ink">{faq.hits}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">
                      {faq.is_active ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/20 px-3 py-1 rounded-full text-[10px] font-bold">
                          <CheckCircle size={12} /> Hoạt động
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-ink-subtle bg-surface-2 border border-hairline px-3 py-1 rounded-full text-[10px] font-bold">
                          <XCircle size={12} /> Tạm ngưng
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(faq)} className="p-2 text-ink-subtle hover:text-primary-600 hover:bg-surface-2 dark:hover:bg-surface-3 rounded-xl shadow-sm transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(faq.id)} className="p-2 text-ink-subtle hover:text-rose-600 hover:bg-rose-950/20 rounded-xl shadow-sm transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Slide-over Modal */}
      <ModalPortal>
        <AnimatePresence>
          {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="modal-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-content"
            >
              <div className="p-6 border-b border-hairline flex items-center justify-between shrink-0 bg-surface-1 rounded-t-3xl">
                <div>
                  <h3 className="text-2xl font-be-vietnam font-bold text-ink">
                    {editingFaq ? 'Cập nhật FAQ' : 'Thêm FAQ mới'}
                  </h3>
                  <p className="text-sm text-ink-subtle font-medium">Cung cấp tri thức chuẩn cho hệ thống</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-surface-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Câu hỏi</label>
                  <textarea
                    required
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none min-h-[100px]"
                    placeholder="VD: Làm thế nào để đăng ký nghỉ phép?"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Câu trả lời chuẩn</label>
                    {isDrafting && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary-600 animate-pulse">
                        <Sparkles size={12} /> AI ĐANG SOẠN THẢO...
                      </span>
                    )}
                  </div>
                  <textarea
                    required
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none min-h-[200px]"
                    placeholder="Nhập nội dung câu trả lời chính xác nhất..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Danh mục</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                      placeholder="VD: Nhân sự"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Trạng thái</label>
                    <select
                      value={formData.is_active ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                      className="w-full px-5 py-4 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none appearance-none cursor-pointer"
                    >
                      <option value="true">Hoạt động</option>
                      <option value="false">Tạm ngưng</option>
                    </select>
                  </div>
                </div>
              </form>

              <div className="p-4 border-t border-hairline flex items-center gap-3 shrink-0 bg-surface-1 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 justify-center py-4"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSubmit}
                  className="btn-primary flex-1 justify-center py-4 shadow-lg shadow-primary-200/30"
                >
                  <Save size={20} />
                  {editingFaq ? 'Cập nhật' : 'Lưu FAQ'}
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
