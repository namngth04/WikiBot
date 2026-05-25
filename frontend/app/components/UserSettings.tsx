'use client';

import { useState, useEffect } from 'react';
import { usersAPI, documentsAPI } from '@/app/lib/api';
import { userAIAPI } from '@/app/lib/ai-config-api';
import {
  ArrowLeft, User, Mail, Phone, Lock, Save, 
  ShieldCheck, AlertCircle, Camera, CheckCircle2,
  Sparkles, Settings, Eye, FileText, Trash2, UploadCloud, RefreshCw
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

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white z-20 border-b border-slate-100">
        <div className="flex items-center gap-4 p-4">
          <button 
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-be-vietnam font-bold text-slate-900">Cá nhân</h1>
            <p className="text-sm text-slate-500">Quản lý thông tin, cấu hình trợ lý AI và tài liệu RAG</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-100 px-6 gap-6 bg-white overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'profile' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Thông tin cá nhân
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'ai' 
                ? 'border-violet-600 text-violet-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Cấu hình AI
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'documents' 
                ? 'border-cyan-600 text-cyan-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Tài liệu của tôi 📁
          </button>
        </div>
      </div>

      {/* Status Messages - Non-sticky */}
      {(success || error) && (
        <div className="px-6 py-3 bg-white border-b border-slate-100 space-y-2">
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          {/* LEFT COLUMN - Avatar Card / Info */}
          <div className="lg:col-span-1 space-y-6">
            
            {activeTab !== 'documents' ? (
              <>
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary-600 to-violet-600 opacity-10 group-hover:opacity-20 transition-opacity" />
                  
                  <div className="relative z-10">
                    <div className="relative inline-block mb-6">
                      <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center mx-auto ring-4 ring-primary-50">
                        <User size={64} className="text-slate-300" />
                      </div>
                      <button className="absolute bottom-0 right-0 p-2.5 bg-white rounded-full shadow-md text-primary-600 hover:text-primary-700 hover:scale-110 transition-all border border-slate-100">
                        <Camera size={18} />
                      </button>
                    </div>
                    
                    <h2 className="text-2xl font-be-vietnam font-bold text-slate-900 mb-1">{user?.full_name || user?.username}</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">
                      {user?.subscription_tier === 'pro' ? '⚡ PRO ACCOUNT' : user?.subscription_tier === 'enterprise' ? '🛡️ ENTERPRISE' : 'GÓI FREE'}
                    </p>
                    
                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-3 py-1 bg-primary-50 text-primary-600 text-[10px] font-bold rounded-full uppercase tracking-wider border border-primary-100">
                        Active
                      </span>
                      <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider border border-slate-100">
                        ID: {user?.id}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-50 text-left space-y-4">
                    <div className="flex items-center gap-3 text-slate-600">
                      <Mail size={16} className="text-slate-400" />
                      <span className="text-sm font-medium truncate">{user?.email || 'Chưa cập nhật'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                  <ShieldCheck className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5" />
                  <h3 className="text-lg font-be-vietnam font-bold mb-4 flex items-center gap-2">
                    <Lock size={20} className="text-primary-400" />
                    Bảo mật tài khoản
                  </h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Mật khẩu của bạn được mã hóa an toàn. Chúng tôi khuyên bạn nên đổi mật khẩu định kỳ 3 tháng một lần.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-bold text-primary-400">
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                    Hệ thống đã được bảo vệ
                  </div>
                </div>
              </>
            ) : (
              /* Quota Info for Documents tab */
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-cyan-500" />
                <h3 className="text-lg font-be-vietnam font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-cyan-500" />
                  Hạn ngạch RAG
                </h3>
                
                {quota ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Số tài liệu đã tải:</span>
                        <span className="text-cyan-600">{quota.documents_used}/{quota.documents_limit}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min((quota.documents_used / quota.documents_limit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 leading-normal space-y-1">
                      <p>• Loại file hỗ trợ: PDF, Word (.docx), TXT, Markdown (.md), hình ảnh...</p>
                      <p>• Dung lượng tối đa: {user?.subscription_tier === 'free' ? '2MB' : '100MB'} / tệp</p>
                      <p>• Tự động nhúng Vector và phân tách thành các mảnh tri thức phục vụ RAG.</p>
                    </div>

                    {quota.subscription_tier === 'free' && (
                      <div className="pt-2">
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-700 text-xs font-medium leading-relaxed">
                          ⚡ Bạn đang dùng gói Free với giới hạn 3 tài liệu. Nâng cấp lên gói PRO để tải lên hàng trăm tài liệu lớn (lên tới 100MB mỗi file)!
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Đang tải hạn ngạch...
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* RIGHT COLUMN - Forms according to activeTab */}
          <div className="lg:col-span-2 space-y-6">
            
            {activeTab === 'profile' && (
              <>
                {/* Profile Form */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft">
                  <h3 className="text-xl font-be-vietnam font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <User className="text-primary-600" size={24} />
                    Cập nhật thông tin
                  </h3>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tên đăng nhập</label>
                        <div className="relative">
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            value={profileForm.username} 
                            onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                            required 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Họ tên</label>
                        <div className="relative">
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            value={profileForm.full_name} 
                            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
                        <div className="relative">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="email" 
                            value={profileForm.email} 
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Số điện thoại</label>
                        <div className="relative">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            value={profileForm.phone} 
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-primary-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
                      >
                        <Save size={18} />
                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Password Form */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft">
                  <h3 className="text-xl font-be-vietnam font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <Lock className="text-amber-500" size={24} />
                    Đổi mật khẩu
                  </h3>
                  
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mật khẩu mới</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="password" 
                            value={profileForm.new_password} 
                            onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm" 
                            required 
                            minLength={6} 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="password" 
                            value={profileForm.confirm_password} 
                            onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm" 
                            required 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
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
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft">
                <h3 className="text-xl font-be-vietnam font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <Sparkles className="text-violet-600" size={24} />
                  Cấu hình AI & Trợ lý RAG
                </h3>
                
                <form onSubmit={handleUpdateAISettings} className="space-y-6">
                  {isStaff && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 text-xs font-semibold leading-relaxed flex items-center gap-3">
                      <AlertCircle size={18} className="shrink-0" />
                      <span>⚠️ Các cấu hình AI này được thiết lập tập trung bởi Quản trị viên công ty của bạn để đảm bảo tính đồng bộ dữ liệu. Bạn chỉ có quyền xem, không có quyền chỉnh sửa.</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Temperature */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ sáng tạo (Temperature)</label>
                        <span className="text-xs font-mono font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{aiSettings.temperature}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.5" 
                        step="0.1"
                        value={aiSettings.temperature} 
                        disabled={isStaff}
                        onChange={(e) => setAiSettings({ ...aiSettings, temperature: parseFloat(e.target.value) })} 
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600" 
                      />
                      <p className="text-[10px] text-slate-400 leading-normal">Giá trị càng thấp, câu trả lời càng chính xác và nhất quán. Giá trị cao giúp câu trả lời đa dạng hơn.</p>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ dài câu trả lời (Max Tokens)</label>
                      <select
                        value={aiSettings.preferred_max_tokens}
                        disabled={isStaff}
                        onChange={(e) => setAiSettings({ ...aiSettings, preferred_max_tokens: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm font-medium"
                      >
                        <option value="256">Ngắn gọn (256 tokens)</option>
                        <option value="512">Trung bình (512 tokens)</option>
                        <option value="1024">Dài (1024 tokens)</option>
                        <option value="2048">Rất dài (2048 tokens)</option>
                      </select>
                    </div>

                    {/* Response Style */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phong cách phản hồi mặc định</label>
                      <select
                        value={aiSettings.response_style}
                        disabled={isStaff}
                        onChange={(e) => setAiSettings({ ...aiSettings, response_style: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm font-medium"
                      >
                        <option value="concise">Tóm tắt ngắn gọn</option>
                        <option value="normal">Bình thường đầy đủ</option>
                        <option value="detailed">Chi tiết từng bước</option>
                      </select>
                    </div>

                    {/* Show Sources */}
                    <div className="space-y-2 flex flex-col justify-center">
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Hiển thị nguồn trích dẫn</span>
                          <span className="text-[10px] text-slate-400">Trích dẫn tài liệu gốc dưới câu trả lời</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={aiSettings.show_sources} 
                          disabled={isStaff}
                          onChange={(e) => setAiSettings({ ...aiSettings, show_sources: e.target.checked })}
                          className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Ollama Endpoint */}
                    <div className="space-y-2 col-span-1 md:col-span-2 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đường dẫn Ollama Local</label>
                          {(user?.subscription_tier === 'free' || isStaff) && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-violet-500/15 border border-violet-500/25 text-violet-600">PRO FEATURE</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">Cấu hình kết nối LLM Offline</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={aiSettings.ollama_endpoint} 
                          disabled={user?.subscription_tier === 'free' || isStaff}
                          onChange={(e) => setAiSettings({ ...aiSettings, ollama_endpoint: e.target.value })} 
                          className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm font-mono ${user?.subscription_tier === 'free' || isStaff ? 'opacity-60 cursor-not-allowed select-none bg-slate-100/50' : ''}`}
                          placeholder="http://localhost:11434"
                        />
                      </div>
                      {user?.subscription_tier === 'free' && !isStaff && (
                        <p className="text-[10px] text-violet-600 font-semibold tracking-wide mt-1">
                          ⚡ Vui lòng nâng cấp lên gói PRO để tùy biến kết nối Ollama Local chạy offline cục bộ.
                        </p>
                      )}
                    </div>

                    {/* Receive Community Knowledge */}
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 block">Nhận tri thức cộng đồng</span>
                            {(user?.subscription_tier === 'free' || isStaff) && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-violet-500/15 border border-violet-500/25 text-violet-600">PRO FEATURE</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">Được phép tham khảo vector tri thức dùng chung của cộng đồng</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={aiSettings.receive_community_knowledge} 
                          disabled={user?.subscription_tier === 'free' || isStaff}
                          onChange={(e) => setAiSettings({ ...aiSettings, receive_community_knowledge: e.target.checked })}
                          className={`w-4 h-4 rounded text-violet-600 focus:ring-violet-500 ${user?.subscription_tier === 'free' || isStaff ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        />
                      </div>
                    </div>

                  </div>

                  {!isStaff && (
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-violet-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
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
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-be-vietnam font-bold text-slate-900 flex items-center gap-3">
                    <FileText className="text-cyan-600" size={24} />
                    Tài liệu RAG cá nhân
                  </h3>
                  <button
                    onClick={fetchDocuments}
                    disabled={fetchingDocs}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    title="Làm mới danh sách"
                  >
                    <RefreshCw size={16} className={fetchingDocs ? "animate-spin" : ""} />
                  </button>
                </div>

                <p className="text-slate-500 text-xs leading-relaxed">
                  Tải lên tài liệu của riêng bạn (.pdf, .docx, .txt, .md...). Trợ lý AI sẽ tự động phân tách, nhúng vector tri thức và ưu tiên sử dụng các tài liệu này để trả lời khi bạn trò chuyện trong luồng RAG cá nhân.
                </p>

                {/* Upload area */}
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 text-center hover:border-cyan-500 transition-colors relative group bg-slate-50/50">
                  <input
                    type="file"
                    id="personal-doc-upload"
                    onChange={handleUploadFile}
                    disabled={uploading}
                    accept=".pdf,.docx,.txt,.pptx,.xlsx,.csv,.html,.htm,.md,.png,.jpg,.jpeg"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-cyan-50/50 group-hover:scale-105 transition-transform">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        {uploading ? 'Đang phân tích & trích xuất tài liệu...' : 'Kéo thả hoặc nhấp để chọn tệp'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Hỗ trợ PDF, DOCX, TXT, MD, PPTX, hình ảnh...<br />
                        Dung lượng tối đa: {user?.subscription_tier === 'free' ? '2MB' : '100MB'}
                      </p>
                    </div>
                    {uploading && (
                      <div className="w-48 h-1 bg-slate-100 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-cyan-600 rounded-full animate-progress-bar" style={{ width: '60%' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Danh sách tài liệu ({documents.length})</h4>
                  
                  {fetchingDocs ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Đang tải danh sách tài liệu...
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-10 border border-slate-100 rounded-2xl text-slate-400 text-xs bg-slate-50/20">
                      Chưa có tài liệu cá nhân nào được tải lên.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                      {documents.map((doc) => (
                        <div key={doc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-cyan-50/80 text-cyan-600 flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate" title={doc.original_name}>
                                {doc.original_name}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {(doc.file_size / 1024).toFixed(1)} KB • {doc.chunk_count || 0} mảnh • {new Date(doc.uploaded_at).toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteDoc(doc.id, doc.original_name)}
                            disabled={loading}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors active:scale-95 shrink-0 disabled:opacity-50"
                            title="Xóa tài liệu"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
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
