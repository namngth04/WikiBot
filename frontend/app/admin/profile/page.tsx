'use client';

import { useState } from 'react';
import { usersAPI } from '@/app/lib/api';
import { useAuth } from '@/app/context/auth-context';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
    new_password: '',
    confirm_password: '',
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await usersAPI.updateMe({
        username: profileForm.username,
        full_name: profileForm.full_name,
        email: profileForm.email,
        phone: profileForm.phone,
        department: profileForm.department,
      });
      const updatedUser = response.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      alert('Cập nhật thông tin thành công!');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Cập nhật thất bại');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.new_password !== profileForm.confirm_password) {
      alert('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (profileForm.new_password.length < 6) {
      alert('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    try {
      await usersAPI.updateMe({ password: profileForm.new_password });
      setProfileForm(prev => ({ ...prev, new_password: '', confirm_password: '' }));
      alert('Đổi mật khẩu thành công!');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Đổi mật khẩu thất bại');
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-6">Thông tin cá nhân</h2>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium mb-4">Cập nhật thông tin</h3>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
            <input type="text" value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
            <input type="text" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input type="text" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
            <input type="text" value={profileForm.department} onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Cập nhật thông tin</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Đổi mật khẩu</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
            <input type="password" value={profileForm.new_password} onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
            <input type="password" value={profileForm.confirm_password} onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Đổi mật khẩu</button>
          </div>
        </form>
      </div>
    </div>
  );
}
