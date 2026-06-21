'use client';

import { useState, useEffect, useMemo } from 'react';
import { usersAPI, rolesAPI } from '@/app/lib/api';
import { User, Role, FilterSection, SortOption } from '@/app/lib/types';
import {
  Plus, Trash2, Edit2, X, Users, Search, Filter, Save, Mail, Phone, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/app/components/ui/ModalPortal';
import FilterDropdown from '@/app/components/ui/FilterDropdown';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Filter states
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('username');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [userForm, setUserForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, usersRes] = await Promise.all([
        rolesAPI.list(),
        usersAPI.list()
      ]);
      setRoles(rolesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await usersAPI.create({
        ...userForm,
        role_id: userForm.role_id ? parseInt(userForm.role_id) : null,
      });
      setShowUserModal(false);
      setUserForm({
        username: '', full_name: '', email: '', phone: '',
        password: '', role_id: ''
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Tạo người dùng thất bại');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const updatePayload: any = {
        username: userForm.username,
        full_name: userForm.full_name,
        email: userForm.email,
        phone: userForm.phone,
        role_id: userForm.role_id ? parseInt(userForm.role_id) : null,
      };
      if (userForm.password.trim() !== '') {
        updatePayload.password = userForm.password;
      }
      await usersAPI.update(editingUser.id, updatePayload);
      setShowUserModal(false);
      setEditingUser(null);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Cập nhật thất bại');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;
    try {
      await usersAPI.delete(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Xóa thất bại');
    }
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role_id: user.role_id?.toString() || '',
    });
    setShowUserModal(true);
  };

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setSortBy('username');
    setSortOrder('asc');
  };

  // Filter sections for FilterDropdown
  const filterSections: FilterSection[] = [
    {
      title: 'Vai trò',
      type: 'checkbox',
      key: 'roles',
      options: roles.filter(r => r.level !== 0).map(role => ({
        value: role.id.toString(),
        label: role.name,
        count: users.filter(u => u.role_id === role.id).length
      })).filter(option => option.count > 0),
      selected: selectedRoles,
      onChange: setSelectedRoles
    }
  ];

  const sortOptions: SortOption[] = [
    { value: 'username', label: 'Tên đăng nhập' },
    { value: 'full_name', label: 'Họ tên' },
    { value: 'created_at', label: 'Ngày tạo' },
    { value: 'level', label: 'Cấp độ' }
  ];

  const filteredUsers = useMemo(() => {
    let filtered = users.filter(u => 
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name?.toLowerCase().includes(search.toLowerCase())) ||
      (u.email?.toLowerCase().includes(search.toLowerCase()))
    );

    // Filter by roles
    if (selectedRoles.length > 0) {
      filtered = filtered.filter(user => 
        user.role_id && selectedRoles.includes(user.role_id.toString())
      );
    }


    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'username':
          aValue = a.username.toLowerCase();
          bValue = b.username.toLowerCase();
          break;
        case 'full_name':
          aValue = (a.full_name || a.username).toLowerCase();
          bValue = (b.full_name || b.username).toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'level':
          aValue = a.role?.level || 999;
          bValue = b.role?.level || 999;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, search, selectedRoles, sortBy, sortOrder]);

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-1 p-6 rounded-[2rem] border border-hairline shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 dark:bg-primary-950/30 p-3 rounded-2xl text-primary-600">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-be-vietnam font-bold text-ink">Nhân viên hệ thống</h2>
            <p className="text-xs text-ink-subtle font-medium">Quản lý tài khoản và phân quyền truy cập</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setUserForm({
              username: '', full_name: '', email: '', phone: '',
              password: '', role_id: ''
            });
            setShowUserModal(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} />
          Thêm Nhân viên
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-1 p-6 rounded-3xl border border-hairline shadow-sm">
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Tổng nhân sự</p>
          <h3 className="text-2xl font-be-vietnam font-bold text-ink">{users.length}</h3>
        </div>
        <div className="bg-surface-1 p-6 rounded-3xl border border-hairline shadow-sm">
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Đang hoạt động</p>
          <h3 className="text-2xl font-be-vietnam font-bold text-emerald-600 dark:text-emerald-500">{users.length}</h3>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-1 rounded-[2rem] shadow-sm border border-hairline">
        <div className="p-6 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm nhân viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
            />
          </div>
          <FilterDropdown
            sections={filterSections}
            sortOptions={sortOptions}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={setSortBy}
            onClearAll={clearAllFilters}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Nhân viên</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Liên hệ</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Vai trò</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="group hover:bg-surface-2/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/20 text-primary-600 flex items-center justify-center font-bold text-sm shadow-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-ink text-sm">{user.full_name || user.username}</p>
                        <p className="text-[10px] text-ink-subtle font-bold uppercase tracking-wider">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <p className="text-xs text-ink-muted flex items-center gap-1.5">
                        <Mail size={12} className="text-ink-subtle" /> {user.email || '-'}
                      </p>
                      <p className="text-xs text-ink-muted flex items-center gap-1.5">
                        <Phone size={12} className="text-ink-subtle" /> {user.phone || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 border border-primary-200/20 px-3 py-1 rounded-full text-[10px] font-bold inline-flex">
                      <ShieldCheck size={12} />
                      {user.role?.name || 'Thành viên'}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditUser(user)}
                        disabled={user.role?.level === 0}
                        className={cn(
                          "p-2 rounded-xl shadow-sm transition-all",
                          user.role?.level === 0 ? "text-ink-tertiary bg-surface-2 cursor-not-allowed" : "text-ink-subtle hover:text-primary-600 hover:bg-surface-2 dark:hover:bg-surface-3"
                        )}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-ink-subtle hover:text-rose-600 hover:bg-rose-950/20 rounded-xl shadow-sm transition-all"
                      >
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

      {/* Slide-over User Modal */}
      <ModalPortal>
        <AnimatePresence>
          {showUserModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserModal(false)}
              className="modal-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="modal-content"
            >
              <div className="p-6 border-b border-hairline flex items-center justify-between shrink-0 bg-surface-1 rounded-t-3xl">
                <div>
                  <h3 className="text-2xl font-be-vietnam font-bold text-ink">
                    {editingUser ? 'Sửa Nhân viên' : 'Thêm Nhân viên'}
                  </h3>
                  <p className="text-sm text-ink-subtle font-medium">Thiết lập thông tin tài khoản nhân sự</p>
                </div>
                <button onClick={() => setShowUserModal(false)} className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-surface-1">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Tên đăng nhập *</label>
                    <input
                      type="text"
                      required
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Họ tên</label>
                    <input
                      type="text"
                      value={userForm.full_name}
                      onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                    placeholder="example@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Số điện thoại</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">
                    Mật khẩu {editingUser && '(để trống nếu không đổi)'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Vai trò</label>
                  <select
                    value={userForm.role_id}
                    onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Không có</option>
                    {roles.filter(role => role.level !== 0).map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </form>

              <div className="p-4 border-t border-hairline flex items-center gap-3 shrink-0 bg-surface-1 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="btn-secondary flex-1 justify-center py-4"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  className="btn-primary flex-1 justify-center py-4"
                >
                  <Save size={20} />
                  {editingUser ? 'Cập nhật' : 'Thêm Nhân viên'}
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
