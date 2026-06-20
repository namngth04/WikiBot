'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { useAuth } from '@/app/context/auth-context';
import { 
  User, Lock, Check, ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const { user } = useAuth();
  
  const [profileForm, setProfileForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    new_password: '',
    confirm_password: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || '',
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        new_password: '',
        confirm_password: '',
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(null);
    setProfileError(null);
    try {
      await api.put('/users/me', {
        username: profileForm.username,
        full_name: profileForm.full_name,
        email: profileForm.email,
        phone: profileForm.phone,
      });
      setProfileSuccess('Cập nhật thông tin thành công!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err.response?.data?.detail || 'Cập nhật thông tin thất bại');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.new_password !== profileForm.confirm_password) {
      setProfileError('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (profileForm.new_password.length < 6) {
      setProfileError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setProfileLoading(true);
    setProfileSuccess(null);
    setProfileError(null);
    try {
      await api.put('/users/me', { password: profileForm.new_password });
      setProfileForm(prev => ({ ...prev, new_password: '', confirm_password: '' }));
      setProfileSuccess('Đổi mật khẩu thành công!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err.response?.data?.detail || 'Đổi mật khẩu thất bại');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile messages */}
      {(profileSuccess || profileError) && (
        <div className="space-y-2 max-w-md mx-auto">
          {profileSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Check size={14} />
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert size={14} />
              {profileError}
            </div>
          )}
        </div>
      )}

      <div className="max-w-md mx-auto">
        {/* Change Password Card */}
        <div className="bg-surface-1 border border-hairline rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <Lock className="text-amber-500" size={16} />
            Đổi mật khẩu tài khoản Superadmin
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Mật khẩu mới</label>
              <input 
                type="password" 
                value={profileForm.new_password} 
                onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                className="w-full px-4 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender" 
                required 
                minLength={6}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                value={profileForm.confirm_password} 
                onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })} 
                className="w-full px-4 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender" 
                required 
              />
            </div>
            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={profileLoading}
                className="bg-brand-lavender hover:bg-brand-lavender/95 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Lock size={12} />
                {profileLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
