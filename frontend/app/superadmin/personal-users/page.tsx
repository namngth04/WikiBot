'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { 
  Users, Search, Lock, Unlock, Trash2, ShieldAlert, Loader2, RefreshCw, FileText, MessageSquare, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PersonalUserData {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
  doc_count: number;
  conv_count: number;
}

export default function PersonalUsersPage() {
  const [personalUsers, setPersonalUsers] = useState<PersonalUserData[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [personalSearchTerm, setPersonalSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [actionLoadingUserId, setActionLoadingUserId] = useState<number | null>(null);

  // Delete states
  const [deleteUserModal, setDeleteUserModal] = useState<{ isOpen: boolean; userId: number | null; username: string }>({ 
    isOpen: false, 
    userId: null, 
    username: '' 
  });
  const [confirmInput, setConfirmInput] = useState('');

  const fetchPersonalUsers = async () => {
    setLoadingPersonal(true);
    try {
      const res = await api.get('/admin/users/personal');
      setPersonalUsers(res.data);
    } catch (err) {
      console.error('Error fetching personal users:', err);
    } finally {
      setLoadingPersonal(false);
    }
  };

  useEffect(() => {
    fetchPersonalUsers();
  }, []);

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    setActionLoadingUserId(userId);
    const newStatus = !currentStatus;
    try {
      await api.put(`/admin/users/${userId}/status?is_active=${newStatus}`);
      setPersonalUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u)
      );
    } catch (err) {
      console.error('Error updating user status:', err);
      alert('Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const handleDeletePersonalUser = async () => {
    if (!deleteUserModal.userId) return;
    setActionLoadingUserId(deleteUserModal.userId);
    try {
      await api.delete(`/admin/users/personal/${deleteUserModal.userId}`);
      setDeleteUserModal({ isOpen: false, userId: null, username: '' });
      setConfirmInput('');
      fetchPersonalUsers();
      alert('Đã xóa người dùng cá nhân thành công!');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert(err.response?.data?.detail || 'Không thể xóa người dùng cá nhân. Vui lòng thử lại.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const filteredPersonalUsers = personalUsers.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(personalSearchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(personalSearchTerm.toLowerCase())) ||
      (u.full_name && u.full_name.toLowerCase().includes(personalSearchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'active'
        ? u.is_active
        : !u.is_active;
    const matchesTier = tierFilter === 'all'
      ? true
      : tierFilter === 'pro'
        ? u.subscription_tier === 'pro'
        : u.subscription_tier !== 'pro';
    return matchesSearch && matchesStatus && matchesTier;
  });

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Quản lý Người dùng cá nhân
            <span className="text-[10px] font-mono border border-hairline bg-surface-2 px-1.5 py-0.5 rounded text-ink-subtle">
              {filteredPersonalUsers.length}
            </span>
          </h3>

        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 text-ink-subtle" size={12} />
            <input
              type="text"
              placeholder="Tìm username, email, họ tên..."
              value={personalSearchTerm}
              onChange={(e) => setPersonalSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender transition-colors cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="blocked">Bị khóa</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender transition-colors cursor-pointer"
          >
            <option value="all">Tất cả dịch vụ</option>
            <option value="free">FREE</option>
            <option value="pro">PRO</option>
          </select>
          <button
            onClick={fetchPersonalUsers}
            disabled={loadingPersonal}
            className="p-1.5 rounded-lg border border-hairline hover:bg-surface-2 text-ink-subtle hover:text-ink transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw size={12} className={loadingPersonal ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        {loadingPersonal ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
            <span className="text-xs text-ink-subtle">Đang tải danh sách người dùng...</span>
          </div>
        ) : filteredPersonalUsers.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-subtle">
            Không tìm thấy người dùng cá nhân nào.
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline text-ink-subtle select-none h-10 uppercase tracking-wider text-[10px]">
                <th className="font-bold pb-3 pl-2">NGƯỜI DÙNG</th>
                <th className="font-bold pb-3">GÓI DỊCH VỤ</th>
                <th className="font-bold pb-3 text-center">TÀI LIỆU</th>
                <th className="font-bold pb-3 text-center">HỘI THOẠI</th>
                <th className="font-bold pb-3">NGÀY THAM GIA</th>
                <th className="font-bold pb-3">TRẠNG THÁI</th>
                <th className="font-bold pb-3 pr-2 text-right">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredPersonalUsers.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2/40 transition-colors h-14">
                  <td className="pl-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5e6ad2]/30 to-[#8b5cf6]/20 border border-[#5e6ad2]/30 flex items-center justify-center text-[10px] font-bold text-brand-lavender uppercase flex-shrink-0">
                        {u.username.substring(0, 2)}
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-ink">{u.username}</span>
                        <span className="text-[10px] text-ink-subtle">{u.email || 'Chưa có email'}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {u.subscription_tier === 'pro' ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 inline-flex items-center gap-1">
                        ⚡ PRO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-surface-2 border border-hairline text-ink-muted">
                        FREE
                      </span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1 text-ink font-semibold">
                      <FileText size={11} className="text-ink-subtle" />
                      {u.doc_count}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1 text-ink font-semibold">
                      <MessageSquare size={11} className="text-ink-subtle" />
                      {u.conv_count}
                    </span>
                  </td>
                  <td className="text-ink-muted font-medium">
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="text-ink-subtle" />
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-500'}`} />
                      <span className={`text-[10px] font-semibold ${u.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                        {u.is_active ? 'Active' : 'Blocked'}
                      </span>
                    </div>
                  </td>
                  <td className="pr-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                        disabled={actionLoadingUserId !== null}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                          u.is_active
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        } disabled:opacity-50 flex items-center gap-1.5`}
                      >
                        {actionLoadingUserId === u.id ? (
                          <Loader2 className="animate-spin" size={10} />
                        ) : u.is_active ? (
                          <><Lock size={10} /> Khóa</>  
                        ) : (
                          <><Unlock size={10} /> Mở khóa</>
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteUserModal({ isOpen: true, userId: u.id, username: u.username })}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors"
                        title="Xóa người dùng vĩnh viễn"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal xác nhận xóa Personal User */}
      <AnimatePresence>
        {deleteUserModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setDeleteUserModal({ isOpen: false, userId: null, username: '' }); setConfirmInput(''); }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0f1011] border border-red-500/20 p-6 rounded-2xl shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#23252a]/60">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Xóa người dùng vĩnh viễn</h3>
                  <p className="text-[10px] text-red-400 font-medium">Hành động này KHÔNG THỂ HOÀN TÁC</p>
                </div>
              </div>

              <div className="text-xs text-[#8a8f98] leading-relaxed space-y-2">
                <p>Tài khoản của người dùng cá nhân <strong>{deleteUserModal.username}</strong>, cùng toàn bộ file tải lên và lịch sử trò chuyện sẽ bị xóa sạch khỏi hệ thống.</p>
                <p>Vui lòng gõ lại tên tài khoản <strong>{deleteUserModal.username}</strong> để xác nhận hành động xóa:</p>
              </div>

              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={deleteUserModal.username}
                className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-red-500/50 transition-colors"
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setDeleteUserModal({ isOpen: false, userId: null, username: '' }); setConfirmInput(''); }}
                  className="px-4 py-2 text-xs font-bold border border-[#23252a] hover:bg-[#141516] rounded-lg text-[#8a8f98] hover:text-white transition-colors flex-1"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleDeletePersonalUser}
                  disabled={confirmInput !== deleteUserModal.username || actionLoadingUserId !== null}
                  className="px-4 py-2 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 flex-1"
                >
                  {actionLoadingUserId === deleteUserModal.userId ? <Loader2 className="animate-spin" size={12} /> : "Xác nhận xóa"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
