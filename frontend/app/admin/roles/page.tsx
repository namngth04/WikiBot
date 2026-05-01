'use client';

import { useState, useEffect } from 'react';
import { rolesAPI } from '@/app/lib/api';
import { Role } from '@/app/lib/types';
import {
  Plus, Trash2, Edit, X
} from 'lucide-react';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', level: 2 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await rolesAPI.list();
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to load roles:', error);
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Danh sách Chức vụ</h2>
        <button
          onClick={() => {
            setEditingRole(null);
            setRoleForm({ name: '', description: '', level: 2 });
            setShowRoleModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          Thêm Chức vụ
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tên</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Mô tả</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Cấp độ</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {roles.filter(role => role.level !== 0).map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{role.name}</td>
                <td className="px-4 py-3 text-sm">{role.description || '-'}</td>
                <td className="px-4 py-3 text-sm">{role.level}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, description: role.description || '', level: role.level }); setShowRoleModal(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded mr-2"><Edit size={16} /></button>
                  <button onClick={() => handleDeleteRole(role.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editingRole ? 'Sửa Chức vụ' : 'Thêm Chức vụ'}</h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên chức vụ *</label>
                <input type="text" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <input type="text" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cấp độ (1=Trưởng phòng, 2=Nhân viên)</label>
                <input type="number" min="1" max="10" value={roleForm.level} onChange={(e) => setRoleForm({ ...roleForm, level: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingRole ? 'Cập nhật' : 'Tạo mới'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
