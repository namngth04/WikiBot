'use client';

import { useState, useEffect } from 'react';
import { usersAPI, rolesAPI } from '@/app/lib/api';
import { User, Role } from '@/app/lib/types';
import {
  Plus, Trash2, Edit, X
} from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [userForm, setUserForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    department: '',
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
        department: '', password: '', role_id: ''
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
      await usersAPI.update(editingUser.id, {
        ...userForm,
        role_id: userForm.role_id ? parseInt(userForm.role_id) : null,
      });
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
      department: user.department || '',
      password: '',
      role_id: user.role_id?.toString() || '',
    });
    setShowUserModal(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Danh sách Nhân viên</h2>
        <button
          onClick={() => {
            setEditingUser(null);
            setUserForm({
              username: '', full_name: '', email: '', phone: '',
              department: '', password: '', role_id: ''
            });
            setShowUserModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          Thêm Nhân viên
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tên đăng nhập</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Họ tên</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Phòng ban</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Chức vụ</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{user.username}</td>
                <td className="px-4 py-3 text-sm">{user.full_name || '-'}</td>
                <td className="px-4 py-3 text-sm">{user.email || '-'}</td>
                <td className="px-4 py-3 text-sm">{user.department || '-'}</td>
                <td className="px-4 py-3 text-sm">{user.role?.name || 'Không có'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEditUser(user)}
                    disabled={user.role?.level === 0}
                    className={`p-1 rounded mr-2 ${
                      user.role?.level === 0
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                    title={user.role?.level === 0 ? 'Không thể sửa tài khoản Admin' : 'Sửa'}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingUser ? 'Sửa Nhân viên' : 'Thêm Nhân viên'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập *</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                <input
                  type="text"
                  value={userForm.department}
                  onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu {editingUser && '(để trống nếu không đổi)'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ</label>
                <select
                  value={userForm.role_id}
                  onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Không có</option>
                  {roles.filter(role => role.level !== 0).map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingUser ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
