'use client';

import { useState, useEffect } from 'react';
import { usersAPI, documentsAPI } from '@/app/lib/api';
import { userAIAPI } from '@/app/lib/ai-config-api';
import {
  ArrowLeft, User, Mail, Phone, Lock, Save, 
  ShieldCheck, AlertCircle, Camera, CheckCircle2,
  Sparkles, Settings, Eye, FileText, Trash2, UploadCloud, RefreshCw, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

export function UserSettings({ onBack, user }: { onBack: () => void; user: any }) {
  const [loading, setLoading] = useState(false);
  const isStaff = user?.role?.level === 2;
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'documents'>('profile');

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
      const response = await fetch('http://localhost:8000/api/upgrade/quota', {
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
    if (activeTab === 'documents') {
      fetchDocuments();
      fetchQuota();
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
      setSuccess('Cập nhật cấu hình AI thành công!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Cập nhật cấu hình AI thất bại');
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
    <div className="h-full overflow-y-auto bg-canvas text-ink relative min-h-screen">
      {/* Subtle background decorations */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-brand-lavender/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[25rem] h-[25rem] bg-brand-lavender/3 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[28rem] h-[28rem] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky Header */}
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
              Cấu hình AI
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          {/* LEFT COLUMN - Avatar Card / Info */}
          <div className="lg:col-span-1 space-y-6">
            
            {activeTab !== 'documents' ? (
              <>
                {/* Avatar Panel */}
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

                {/* Account Security Info Card */}
                <div className="bg-surface-2 border border-hairline rounded-[2rem] p-8 text-ink relative overflow-hidden">
                  <ShieldCheck className="absolute -right-8 -bottom-8 w-44 h-44 text-ink/[0.03]" />
                  <h3 className="text-lg font-be-vietnam font-bold mb-4 flex items-center gap-2">
                    <Lock size={20} className="text-blue-400" />
                    Bảo mật an toàn
                  </h3>
                  <p className="text-ink-subtle text-xs mb-6 leading-relaxed">
                    Mật khẩu của bạn được mã hóa mật mã an toàn cao. Chúng tôi khuyên bạn nên đổi mật khẩu định kỳ để nâng cao tính bảo mật.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Được bảo vệ 2 lớp
                  </div>
                </div>
              </>
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
          
          {/* RIGHT COLUMN - Forms */}
          <div className="lg:col-span-2 space-y-6">
            
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
                  Cấu hình AI & Trợ lý RAG
                </h3>
                
                <form onSubmit={handleUpdateAISettings} className="space-y-6">
                  {isStaff && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 text-xs font-semibold leading-relaxed flex items-center gap-3">
                      <AlertCircle size={18} className="shrink-0 text-amber-500" />
                      <span>⚠️ Các cấu hình AI này được thiết lập tập trung bởi Quản trị viên công ty của bạn để đảm bảo tính đồng bộ dữ liệu. Bạn chỉ có quyền xem, không có quyền chỉnh sửa.</span>
                    </div>
                  )}
                  
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
                        disabled={isStaff}
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
                        disabled={isStaff}
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
                        disabled={isStaff}
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
                          disabled={isStaff}
                          onChange={(e) => setAiSettings({ ...aiSettings, show_sources: e.target.checked })}
                          className="w-4.5 h-4.5 rounded text-violet-500 focus:ring-violet-500/20 bg-surface-2 border-hairline cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Ollama Endpoint */}
                    <div className="space-y-2 col-span-1 md:col-span-2 border-t border-hairline pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-extrabold text-ink-subtle uppercase tracking-widest">Đường dẫn Ollama Local</label>
                          {(user?.subscription_tier === 'free' || isStaff) && (
                            <span className="px-2.5 py-0.5 rounded text-[8px] font-black bg-violet-500/10 border border-violet-500/20 text-violet-400 uppercase tracking-wider">PRO FEATURE</span>
                          )}
                        </div>
                        <span className="text-[10px] text-ink-tertiary">Cấu hình kết nối LLM Offline</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={aiSettings.ollama_endpoint} 
                          disabled={user?.subscription_tier === 'free' || isStaff}
                          onChange={(e) => setAiSettings({ ...aiSettings, ollama_endpoint: e.target.value })} 
                          className={`w-full px-4 py-3 bg-surface-2 border border-hairline rounded-2xl focus:ring-2 focus:ring-brand-lavender/20 focus:border-brand-lavender/50 outline-none transition-all text-sm font-mono text-ink ${user?.subscription_tier === 'free' || isStaff ? 'opacity-50 cursor-not-allowed select-none' : 'focus:bg-surface-3'}`}
                          placeholder="http://localhost:11434"
                        />
                      </div>
                      {user?.subscription_tier === 'free' && !isStaff && (
                        <p className="text-[10px] text-violet-400 font-bold tracking-wide mt-1.5">
                          ⚡ Vui lòng nâng cấp lên gói PRO để tùy biến kết nối Ollama Local chạy offline cục bộ.
                        </p>
                      )}
                    </div>

                    {/* Receive Community Knowledge */}
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between p-3.5 bg-surface-2/60 border border-hairline rounded-2xl">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink block">Nhận tri thức cộng đồng</span>
                            {(user?.subscription_tier === 'free' || isStaff) && (
                              <span className="px-2.5 py-0.5 rounded text-[8px] font-black bg-violet-500/10 border border-violet-500/20 text-violet-400 uppercase tracking-wider">PRO FEATURE</span>
                            )}
                          </div>
                          <span className="text-[10px] text-ink-subtle">Được phép tham khảo vector tri thức dùng chung của cộng đồng</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={aiSettings.receive_community_knowledge} 
                          disabled={user?.subscription_tier === 'free' || isStaff}
                          onChange={(e) => setAiSettings({ ...aiSettings, receive_community_knowledge: e.target.checked })}
                          className={`w-4.5 h-4.5 rounded text-violet-500 focus:ring-violet-500/20 bg-surface-2 border-hairline ${user?.subscription_tier === 'free' || isStaff ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        />
                      </div>
                    </div>

                  </div>

                  {!isStaff && (
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
                      >
                        <Save size={18} />
                        Lưu cấu hình AI
                      </button>
                    </div>
                  )}
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
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getFileIconColor(fileExt)}`}>
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
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
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
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
          </div>
        </div>
      </div>
    </div>
  );
}
