'use client';

import { useState, useEffect, useMemo } from 'react';
import { rolesAPI } from '@/app/lib/api';
import { Role, FilterSection, SortOption } from '@/app/lib/types';
import {
  Plus, Trash2, Edit2, X, Shield, Filter, Save, Info, Award, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/app/components/ui/ModalPortal';
import FilterDropdown from '@/app/components/ui/FilterDropdown';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', level: 2 });
  
  // Filter states
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredRoles = useMemo(() => {
    let filtered = roles.filter(role => 
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description?.toLowerCase().includes(search.toLowerCase()))
    );

    // Filter by levels
    if (selectedLevels.length > 0) {
      filtered = filtered.filter(role => 
        selectedLevels.includes(role.level.toString())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'level':
          aValue = a.level;
          bValue = b.level;
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [roles, search, selectedLevels, sortBy, sortOrder]);

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
      alert(error.response?.data?.detail || 'Tạo vai trò thất bại');
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
    if (!confirm('Bạn có chắc muốn xóa vai trò này?')) return;
    try {
      await rolesAPI.delete(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Xóa thất bại');
    }
  };

  const clearAllFilters = () => {
    setSelectedLevels([]);
    setSortBy('name');
    setSortOrder('asc');
  };

  // Filter sections for FilterDropdown
  const filterSections: FilterSection[] = [
    {
      title: 'Vai trò',
      type: 'checkbox',
      key: 'levels',
      options: roles.filter(r => r.level !== 0).map(role => ({
        value: role.level.toString(),
        label: `${role.name} (Level ${role.level})`,
        count: 1
      })).filter(option => option.count > 0),
      selected: selectedLevels,
      onChange: setSelectedLevels
    }
  ];

  const sortOptions: SortOption[] = [
    { value: 'name', label: 'Tên vai trò' },
    { value: 'level', label: 'Cấp độ' },
    { value: 'created_at', label: 'Ngày tạo' }
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-1 p-6 rounded-[2rem] border border-hairline shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 dark:bg-primary-950/30 p-3 rounded-2xl text-primary-600">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-xl font-be-vietnam font-bold text-ink">Quản lý Vai trò</h2>
            <p className="text-xs text-ink-subtle font-medium">Thiết lập cấp độ truy cập cho nhân sự</p>
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
          Thêm Vai trò
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-1 p-6 rounded-3xl border border-hairline shadow-sm">
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Tổng vai trò</p>
          <h3 className="text-2xl font-be-vietnam font-bold text-ink">{roles.length}</h3>
        </div>
        <div className="bg-surface-1 p-6 rounded-3xl border border-hairline shadow-sm">
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Cấp độ cao nhất</p>
          <h3 className="text-2xl font-be-vietnam font-bold text-emerald-600 dark:text-emerald-500">
            {roles.length > 0 ? Math.max(...roles.map(r => r.level)) : 0}
          </h3>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-surface-1 rounded-[2rem] shadow-sm border border-hairline">
        <div className="p-6 border-b border-hairline flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm vai trò..."
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
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Vai trò</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Mô tả</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Cấp độ</th>
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
              ) : filteredRoles.filter(role => role.level !== 0).map((role) => (
                <motion.tr 
                  key={role.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group hover:bg-surface-2/50 transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/20 text-primary-600 flex items-center justify-center">
                        <Award size={20} />
                      </div>
                      <span className="font-bold text-ink">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-ink-muted max-w-xs">
                    <p className="truncate">{role.description || 'Chưa có mô tả'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700/50">
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
                        className="p-2 text-ink-subtle hover:text-primary-600 hover:bg-surface-2 dark:hover:bg-surface-3 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-2 text-ink-subtle hover:text-rose-600 hover:bg-rose-950/20 rounded-xl transition-all"
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
      <ModalPortal>
        <AnimatePresence>
          {showRoleModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRoleModal(false)}
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
                    {editingRole ? 'Sửa Vai trò' : 'Thêm Vai trò'}
                  </h3>
                  <p className="text-sm text-ink-subtle font-medium">Thiết lập định danh và cấp độ bảo mật</p>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="p-2 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-surface-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Tên vai trò *</label>
                  <input
                    type="text"
                    required
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                    placeholder="VD: Trưởng phòng"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Mô tả chi tiết</label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    className="w-full px-5 py-4 bg-surface-2 border border-hairline text-ink rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none min-h-[120px]"
                    placeholder="Mô tả về quyền hạn và trách nhiệm của vai trò..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Cấp độ bảo mật (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={roleForm.level || 1}
                    onChange={(e) => setRoleForm({ ...roleForm, level: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 bg-surface-2 border border-hairline text-ink rounded-xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
                  />
                  <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/20 dark:border-amber-900/30 rounded-2xl mt-2">
                    <Info size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                      Cấp độ càng thấp (gần 1) quyền hạn càng cao. Level 1 thường dành cho lãnh đạo, Level 2-5 dành cho quản lý, và 6-10 cho nhân viên.
                    </p>
                  </div>
                </div>
              </form>

              <div className="p-4 border-t border-hairline flex items-center gap-3 shrink-0 bg-surface-1 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn-secondary flex-1 justify-center py-4"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={editingRole ? handleUpdateRole : handleCreateRole}
                  className="btn-primary flex-1 justify-center py-4 shadow-lg shadow-primary-200/30"
                >
                  <Save size={20} />
                  {editingRole ? 'Cập nhật' : 'Tạo vai trò'}
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
