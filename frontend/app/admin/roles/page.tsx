'use client';

import { useState, useEffect } from 'react';
import { rolesAPI } from '@/app/lib/api';
import { Role } from '@/app/lib/types';
import {
  Plus, Trash2, Edit2, X, Shield, Filter, Save, Info, Award, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', level: 2 });

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(search.toLowerCase()) ||
    (role.description?.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await rolesAPI.list();
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rolesAPI.create(roleForm);
      setShowRoleModal(false);
      setRoleForm({ name: '', description: '', level: 2 });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Tạo chức vụ thất bại');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    try {
      await rolesAPI.update(editingRole.id, roleForm);
      setShowRoleModal(false);
      setEditingRole(null);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Cập nhật thất bại');
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa chức vụ này?')) return;
    try {
      await rolesAPI.delete(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 p-3 rounded-2xl text-primary-600">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-xl font-be-vietnam font-bold text-slate-900">Quản lý Chức vụ</h2>
            <p className="text-xs text-slate-400 font-medium">Thiết lập cấp độ truy cập cho nhân sự</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingRole(null);
            setRoleForm({ name: '', description: '', level: 2 });
            setShowRoleModal(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} />
          Thêm Chức vụ
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng chức vụ</p>
          <h3 className="text-2xl font-be-vietnam font-bold text-slate-900">{roles.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cấp độ cao nhất</p>
          <h3 className="text-2xl font-be-vietnam font-bold text-emerald-600">
            {roles.length > 0 ? Math.max(...roles.map(r => r.level)) : 0}
          </h3>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm chức vụ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
            />
          </div>
          <button className="btn-secondary py-3">
            <Filter size={18} />
            Lọc dữ liệu
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chức vụ</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mô tả</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cấp độ</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : filteredRoles.filter(role => role.level !== 0).map((role) => (
                <motion.tr 
                  key={role.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                        <Award size={20} />
                      </div>
                      <span className="font-bold text-slate-900">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-600 max-w-xs">
                    <p className="truncate">{role.description || 'Chưa có mô tả'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      Level {role.level}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { 
                          setEditingRole(role); 
                          setRoleForm({ name: role.name, description: role.description || '', level: role.level }); 
                          setShowRoleModal(true); 
                        }}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Role Modal */}
      <AnimatePresence>
        {showRoleModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRoleModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[60] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-be-vietnam font-bold text-slate-900">
                    {editingRole ? 'Sửa Chức vụ' : 'Thêm Chức vụ'}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">Thiết lập định danh và cấp độ bảo mật</p>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="flex-1 p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tên chức vụ *</label>
                  <input
                    type="text"
                    required
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                    placeholder="VD: Trưởng phòng"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mô tả chi tiết</label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none min-h-[120px]"
                    placeholder="Mô tả về quyền hạn và trách nhiệm của chức vụ..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cấp độ bảo mật (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={roleForm.level}
                    onChange={(e) => setRoleForm({ ...roleForm, level: parseInt(e.target.value) })}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                  />
                  <div className="flex items-start gap-2 p-4 bg-amber-50 rounded-2xl mt-2">
                    <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                      Cấp độ càng thấp (gần 1) quyền hạn càng cao. Level 1 thường dành cho lãnh đạo, Level 2-5 dành cho quản lý, và 6-10 cho nhân viên.
                    </p>
                  </div>
                </div>
              </form>

              <div className="p-8 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn-secondary flex-1 justify-center py-4"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={editingRole ? handleUpdateRole : handleCreateRole}
                  className="btn-primary flex-1 justify-center py-4 shadow-lg shadow-primary-200"
                >
                  <Save size={20} />
                  {editingRole ? 'Cập nhật' : 'Tạo chức vụ'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
