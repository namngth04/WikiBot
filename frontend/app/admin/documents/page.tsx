'use client';

import { useState, useEffect } from 'react';
import { documentsAPI, rolesAPI } from '@/app/lib/api';
import { Document, Role } from '@/app/lib/types';
import {
  Trash2, Edit2, Upload, X, Check, Search, RefreshCw, FileText, Filter, Save, Globe, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="bg-primary-50 p-3 rounded-2xl text-primary-600">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-be-vietnam font-bold text-slate-900">Quản lý Tài liệu</h2>
            <p className="text-xs text-slate-400 font-medium">Lưu trữ và phân quyền truy cập tri thức nội bộ</p>
          </div>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary"
        >
          <Upload size={20} />
          Tải lên tài liệu
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              value={docSearchQuery}
              onChange={(e) => setDocSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none"
            />
          </div>
          <button className="btn-secondary py-3">
            <Filter size={18} />
            Phân loại
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài liệu</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Định dạng</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dung lượng</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quyền truy cập</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : filteredDocuments.map((doc) => (
                <tr key={doc.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    {editingDocId === doc.id ? (
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="text"
                          className="px-3 py-1.5 border border-primary-500 rounded-lg text-sm w-full outline-none"
                          value={editDocName}
                          onChange={(e) => setEditDocName(e.target.value)}
                          autoFocus
                        />
                        <button onClick={() => handleUpdateDocName(doc.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={() => { setEditingDocId(null); setEditDocName(''); }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm line-clamp-1">{doc.original_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">ID: DOC-{doc.id}</p>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                      {doc.file_type}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-be-vietnam font-medium text-slate-600">{formatFileSize(doc.file_size)}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="relative group/select inline-block">
                      <select
                        value={doc.role_id || ''}
                        onChange={(e) => handleUpdateDocRole(doc.id, e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 pr-8 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-primary-500/10 outline-none cursor-pointer"
                      >
                        <option value="">Công khai (Public)</option>
                        {roles.filter(r => r.level !== 0).map((role) => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        {doc.role_id ? <Shield size={12} /> : <Globe size={12} />}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingDocId(doc.id); setEditDocName(doc.original_name); }}
                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-white rounded-xl shadow-sm transition-all"
                        title="Đổi tên"
                      >
                        <Edit2 size={16} />
                      </button>
                      <label 
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-white rounded-xl shadow-sm transition-all cursor-pointer"
                        title="Cập nhật phiên bản mới"
                      >
                        <RefreshCw size={16} />
                        <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => handleReupload(e, doc.id, doc.role_id)} />
                      </label>
                      <button 
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl shadow-sm transition-all"
                        title="Xóa tài liệu"
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

      {/* Slide-over Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadModal(false)}
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
                  <h3 className="text-2xl font-be-vietnam font-bold text-slate-900">Tải lên tài liệu</h3>
                  <p className="text-sm text-slate-400 font-medium">Bổ sung tri thức vào hệ thống RAG</p>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="flex-1 p-8 space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chọn tệp tin</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".pdf,.docx,.txt" 
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      required 
                    />
                    <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 group-hover:border-primary-400 transition-all bg-slate-50/50">
                      <div className="p-4 bg-white rounded-2xl shadow-sm text-primary-600">
                        <Upload size={32} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-900">
                          {uploadFile ? uploadFile.name : 'Nhấn để chọn hoặc kéo thả file'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Hỗ trợ PDF, DOCX, TXT (Tối đa 20MB)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quyền truy cập</label>
                  <select 
                    value={uploadRoleId} 
                    onChange={(e) => setUploadRoleId(e.target.value)} 
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/10 transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Mọi người (Public)</option>
                    {roles.filter(r => r.level !== 0).map((role) => (
                      <option key={role.id} value={role.id}>Chỉ dành cho {role.name}</option>
                    ))}
                  </select>
                </div>
              </form>

              <div className="p-8 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary flex-1 justify-center py-4"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleUpload}
                  className="btn-primary flex-1 justify-center py-4 shadow-lg shadow-primary-200"
                >
                  <Save size={20} />
                  Bắt đầu tải lên
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
