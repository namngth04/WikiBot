'use client';

import { useState, useEffect } from 'react';
import { documentsAPI, rolesAPI } from '@/app/lib/api';
import { Document, Role } from '@/app/lib/types';
import {
  Trash2, Edit, Upload, X, Check, Search, RefreshCw
} from 'lucide-react';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRoleId, setUploadRoleId] = useState<string>('');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editDocName, setEditDocName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, docsRes] = await Promise.all([
        rolesAPI.list(),
        documentsAPI.list()
      ]);
      setRoles(rolesRes.data);
      setDocuments(docsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    try {
      await documentsAPI.upload(uploadFile, uploadRoleId ? parseInt(uploadRoleId) : null);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadRoleId('');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Upload thất bại');
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      await documentsAPI.delete(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Xóa thất bại');
    }
  };

  const handleUpdateDocRole = async (docId: number, roleId: string) => {
    try {
      await documentsAPI.updateDocument(docId, { role_id: roleId ? parseInt(roleId) : null });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Cập nhật thất bại');
    }
  };

  const handleUpdateDocName = async (docId: number) => {
    if (!editDocName.trim()) return;
    try {
      await documentsAPI.updateDocument(docId, { original_name: editDocName.trim() });
      setEditingDocId(null);
      setEditDocName('');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Đổi tên thất bại');
    }
  };

  const handleReupload = async (e: React.ChangeEvent<HTMLInputElement>, oldDocId: number, roleId: number | null) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Bạn có chắc muốn thay thế tài liệu này bằng file mới? Tài liệu cũ sẽ bị xóa.')) {
      e.target.value = '';
      return;
    }
    try {
      await documentsAPI.upload(file, roleId);
      await documentsAPI.delete(oldDocId);
      alert('Reupload thành công!');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Reupload thất bại');
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.original_name.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Danh sách Tài liệu</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-64"
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload size={18} />
            Upload Tài liệu
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tên file</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Loại</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Kích thước</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Chức vụ</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {editingDocId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="px-2 py-1 border border-blue-500 rounded focus:ring-1 focus:ring-blue-500 text-sm w-full"
                        value={editDocName}
                        onChange={(e) => setEditDocName(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdateDocName(doc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check size={16} />
                      </button>
                      <button onClick={() => { setEditingDocId(null); setEditDocName(''); }} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span>{doc.original_name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm uppercase">{doc.file_type}</td>
                <td className="px-4 py-3 text-sm">{formatFileSize(doc.file_size)}</td>
                <td className="px-4 py-3 text-sm">
                  <select
                    value={doc.role_id || ''}
                    onChange={(e) => handleUpdateDocRole(doc.id, e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="">Public</option>
                    {roles.filter(r => r.level !== 0).map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button onClick={() => { setEditingDocId(doc.id); setEditDocName(doc.original_name); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Đổi tên">
                      <Edit size={16} />
                    </button>
                    <label className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer" title="Reupload (Thay thế file)">
                      <RefreshCw size={16} />
                      <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => handleReupload(e, doc.id, doc.role_id)} />
                    </label>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Xóa">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Upload Tài liệu</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF, DOCX, TXT)</label>
                <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ (để trống = Public)</label>
                <select value={uploadRoleId} onChange={(e) => setUploadRoleId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Public (tất cả có thể xem)</option>
                  {roles.filter(r => r.level !== 0).map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
