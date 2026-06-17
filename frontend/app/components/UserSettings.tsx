'use client';

import { useState, useEffect } from 'react';
import { usersAPI, documentsAPI, API_BASE_URL } from '@/app/lib/api';
import { userAIAPI, chatModelsAPI } from '@/app/lib/ai-config-api';
import ModelFormModal from '@/components/admin/ModelFormModal';

import {
  ArrowLeft, User, Mail, Phone, Lock, Save, 
  ShieldCheck, AlertCircle, Camera, CheckCircle2,
  Sparkles, Settings, Eye, FileText, Trash2, UploadCloud, RefreshCw, Globe,
  CreditCard, ThumbsDown, ThumbsUp, Edit2, Check, X, Loader2, Cpu, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function UserSettings({ 
  onBack, 
  user, 
  activeTab: externalActiveTab, 
  isUnifiedView = false 
}: { 
  onBack?: () => void; 
  user: any; 
  activeTab?: 'profile' | 'ai' | 'documents' | 'pricing' | 'feedback' | 'models'; 
  isUnifiedView?: boolean 
}) {
  const [loading, setLoading] = useState(false);
  const isStaff = user?.user_type === 'employee' && user?.role?.level >= 2;
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'documents' | 'pricing' | 'feedback' | 'models'>('profile');


  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    new_password: '',
    confirm_password: '',
  });

  // AI Settings State
  const [aiSettings, setAiSettings] = useState({
    temperature: 0.2,
    response_style: 'concise',
    show_sources: true,
    preferred_max_tokens: 512,
    receive_community_knowledge: false,
    ollama_endpoint: 'http://localhost:11434',
  });

  // Personal Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quota, setQuota] = useState<any>(null);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editDocName, setEditDocName] = useState('');

  // Pricing & Upgrade States
  const [showQRModal, setShowQRModal] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'success' | 'error'>('none');
  const [upgradeError, setUpgradeError] = useState('');

  // Feedback State
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [fetchingFeedbacks, setFetchingFeedbacks] = useState(false);

  // AI Models State
  const [systemModels, setSystemModels] = useState<any[]>([]);
  const [personalModels, setPersonalModels] = useState<any[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [modelTestResults, setModelTestResults] = useState<Record<number, { success: boolean; message: string; latency?: number }>>({});
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);

  const handleUpdateDocName = async (docId: number) => {
    if (!editDocName.trim()) return;
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await documentsAPI.updateDocument(docId, { original_name: editDocName.trim() });
      setSuccess('Đổi tên tài liệu thành công!');
      setEditingDocId(null);
      setEditDocName('');
      fetchDocuments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Đổi tên tài liệu thất bại');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeRequest = async () => {
    setRequestLoading(true);
    setUpgradeError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/upgrade/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setRequestStatus('success');
        setTimeout(() => {
          setShowQRModal(false);
          setRequestStatus('none');
          fetchQuota();
          // Reload page context or update local tier if needed, or notify user
          setSuccess('Tài khoản của bạn đã được nâng cấp lên PRO thành công!');
          setTimeout(() => setSuccess(null), 5000);
        }, 2000);
      } else {
        const errData = await res.json();
        setRequestStatus('error');
        setUpgradeError(errData.detail || 'Đã có lỗi xảy ra khi gửi yêu cầu nâng cấp');
      }
    } catch (err: any) {
      setRequestStatus('error');
      setUpgradeError('Không thể kết nối đến máy chủ');
    } finally {
      setRequestLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    setFetchingFeedbacks(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/chat/feedback-history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFeedbacks(data);
      }
    } catch (err) {
      console.error('Error fetching feedback history:', err);
    } finally {
      setFetchingFeedbacks(false);
    }
  };

  const fetchChatModels = async () => {
    setFetchingModels(true);
    try {
      const [activeRes, adminRes] = await Promise.all([
        chatModelsAPI.listActive(),
        chatModelsAPI.list()
      ]);
      const globals = (activeRes.data || []).filter((m: any) => m.is_global === true);
      setSystemModels(globals);
      setPersonalModels(adminRes.data || []);
    } catch (err) {
      console.error('Failed to load chat models:', err);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleOpenAddModelModal = () => {
    setSelectedModel(null);
    setIsModelModalOpen(true);
  };

  const handleOpenEditModelModal = (model: any) => {
    setSelectedModel(model);
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async (formData: any) => {
    try {
      if (selectedModel?.id) {
        await chatModelsAPI.update(selectedModel.id, formData);
        setSuccess('Cập nhật cấu hình mô hình AI thành công!');
      } else {
        await chatModelsAPI.create(formData);
        setSuccess('Đăng ký mô hình AI cá nhân mới thành công!');
      }
      fetchChatModels();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lưu cấu hình mô hình thất bại');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteModel = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mô hình AI "${name}"?`)) {
      return;
    }
    setLoading(true);
    try {
      await chatModelsAPI.delete(id);
      setSuccess(`Đã xóa mô hình "${name}" thành công!`);
      fetchChatModels();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Xóa mô hình thất bại');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleTestModelConnection = async (id: number) => {
    setTestingModelId(id);
    try {
      const response = await chatModelsAPI.testConnection(id);
      if (response.data.success) {
        setModelTestResults(prev => ({
          ...prev,
          [id]: {
            success: true,
            message: response.data.message || 'Kết nối thành công!',
            latency: response.data.latency_ms
          }
        }));
        setSuccess('Kết nối thử nghiệm thành công!');
        fetchChatModels();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setModelTestResults(prev => ({
          ...prev,
          [id]: {
            success: false,
            message: response.data.message || 'Kết nối thất bại'
          }
        }));
      }
    } catch (err: any) {
      console.error(err);
      setModelTestResults(prev => ({
        ...prev,
        [id]: {
          success: false,
          message: err.response?.data?.detail || 'Lỗi kiểm tra kết nối'
        }
      }));
    } finally {
      setTestingModelId(null);
    }
  };

  const handleToggleModelActive = async (model: any) => {
    if (!model.id) return;
    try {
      const updatedData = {
        name: model.name,
        provider: model.provider,
        api_base_url: model.api_base_url,
        api_model: model.api_model,
        is_active: !model.is_active
      };
      await chatModelsAPI.update(model.id, updatedData);
      fetchChatModels();
    } catch (err) {
      console.error('Failed to toggle model active status:', err);
    }
  };

  const getProviderBadge = (provider: string) => {
    const styles: Record<string, string> = {
      openai: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      openrouter: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      gemini: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      ollama: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${styles[provider] || 'bg-surface-2 text-ink-subtle border-hairline'}`}>
        {provider === 'gemini' ? 'Gemini' : provider}
      </span>
    );
  };





  // Fetch user AI settings on mount
  const fetchAISettings = async () => {
    try {
      const response = await userAIAPI.getSettings();
      setAiSettings(response.data);
    } catch (err) {
      console.error('Error fetching AI settings:', err);
    }
  };

  const fetchDocuments = async () => {
    setFetchingDocs(true);
    try {
      const response = await documentsAPI.list();
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setFetchingDocs(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/upgrade/quota`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setQuota(data);
      }
    } catch (error) {
      console.error('Error fetching quota in user settings:', error);
    }
  };

  useEffect(() => {
    fetchAISettings();
  }, []);

  useEffect(() => {
    if (externalActiveTab) {
      setActiveTab(externalActiveTab);
    }
  }, [externalActiveTab]);

  useEffect(() => {
    if (activeTab === 'documents') {
      fetchDocuments();
      fetchQuota();
    } else if (activeTab === 'pricing') {
      fetchQuota();
    } else if (activeTab === 'feedback') {
      fetchFeedbacks();
    } else if (activeTab === 'models') {
      fetchChatModels();
    }
  }, [activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await usersAPI.updateMe({
        username: profileForm.username,
        full_name: profileForm.full_name,
        email: profileForm.email,
        phone: profileForm.phone,
      });
      const updatedUser = response.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess('Cập nhật thông tin thành công!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Cập nhật thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.new_password !== profileForm.confirm_password) {
      setError('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (profileForm.new_password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await usersAPI.updateMe({ password: profileForm.new_password });
      setProfileForm(prev => ({ ...prev, new_password: '', confirm_password: '' }));
      setSuccess('Đổi mật khẩu thành công!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAISettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await userAIAPI.updateSettings(aiSettings as any);
      setAiSettings(response.data);
      setSuccess('Cập nhật cá nhân hóa trợ lý thành công!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Cập nhật cá nhân hóa trợ lý thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (2MB for free tier)
    if (user?.subscription_tier === 'free' && file.size > 2 * 1024 * 1024) {
      setError('Dung lượng file vượt quá giới hạn 2MB của gói Free. Vui lòng nâng cấp gói cước để tải lên file lên tới 100MB.');
      setTimeout(() => setError(null), 8000);
      return;
    }

    setUploading(true);
    setSuccess(null);
    setError(null);

    try {
      await documentsAPI.upload(file, null);
      setSuccess('Tải lên và phân tích tài liệu thành công!');
      setTimeout(() => setSuccess(null), 3000);
      fetchDocuments();
      fetchQuota();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Tải lên tài liệu thất bại');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteDoc = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${name}"? Thao tác này sẽ xóa vĩnh viễn dữ liệu vector tri thức của tệp.`)) {
      return;
    }

    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      await documentsAPI.delete(id);
      setSuccess(`Đã xóa tài liệu "${name}" thành công!`);
      setTimeout(() => setSuccess(null), 3000);
      fetchDocuments();
      fetchQuota();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Xóa tài liệu thất bại');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleShareDoc = async (id: number, name: string) => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await documentsAPI.toggleShare(id);
      const updatedDoc = response.data;
      
      // Update local state directly
      setDocuments(prev => prev.map(doc => doc.id === id ? updatedDoc : doc));
      
      const shareStatus = updatedDoc.is_public_community ? 'Đã chia sẻ thành công lên thư viện cộng đồng!' : 'Đã hủy chia sẻ cộng đồng.';
      setSuccess(`Tài liệu "${name}": ${shareStatus}`);
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Thao tác chia sẻ thất bại');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getFileIconColor = (ext: string) => {
    const fileExt = (ext || '').toLowerCase();
    if (fileExt === 'pdf') return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
    if (['doc', 'docx'].includes(fileExt)) return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
    if (['xls', 'xlsx', 'csv'].includes(fileExt)) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (['ppt', 'pptx'].includes(fileExt)) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
    if (['png', 'jpg', 'jpeg'].includes(fileExt)) return 'text-violet-400 bg-violet-500/10 border border-violet-500/20';
    if (['md', 'markdown'].includes(fileExt)) return 'text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20';
    return 'text-ink-subtle bg-surface-2 border border-hairline';
  };

  const quotaPercentage = quota ? (quota.documents_used / quota.documents_limit) * 100 : 0;
  const progressBarColor = quotaPercentage >= 90 
    ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]' 
    : quotaPercentage >= 70 
      ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
      : 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]';

  return (
    <div className={`text-ink relative ${isUnifiedView ? '' : 'h-full overflow-y-auto bg-canvas min-h-screen'}`}>
      {/* Subtle background decorations */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-brand-lavender/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[25rem] h-[25rem] bg-brand-lavender/3 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[28rem] h-[28rem] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky Header */}
      {!isUnifiedView && (
        <div className="sticky top-0 bg-surface-1/80 backdrop-blur-xl z-20 border-b border-hairline">
          <div className="flex items-center gap-4 p-4 max-w-5xl mx-auto">
            <button 
              onClick={onBack}
              className="p-2.5 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-hairline"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-be-vietnam font-bold text-ink tracking-tight">Cá nhân</h1>
              <p className="text-xs text-ink-subtle">Quản lý thông tin, cấu hình trợ lý AI và thư viện tài liệu RAG</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-t border-hairline bg-canvas/30">
            <div className="flex px-6 gap-6 max-w-5xl mx-auto overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-3.5 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all duration-300 ${
                  activeTab === 'profile' 
                    ? 'border-brand-lavender text-brand-lavender' 
                    : 'border-transparent text-ink-subtle hover:text-ink-muted'
                }`}
              >
                Thông tin cá nhân
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`py-3.5 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all duration-300 ${
                  activeTab === 'ai' 
                    ? 'border-violet-500 text-violet-400' 
                    : 'border-transparent text-ink-subtle hover:text-ink-muted'
                }`}
              >
                Cá nhân hóa trợ lý
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-3.5 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all duration-300 flex items-center gap-1.5 ${
                  activeTab === 'documents' 
                    ? 'border-cyan-500 text-cyan-500' 
                    : 'border-transparent text-ink-subtle hover:text-ink-muted'
                }`}
              >
                Tài liệu của tôi 📁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {(success || error) && (
        <div className="bg-surface-2/60 border-b border-hairline py-3.5 px-6 z-10 relative">
          <div className="max-w-5xl mx-auto space-y-2">
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                {success}
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="p-6 relative z-10">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Tab Header */}
          {activeTab === 'profile' && (
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">Thông tin cá nhân</h2>
                <p className="text-xs text-ink-subtle mt-0.5">Quản lý thông tin tài khoản cá nhân và cấu hình bảo mật</p>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">Cá nhân hóa trợ lý</h2>
                <p className="text-xs text-ink-subtle mt-0.5">Tùy chỉnh độ sáng tạo, độ dài và phong cách phản hồi của trợ lý ảo RAG</p>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">Tài liệu cá nhân</h2>
                <p className="text-xs text-ink-subtle mt-0.5">Quản lý tài liệu tri thức RAG của tài khoản cá nhân</p>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">Gói cước tài khoản</h2>
                <p className="text-xs text-ink-subtle mt-0.5">Theo dõi hạn ngạch sử dụng tài nguyên và nâng cấp dịch vụ</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-ink-subtle block font-extrabold uppercase tracking-wider">Gói hiện tại</span>
                  <span className="px-3 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black rounded-full uppercase tracking-wider block mt-0.5">
                    {quota?.subscription_tier === 'pro' ? '⚡ PRO ACCOUNT' : quota?.subscription_tier === 'enterprise' ? '🛡️ ENTERPRISE' : 'GÓI FREE'}
                  </span>
                </div>
                <button
                  onClick={fetchQuota}
                  className="px-3 py-1.5 border border-hairline text-xs font-semibold hover:text-brand-lavender hover:bg-surface-2 rounded-xl transition-all"
                >
                  Làm mới
                </button>
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">Lịch sử phản hồi</h2>
                <p className="text-xs text-ink-subtle mt-0.5">Xem lại lịch sử đánh giá và góp ý câu trả lời lỗi của trợ lý ảo</p>
              </div>
              <button
                onClick={fetchFeedbacks}
                disabled={fetchingFeedbacks}
                className="px-3 py-1.5 border border-hairline text-xs font-semibold hover:text-brand-lavender hover:bg-surface-2 rounded-xl transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={fetchingFeedbacks ? "animate-spin text-rose-500" : ""} />
                Làm mới
              </button>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">Mô hình AI</h2>
                <p className="text-xs text-ink-subtle mt-0.5">Cấu hình kết nối các mô hình ngôn ngữ LLM (OpenAI, Gemini, Ollama Local)</p>
              </div>
              <button
                onClick={handleOpenAddModelModal}
                className="px-3 py-1.5 bg-brand-lavender hover:bg-brand-lavender-hover text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={12} />
                Đăng ký Mô hình
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN - Avatar Card / Info */}
          {(activeTab === 'profile' || activeTab === 'documents') && (
            <div className="lg:col-span-1 space-y-6">
              {activeTab === 'profile' ? (
                /* Avatar Panel */
                <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-brand-lavender/15 to-brand-lavender/5 group-hover:opacity-80 transition-opacity duration-300" />
                  
                  <div className="relative z-10">
                    <div className="relative inline-block mb-6">
                      <div className="w-32 h-32 rounded-full bg-surface-2 border-4 border-hairline shadow-xl overflow-hidden flex items-center justify-center mx-auto ring-4 ring-brand-lavender/10">
                        <User size={64} className="text-ink-tertiary" />
                      </div>
                      <button className="absolute bottom-0 right-0 p-2.5 bg-surface-3 hover:bg-surface-4 rounded-full shadow-lg text-brand-lavender hover:text-brand-lavender-hover hover:scale-110 transition-all border border-hairline active:scale-95">
                        <Camera size={16} />
                      </button>
                    </div>
                    
                    <h2 className="text-2xl font-be-vietnam font-bold text-ink mb-1">{user?.full_name || user?.username}</h2>
                    <p className="text-amber-500 font-extrabold text-[10px] uppercase tracking-widest bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full inline-block mb-5">
                      {user?.subscription_tier === 'pro' ? '⚡ PRO ACCOUNT' : user?.subscription_tier === 'enterprise' ? '🛡️ ENTERPRISE' : 'GÓI FREE'}
                    </p>
                    
                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full uppercase tracking-wider border border-emerald-500/20">
                        Active
                      </span>
                      <span className="px-3 py-1 bg-surface-2 text-ink-muted text-[10px] font-bold rounded-full uppercase tracking-wider border border-hairline">
                        ID: {user?.id}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-hairline text-left space-y-4">
                    <div className="flex items-center gap-3 text-ink-muted">
                      <Mail size={16} className="text-ink-tertiary" />
                      <span className="text-sm font-medium truncate" title={user?.email}>{user?.email || 'Chưa cập nhật'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Quota Info for Documents tab */
                <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
                  <h3 className="text-lg font-be-vietnam font-bold text-ink flex items-center gap-2">
                    <Sparkles size={20} className="text-cyan-500" />
                    Hạn ngạch RAG
                  </h3>
                  
                  {quota ? (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-ink-muted">
                          <span>Số tài liệu đã tải:</span>
                          <span className="text-cyan-500">{quota.documents_used}/{quota.documents_limit}</span>
                        </div>
                        <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-hairline">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ease-out ${progressBarColor}`} 
                            style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-ink-subtle leading-relaxed space-y-2 pt-2 border-t border-hairline">
                        <div className="flex items-start gap-2">
                          <span className="text-cyan-500 font-bold">•</span>
                          <span>Định dạng: PDF, Word (.docx), TXT, Markdown (.md), PNG, JPG...</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-cyan-500 font-bold">•</span>
                          <span>Dung lượng: {user?.subscription_tier === 'free' ? 'Tối đa 2MB tệp tin' : 'Tối đa 100MB tệp tin'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-cyan-500 font-bold">•</span>
                          <span>Tự động nhúng Vector ChromaDB và phục vụ trả lời hội thoại RAG.</span>
                        </div>
                      </div>

                      {quota.subscription_tier === 'free' && (
                        <div className="pt-2">
                          <div className="p-5 bg-gradient-to-br from-violet-600/20 to-amber-500/15 border border-violet-500/30 rounded-2xl text-ink-muted text-[11px] font-medium leading-relaxed shadow-sm relative overflow-hidden group">
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                            <span className="font-extrabold text-amber-500 block mb-1 text-xs flex items-center gap-1">⚡ NÂNG CẤP PRO NGAY!</span>
                            Hạn ngạch RAG sẽ tăng gấp 100 lần, hỗ trợ các tệp siêu lớn lên đến 100MB và kết nối AI ngoại tuyến (Ollama) không giới hạn.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-ink-tertiary">
                      Đang tải hạn ngạch...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* RIGHT COLUMN - Forms */}
          <div className={`space-y-6 ${
            (activeTab === 'profile' || activeTab === 'documents') ? 'lg:col-span-2' : 'lg:col-span-3'
          }`}>
            
            {activeTab === 'profile' && (
              <>
                {/* Profile Form */}
                <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm">
                  <h3 className="text-xl font-be-vietnam font-bold text-ink mb-6 flex items-center gap-3">
                    <User className="text-brand-lavender" size={24} />
                    Cập nhật thông tin
                  </h3>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Tên đăng nhập</label>
                        <div className="relative">
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                          <input 
                            type="text" 
                            value={profileForm.username} 
                            onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm text-ink focus:bg-surface-3" 
                            required 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Họ tên</label>
                        <div className="relative">
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                          <input 
                            type="text" 
                            value={profileForm.full_name} 
                            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm text-ink focus:bg-surface-3" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Email</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                          <input 
                            type="email" 
                            value={profileForm.email} 
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm text-ink focus:bg-surface-3" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Số điện thoại</label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                          <input 
                            type="text" 
                            value={profileForm.phone} 
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm text-ink focus:bg-surface-3" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-brand-lavender hover:bg-brand-lavender-hover text-white px-6 py-3 rounded-2xl font-bold shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm transition-all duration-300"
                      >
                        <Save size={18} />
                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Password Form */}
                <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm">
                  <h3 className="text-xl font-be-vietnam font-bold text-ink mb-6 flex items-center gap-3">
                    <Lock className="text-amber-500" size={24} />
                    Đổi mật khẩu
                  </h3>
                  
                  <form onSubmit={handleChangePassword} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Mật khẩu mới</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                          <input 
                            type="password" 
                            value={profileForm.new_password} 
                            onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm text-ink focus:bg-surface-3" 
                            required 
                            minLength={6} 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                          <input 
                            type="password" 
                            value={profileForm.confirm_password} 
                            onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm text-ink focus:bg-surface-3" 
                            required 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-surface-3 hover:bg-surface-4 text-ink-muted border border-hairline px-6 py-3 rounded-2xl font-bold shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm transition-all duration-300"
                      >
                        <ShieldCheck size={18} />
                        {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {activeTab === 'ai' && (
              /* AI Settings Form */
              <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm">
                  <h3 className="text-xl font-be-vietnam font-bold text-ink mb-6 flex items-center gap-3">
                  <Sparkles className="text-violet-400" size={24} />
                  Cá nhân hóa trợ lý RAG
                </h3>
                
                <form onSubmit={handleUpdateAISettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Temperature */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Độ sáng tạo (Temperature)</label>
                        <span className="text-xs font-mono font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-lg">{aiSettings.temperature}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.5" 
                        step="0.1"
                        value={aiSettings.temperature} 
                        onChange={(e) => setAiSettings({ ...aiSettings, temperature: parseFloat(e.target.value) })} 
                        className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none" 
                      />
                      <p className="text-[10px] text-ink-subtle leading-relaxed">Giá trị càng thấp, câu trả lời càng chính xác và nhất quán. Giá trị cao giúp câu trả lời đa dạng hơn.</p>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Độ dài câu trả lời (Max Tokens)</label>
                      <select
                        value={aiSettings.preferred_max_tokens}
                        onChange={(e) => setAiSettings({ ...aiSettings, preferred_max_tokens: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm font-semibold text-ink focus:bg-surface-3"
                      >
                        <option value="256">Ngắn gọn (256 tokens)</option>
                        <option value="512">Trung bình (512 tokens)</option>
                        <option value="1024">Dài (1024 tokens)</option>
                        <option value="2048">Rất dài (2048 tokens)</option>
                      </select>
                    </div>

                    {/* Response Style */}
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Phong cách phản hồi mặc định</label>
                      <select
                        value={aiSettings.response_style}
                        onChange={(e) => setAiSettings({ ...aiSettings, response_style: e.target.value })}
                        className="w-full px-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm font-semibold text-ink focus:bg-surface-3"
                      >
                        <option value="concise">Tóm tắt ngắn gọn</option>
                        <option value="normal">Bình thường đầy đủ</option>
                        <option value="detailed">Chi tiết từng bước</option>
                      </select>
                    </div>

                    {/* Show Sources */}
                    <div className="space-y-2 flex flex-col justify-center">
                      <div className="flex items-center justify-between p-3.5 bg-surface-2/60 border border-hairline rounded-2xl">
                        <div>
                          <span className="text-xs font-bold text-ink block">Hiển thị nguồn trích dẫn</span>
                          <span className="text-[10px] text-ink-subtle">Trích dẫn tài liệu gốc dưới câu trả lời</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={aiSettings.show_sources} 
                          onChange={(e) => setAiSettings({ ...aiSettings, show_sources: e.target.checked })}
                          className="w-4.5 h-4.5 rounded text-violet-500 focus:ring-violet-500/20 bg-surface-2 border-hairline cursor-pointer"
                        />
                      </div>
                    </div>



                    {/* Receive Community Knowledge */}
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between p-3.5 bg-surface-2/60 border border-hairline rounded-2xl">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink block">Nhận tri thức cộng đồng</span>
                            {user?.subscription_tier === 'free' && (
                              <span className="px-2.5 py-0.5 rounded text-[8px] font-black bg-violet-500/10 border border-violet-500/20 text-violet-400 uppercase tracking-wider">PRO FEATURE</span>
                            )}
                          </div>
                          <span className="text-[10px] text-ink-subtle">Được phép tham khảo vector tri thức dùng chung của cộng đồng</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={aiSettings.receive_community_knowledge} 
                          disabled={user?.subscription_tier === 'free'}
                          onChange={(e) => setAiSettings({ ...aiSettings, receive_community_knowledge: e.target.checked })}
                          className={`w-4.5 h-4.5 rounded text-violet-500 focus:ring-violet-500/20 bg-surface-2 border-hairline ${user?.subscription_tier === 'free' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        />
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
                    >
                      <Save size={18} />
                      Lưu cá nhân hóa trợ lý
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'documents' && (
              /* Tab Documents - Personal User Document Upload */
              <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-be-vietnam font-bold text-ink flex items-center gap-3">
                    <FileText className="text-cyan-500" size={24} />
                    Tài liệu RAG cá nhân
                  </h3>
                  <button
                    onClick={fetchDocuments}
                    disabled={fetchingDocs}
                    className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 border border-transparent hover:border-hairline rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    title="Làm mới danh sách"
                  >
                    <RefreshCw size={16} className={fetchingDocs ? "animate-spin text-cyan-500" : "text-ink-subtle"} />
                  </button>
                </div>

                <p className="text-ink-subtle text-xs leading-relaxed">
                  Tải lên tài liệu của riêng bạn (.pdf, .docx, .txt, .md...). Trợ lý AI sẽ tự động phân tách, nhúng vector tri thức và ưu tiên sử dụng các tài liệu này để trả lời khi bạn trò chuyện trong luồng RAG cá nhân.
                </p>

                {/* Upload area */}
                <div className="border-2 border-dashed border-hairline hover:border-brand-lavender/50 rounded-3xl p-6 text-center hover:bg-surface-2 transition-all relative group bg-surface-1">
                  <input
                    type="file"
                    id="personal-doc-upload"
                    onChange={handleUploadFile}
                    disabled={uploading}
                    accept=".pdf,.docx,.txt,.pptx,.xlsx,.csv,.html,.htm,.md,.png,.jpg,.jpeg"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-cyan-500/5 group-hover:scale-105 transition-transform">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink-muted">
                        {uploading ? 'Đang phân tích & trích xuất tài liệu...' : 'Kéo thả hoặc nhấp để chọn tệp'}
                      </p>
                      <p className="text-[10px] text-ink-subtle mt-1 leading-relaxed">
                        Hỗ trợ PDF, DOCX, TXT, MD, PPTX, hình ảnh...<br />
                        Dung lượng tối đa: {user?.subscription_tier === 'free' ? '2MB' : '100MB'}
                      </p>
                    </div>
                    {uploading && (
                      <div className="w-48 h-1 bg-surface-2 rounded-full mx-auto overflow-hidden border border-hairline">
                        <div className="h-full bg-cyan-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Danh sách tài liệu ({documents.length})</h4>
                  
                  {fetchingDocs ? (
                    <div className="text-center py-8 text-ink-tertiary text-xs">
                      Đang tải danh sách tài liệu...
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-10 border border-hairline rounded-2xl text-ink-tertiary text-xs bg-surface-2/30">
                      Chưa có tài liệu cá nhân nào được tải lên.
                    </div>
                  ) : (
                    <div className="divide-y divide-hairline border border-hairline rounded-2xl overflow-hidden bg-surface-1">
                      {documents.map((doc) => {
                        const fileExt = (doc.file_type || '').toLowerCase();
                        return (
                          <div key={doc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getFileIconColor(fileExt)}`}>
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                {editingDocId === doc.id ? (
                                  <div className="flex items-center gap-2 max-w-md">
                                    <input
                                      type="text"
                                      className="px-3 py-1.5 bg-surface-2 border border-brand-lavender text-ink rounded-lg text-xs w-full outline-none"
                                      value={editDocName}
                                      onChange={(e) => setEditDocName(e.target.value)}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateDocName(doc.id);
                                        if (e.key === 'Escape') { setEditingDocId(null); setEditDocName(''); }
                                      }}
                                    />
                                    <button 
                                      onClick={() => handleUpdateDocName(doc.id)} 
                                      className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button 
                                      onClick={() => { setEditingDocId(null); setEditDocName(''); }} 
                                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-xs font-bold text-ink truncate" title={doc.original_name}>
                                      {doc.original_name}
                                    </p>
                                    
                                    {/* Security and Sharing Status Badges */}
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="text-[10px] text-ink-subtle font-medium">
                                        {(doc.file_size / 1024).toFixed(1)} KB • {doc.chunk_count || 0} mảnh • {new Date(doc.uploaded_at).toLocaleDateString('vi-VN')}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border ${
                                        doc.is_public_community 
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                          : 'bg-surface-2 border-hairline text-ink-subtle'
                                      }`}>
                                        {doc.is_public_community ? '🌐 Cộng đồng' : '🔒 Riêng tư'}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              {editingDocId !== doc.id && (
                                <button
                                  onClick={() => { setEditingDocId(doc.id); setEditDocName(doc.original_name); }}
                                  disabled={loading}
                                  className="p-2.5 text-ink-subtle hover:text-brand-lavender hover:bg-brand-lavender/10 border border-transparent hover:border-brand-lavender/20 rounded-xl transition-colors active:scale-95 shrink-0 disabled:opacity-50 flex items-center justify-center"
                                  title="Đổi tên tài liệu"
                                >
                                  <Edit2 size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleShareDoc(doc.id, doc.original_name)}
                                disabled={loading}
                                className={`p-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border ${
                                  doc.is_public_community 
                                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/25 hover:text-emerald-400' 
                                    : 'text-ink-subtle bg-transparent border-transparent hover:text-ink hover:bg-surface-2 hover:border-hairline'
                                }`}
                                title={doc.is_public_community ? "Hủy chia sẻ tri thức cộng đồng" : "Chia sẻ tri thức cộng đồng"}
                              >
                                <Globe size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(doc.id, doc.original_name)}
                                disabled={loading}
                                className="p-2.5 text-ink-subtle hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition-colors active:scale-95 shrink-0 disabled:opacity-50 flex items-center justify-center"
                                title="Xóa tài liệu"
                              >
                                  <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              /* Tab Pricing - View Plans & VietQR */
              <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm space-y-8">
                
                {/* Quota Progress Cards */}
                {quota && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Hạn ngạch câu hỏi hôm nay */}
                    <div className="bg-surface-2/50 border border-hairline rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-baseline text-xs font-bold text-ink-muted">
                        <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-amber-500" /> Hạn ngạch câu hỏi hôm nay:</span>
                        <span className="text-brand-lavender font-extrabold">
                          {quota.questions_used} / {quota.questions_limit === 999999 ? '∞ (Không giới hạn)' : quota.questions_limit}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden border border-hairline">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            quota.questions_limit === 999999 ? 'bg-brand-lavender shadow-[0_0_12px_rgba(94,106,210,0.5)]' :
                            (quota.questions_used / quota.questions_limit) * 100 >= 90 ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]' :
                            (quota.questions_used / quota.questions_limit) * 100 >= 70 ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' :
                            'bg-brand-lavender shadow-[0_0_12px_rgba(94,106,210,0.5)]'
                          }`}
                          style={{ width: `${quota.questions_limit === 999999 ? 0 : Math.min((quota.questions_used / quota.questions_limit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Hạn ngạch tài liệu */}
                    <div className="bg-surface-2/50 border border-hairline rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-baseline text-xs font-bold text-ink-muted">
                        <span className="flex items-center gap-1.5"><FileText size={14} className="text-cyan-500" /> Hạn ngạch RAG tài liệu:</span>
                        <span className="text-cyan-500 font-extrabold">
                          {quota.documents_used} / {quota.documents_limit}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden border border-hairline">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            (quota.documents_used / quota.documents_limit) * 100 >= 90 ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]' :
                            (quota.documents_used / quota.documents_limit) * 100 >= 70 ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' :
                            'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                          }`}
                          style={{ width: `${Math.min((quota.documents_used / quota.documents_limit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* FREE PLAN */}
                  <div className="flex flex-col p-6 rounded-2xl border border-hairline bg-surface-2/30 relative overflow-hidden transition-all hover:border-hairline-strong">
                    <div className="mb-6">
                      <h4 className="text-base font-bold text-ink mb-1">Free Tier</h4>
                      <p className="text-[11px] text-ink-subtle min-h-[32px]">Dành cho người dùng cá nhân trải nghiệm chatbot cơ bản.</p>
                      <div className="mt-4 flex items-baseline">
                        <span className="text-3xl font-extrabold text-ink">0đ</span>
                        <span className="text-ink-subtle text-xs ml-1">/ vĩnh viễn</span>
                      </div>
                    </div>
                    
                    <button
                      disabled={true}
                      className="w-full py-2 bg-surface-3 text-ink-subtle border border-hairline cursor-not-allowed mb-6 rounded-xl text-xs font-bold"
                    >
                      {quota?.subscription_tier === 'free' ? 'Gói hiện tại' : 'Đã vượt qua'}
                    </button>

                    <div className="space-y-3 flex-1">
                      <span className="text-[10px] font-black text-ink-subtle block uppercase tracking-wider mb-1">TÍNH NĂNG BAO GỒM</span>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">10 câu hỏi/ngày</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">Tối đa 3 tài liệu RAG</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">Tệp tin &lt; 2MB/file</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* PRO PLAN */}
                  <div className="flex flex-col p-6 rounded-2xl border-2 border-brand-lavender bg-surface-1 relative overflow-hidden shadow-lg shadow-brand-lavender/5 transition-all hover:shadow-brand-lavender/10">
                    <div className="absolute top-2.5 right-2.5 bg-brand-lavender text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                      <Sparkles size={8} /> PHỔ BIẾN
                    </div>

                    <div className="mb-6">
                      <h4 className="text-base font-bold text-ink mb-1">Pro Individual</h4>
                      <p className="text-[11px] text-ink-subtle min-h-[32px]">Tăng cường giới hạn, phân tích thông minh và cấu hình offline.</p>
                      <div className="mt-4 flex items-baseline">
                        <span className="text-3xl font-extrabold text-ink">99.000đ</span>
                      </div>
                    </div>

                    {quota?.subscription_tier === 'pro' ? (
                      <button
                        disabled={true}
                        className="w-full py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 mb-6 rounded-xl text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 size={13} /> Đang kích hoạt
                      </button>
                    ) : quota?.subscription_tier === 'enterprise' ? (
                      <button
                        disabled={true}
                        className="w-full py-2 bg-surface-3 text-ink-subtle border border-hairline mb-6 rounded-xl text-xs font-bold cursor-not-allowed"
                      >
                        Đã vượt qua
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowQRModal(true)}
                        className="w-full py-2 bg-brand-lavender hover:bg-brand-lavender-hover text-white mb-6 rounded-xl text-xs font-bold transition-all active:scale-[0.97] shadow-sm flex items-center justify-center gap-1"
                      >
                        Nâng cấp Pro ⚡
                      </button>
                    )}

                    <div className="space-y-3 flex-1">
                      <span className="text-[10px] font-black text-ink-subtle block uppercase tracking-wider mb-1">TÍNH NĂNG BAO GỒM</span>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">Không giới hạn câu hỏi/ngày</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">Tối đa 100 tài liệu RAG</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">Hỗ trợ tệp tin lớn 100MB</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                          <span className="text-ink-muted">Hỗ trợ Ollama Local (Offline)</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  </div>

                {/* VietQR Upgrading Payment Modal */}
                <AnimatePresence>
                  {showQRModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ type: "spring", duration: 0.4 }}
                        className="bg-slate-900 text-white rounded-3xl p-6 border border-white/10 shadow-2xl max-w-md w-full relative overflow-hidden backdrop-blur-xl text-center"
                      >
                        <button
                          onClick={() => {
                            setShowQRModal(false);
                            setRequestStatus('none');
                          }}
                          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
                        >
                          <X size={16} />
                        </button>

                        <div className="mb-4">
                          <h4 className="text-base font-bold text-white">Nâng cấp tài khoản Pro</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Quét mã QR để chuyển khoản phí dịch vụ</p>
                        </div>

                        {/* VietQR Generation */}
                        <div className="bg-white p-3 rounded-2xl inline-block mb-4 shadow-inner">
                          <img
                            src={`https://img.vietqr.io/image/MB-9999988888-compact2.png?amount=99000&addInfo=${encodeURIComponent(`WIKIBOT PRO ${user?.username || 'GUEST'}`)}&accountName=${encodeURIComponent('CONG TY CONG NGHE WIKIBOT')}`}
                            alt="VietQR MB Bank"
                            className="w-56 h-56 mx-auto object-contain"
                          />
                        </div>

                        <div className="text-left space-y-2 mb-6 p-4 bg-slate-950/50 rounded-2xl text-[11px] text-slate-300 border border-white/5">
                          <div className="flex justify-between"><span className="text-slate-400">Ngân hàng:</span><span className="font-bold text-white">MB Bank (Quân Đội)</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Số tài khoản:</span><span className="font-bold text-white">9999988888</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Chủ tài khoản:</span><span className="font-bold text-white uppercase">CONG TY CONG NGHE WIKIBOT</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Số tiền:</span><span className="font-bold text-emerald-400 text-xs">99.000đ / tháng</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Nội dung chuyển khoản:</span><span className="font-mono font-bold text-brand-lavender uppercase text-xs">WIKIBOT PRO {user?.username || 'GUEST'}</span></div>
                        </div>

                        <div className="space-y-3">
                          {requestStatus === 'success' ? (
                            <div className="py-3 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                              <CheckCircle2 size={14} /> Gửi yêu cầu thành công! Đang kích hoạt...
                            </div>
                          ) : requestStatus === 'error' ? (
                            <div className="py-2.5 px-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium text-left flex items-start gap-2">
                              <AlertCircle size={14} className="shrink-0 mt-0.5" />
                              <span>{upgradeError || 'Có lỗi xảy ra'}</span>
                            </div>
                          ) : null}

                          <button
                            onClick={handleUpgradeRequest}
                            disabled={requestLoading || requestStatus === 'success'}
                            className="w-full py-3 bg-gradient-to-r from-brand-lavender to-violet-600 hover:from-brand-lavender/90 hover:to-violet-600/90 text-white font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                          >
                            {requestLoading ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Đang kiểm tra giao dịch...</span>
                              </>
                            ) : (
                              <span>Đã chuyển khoản thành công, kích hoạt Pro! ⚡</span>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === 'feedback' && (
              /* Tab Feedback History */
              <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-be-vietnam font-bold text-ink flex items-center gap-3">
                    <ThumbsDown className="text-rose-500" size={24} />
                    Lịch sử phản hồi góp ý
                  </h3>
                  <button
                    onClick={fetchFeedbacks}
                    disabled={fetchingFeedbacks}
                    className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 border border-transparent hover:border-hairline rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    title="Làm mới lịch sử"
                  >
                    <RefreshCw size={16} className={fetchingFeedbacks ? "animate-spin text-rose-500" : "text-ink-subtle"} />
                  </button>
                </div>

                <p className="text-ink-subtle text-xs leading-relaxed">
                  Xem lại toàn bộ các câu trả lời mà bạn đã đánh giá (Thích/Không thích) hoặc gửi phản hồi lỗi hỗ trợ kỹ thuật để giúp đội ngũ quản trị cải thiện chất lượng tri thức chatbot.
                </p>

                {fetchingFeedbacks ? (
                  <div className="text-center py-10 text-xs text-ink-tertiary">
                    Đang tải lịch sử phản hồi...
                  </div>
                ) : feedbacks.length === 0 ? (
                  <div className="text-center py-12 border border-hairline border-dashed rounded-3xl text-ink-tertiary text-xs bg-surface-2/10">
                    Bạn chưa gửi phản hồi hoặc đánh giá câu trả lời nào.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((item) => (
                      <div key={item.message_id} className="p-6 border border-hairline rounded-2xl bg-surface-2/20 space-y-4 hover:border-hairline-strong transition-colors">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-hairline">
                          <div className="flex items-center gap-2">
                            {item.rating === 1 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                <ThumbsUp size={10} /> Hài lòng
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 border border-rose-500/20 text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                <ThumbsDown size={10} /> Báo lỗi
                              </span>
                            )}
                            {item.feedback_category && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-surface-3 border border-hairline text-ink-muted">
                                {item.feedback_category}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-ink-subtle font-medium">
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>

                        {/* Content Question/Answer */}
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="font-extrabold text-[10px] uppercase tracking-wider text-ink-subtle block mb-1">❓ Câu hỏi của bạn:</span>
                            <p className="p-3 bg-surface-2/60 border border-hairline rounded-xl text-ink-muted font-medium italic">{item.user_question}</p>
                          </div>
                          <div>
                            <span className="font-extrabold text-[10px] uppercase tracking-wider text-ink-subtle block mb-1">🤖 Trả lời của bot:</span>
                            <div className="p-3 bg-surface-2/30 border border-hairline rounded-xl text-ink-subtle max-h-36 overflow-y-auto custom-scrollbar font-medium whitespace-pre-wrap leading-relaxed">{item.assistant_answer}</div>
                          </div>
                        </div>

                        {/* Comment text */}
                        {item.feedback_text && (
                          <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs">
                            <span className="font-extrabold text-[10px] uppercase tracking-wider text-rose-400 block mb-1">💬 Góp ý lỗi / Nội dung chi tiết:</span>
                            <p className="text-ink font-medium leading-relaxed">{item.feedback_text}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'models' && (
              /* Tab AI Models - Personal LLM Custom Config */
              <div className="space-y-6">

                {/* Loading state */}
                {fetchingModels ? (
                  <div className="text-center py-10 border border-hairline rounded-[2rem] text-ink-tertiary text-xs bg-surface-1">
                    <RefreshCw className="animate-spin text-brand-lavender w-6 h-6 mx-auto mb-2" />
                    Đang tải danh sách mô hình...
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* SECTION 1: SYSTEM MODELS (READ ONLY) */}
                    {systemModels.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-ink-subtle uppercase tracking-wider pl-1 flex items-center gap-1.5">
                          🛡️ Mô hình hệ thống (Superadmin cấp)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {systemModels.map((model) => (
                            <div 
                              key={model.id}
                              className="bg-surface-1/40 border border-hairline rounded-2xl p-5 shadow-sm space-y-3 opacity-80"
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                  <h5 className="text-xs font-bold text-ink-muted line-clamp-1">{model.name}</h5>
                                  <p className="text-[10px] text-ink-subtle font-mono line-clamp-1">{model.api_model}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {getProviderBadge(model.provider)}
                                  <span className="px-2 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 uppercase tracking-wider">
                                    Mặc định
                                  </span>
                                </div>
                              </div>
                              <div className="text-[10px] text-ink-muted bg-surface-2/60 p-2 rounded-lg font-mono truncate">
                                <span className="font-bold">Base URL:</span> {model.api_base_url || '(Sử dụng của hệ thống)'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: PERSONAL MODELS (CRUD) */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-ink-subtle uppercase tracking-wider pl-1 flex items-center gap-1.5">
                        👤 Mô hình cá nhân của bạn ({personalModels.length})
                      </h4>
                      {personalModels.length === 0 ? (
                        <div className="text-center py-10 border border-hairline border-dashed rounded-[2rem] text-ink-tertiary text-xs bg-surface-2/10">
                          Bạn chưa tự đăng ký mô hình LLM nào. Hãy kết nối thêm mô hình OpenAI hoặc Ollama offline của bạn!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {personalModels.map((model) => {
                            const result = model.id ? modelTestResults[model.id] : null;
                            return (
                              <div 
                                key={model.id}
                                className={`bg-surface-1 border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4 hover:border-brand-lavender/30 ${
                                  model.is_active 
                                    ? 'border-brand-lavender/20 bg-brand-lavender/[0.01]' 
                                    : 'border-hairline'
                                }`}
                              >
                                <div className="space-y-3">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="space-y-0.5">
                                      <h5 className="text-xs font-bold text-ink line-clamp-1">{model.name}</h5>
                                      <p className="text-[10px] text-ink-subtle font-mono line-clamp-1">{model.api_model}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {getProviderBadge(model.provider)}
                                      <button
                                        onClick={() => handleToggleModelActive(model)}
                                        className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider transition-all ${
                                          model.is_active 
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                                            : 'bg-surface-2 text-ink-subtle border-hairline hover:bg-surface-3'
                                        }`}
                                        title={model.is_active ? "Nhấn để tạm tắt mô hình" : "Nhấn để kích hoạt mô hình"}
                                      >
                                        {model.is_active ? 'Bật' : 'Tắt'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* URL Path */}
                                  <div className="text-[10px] text-ink-muted bg-surface-2 p-2 rounded-lg font-mono truncate">
                                    <span className="font-bold">Base URL:</span> {model.api_base_url || '(Mặc định)'}
                                  </div>

                                  {/* Key Status */}
                                  <div className="flex items-center gap-1.5 text-[10px] text-ink-subtle">
                                    <span className={`w-1.5 h-1.5 rounded-full ${model.has_api_key ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    <span>{model.has_api_key ? 'Đã cấu hình API Key' : 'Không dùng API Key (Ollama / Local)'}</span>
                                  </div>
                                </div>

                                {/* Connection test result */}
                                {result && (
                                  <div className={`p-2.5 rounded-xl border text-[11px] font-medium space-y-1 ${
                                    result.success 
                                      ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/15' 
                                      : 'bg-rose-500/5 text-rose-500 border-rose-500/15'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        {result.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                        {result.success ? 'Kết nối OK!' : 'Kết nối lỗi'}
                                      </span>
                                      {result.latency && (
                                        <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] text-emerald-500">
                                          {result.latency.toFixed(0)} ms
                                        </span>
                                      )}
                                    </div>
                                    <p className="opacity-90 font-normal line-clamp-2 leading-relaxed">{result.message}</p>
                                  </div>
                                )}

                                {/* Card Actions */}
                                <div className="border-t border-hairline pt-3 flex justify-between items-center">
                                  <button
                                    onClick={() => model.id && handleTestModelConnection(model.id)}
                                    disabled={testingModelId === model.id}
                                    className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                      testingModelId === model.id 
                                        ? 'bg-surface-3 text-ink-muted border-hairline cursor-not-allowed'
                                        : 'bg-surface-2 hover:bg-surface-3 text-ink-muted border-hairline hover:text-ink'
                                    }`}
                                  >
                                    {testingModelId === model.id ? (
                                      <RefreshCw size={10} className="animate-spin text-brand-lavender" />
                                    ) : (
                                      <Globe size={10} className="text-brand-lavender" />
                                    )}
                                    {testingModelId === model.id ? 'Đang kiểm tra...' : 'Test Connection'}
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditModelModal(model)}
                                      className="p-1.5 text-ink-subtle hover:text-brand-lavender hover:bg-brand-lavender/5 border border-transparent hover:border-brand-lavender/25 rounded-lg transition-all"
                                      title="Sửa cấu hình"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => model.id && handleDeleteModel(model.id, model.name)}
                                      className="p-1.5 text-ink-subtle hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 rounded-lg transition-all"
                                      title="Xóa mô hình"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Model Creation & Update Modal popup */}
      <ModelFormModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onSave={handleSaveModel}
        model={selectedModel}
      />
    </div>
  );
}


