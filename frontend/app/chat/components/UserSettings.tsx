'use client';

import { useState } from 'react';
import { usersAPI } from '@/app/lib/api';
import {
  ArrowLeft, User, Mail, Phone, Lock, Save, 
  ShieldCheck, AlertCircle, Camera, CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';

export function UserSettings({ onBack, user }: { onBack: () => void; user: any }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    new_password: '',
    confirm_password: '',
  });

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
            <p className="text-sm text-slate-500">Quản lý thông tin cá nhân</p>
          </div>
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
          {/* Left - Avatar card */}
          <div className="lg:col-span-1 space-y-6">
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
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">Người dùng</p>
                
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
          </div>
          
          {/* Right - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile form */}
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

            {/* Password form */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
