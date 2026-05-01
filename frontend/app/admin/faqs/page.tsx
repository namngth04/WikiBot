'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/app/lib/api';
import { FAQ, SuggestedFAQ } from '@/app/lib/types';
import { 
  Plus, Search, Edit2, Trash2, CheckCircle, XCircle, Sparkles, MessageSquare, Save, X, RefreshCw
} from 'lucide-react';

export default function FAQManagementPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [suggested, setSuggested] = useState<SuggestedFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      const res = await adminAPI.listFAQs(search, 0, 100);
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

  const handleRefreshSuggestions = async () => {
    setIsRefreshing(true);
    try {
      await adminAPI.refreshSuggestedFAQs();
      await fetchSuggested();
    } catch (error) {
      alert('Lỗi khi làm mới gợi ý');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="text-blue-600" />
          Quản lý FAQ
        </h2>
        <button
          onClick={() => {
            setEditingFaq(null);
            setFormData({ question: '', answer: '', category: '', is_active: true });
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Thêm FAQ mới
        </button>
      </div>

      {/* Suggested from AI */}
      {suggested.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-blue-800 font-bold flex items-center gap-2">
              <Sparkles size={18} />
              Câu hỏi gợi ý từ người dùng (Trending)
            </h3>
            <button
              onClick={handleRefreshSuggestions}
              disabled={isRefreshing}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Làm mới
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {suggested.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleGenerateDraft(s.question)}
                className="bg-white px-3 py-1.5 rounded-full border border-blue-200 text-sm text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-2"
              >
                <span>{s.question}</span>
                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{s.occurrence} lượt</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm câu hỏi hoặc câu trả lời..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFAQs()}
              className="w-full pl-10 pr-24 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchFAQs}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Tìm
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Câu hỏi</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Danh mục</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Lượt xem</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {faqs.map((faq) => (
                <tr key={faq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800 line-clamp-1">{faq.question}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{faq.answer}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{faq.category || 'Chung'}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600 font-medium">
                    {faq.hits}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      {faq.is_active ? (
                        <CheckCircle className="text-green-500" size={18} />
                      ) : (
                        <XCircle className="text-gray-300" size={18} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(faq)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(faq.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">
                {editingFaq ? 'Cập nhật FAQ' : 'Thêm FAQ mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Câu hỏi</label>
                <textarea
                  required
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Câu trả lời chuẩn</label>
                  {isDrafting && (
                    <span className="text-xs text-blue-600 animate-pulse flex items-center gap-1">
                      <Sparkles size={12} /> AI đang soạn thảo...
                    </span>
                  )}
                </div>
                <textarea
                  required
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={6}
                  placeholder="Viết câu trả lời chuẩn xác nhất..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Nhân sự, Quy định..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Hoạt động</option>
                    <option value="false">Tạm ngưng</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                >
                  <Save size={20} />
                  Lưu FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
