'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { 
  Building, Search, Lock, Unlock, Trash2, ShieldAlert, Loader2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TenantData {
  tenant_id: number;
  company_name: string;
  invite_code: string;
  staff_count: number;
  doc_count: number;
  is_active: boolean;
  subscription_tier: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantSearchTerm, setTenantSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Delete modal states
  const [deleteTenantModal, setDeleteTenantModal] = useState<{ isOpen: boolean; tenantId: number | null; companyName: string }>({ 
    isOpen: false, 
    tenantId: null, 
    companyName: '' 
  });
  const [confirmInput, setConfirmInput] = useState('');

  const fetchTenants = async () => {
    setLoadingTenants(true);
    try {
      const res = await api.get('/admin/tenants');
      setTenants(res.data);
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleToggleTenant = async (tenantId: number, currentStatus: boolean) => {
    setActionLoadingId(tenantId);
    const newStatus = !currentStatus;
    try {
      await api.put(`/admin/tenants/${tenantId}/status?is_active=${newStatus}`);
      fetchTenants();
    } catch (err) {
      console.error('Error updating tenant status:', err);
      alert('Không thể cập nhật trạng thái doanh nghiệp. Vui lòng thử lại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deleteTenantModal.tenantId) return;
    setActionLoadingId(deleteTenantModal.tenantId);
    try {
      await api.delete(`/admin/tenants/${deleteTenantModal.tenantId}`);
      setDeleteTenantModal({ isOpen: false, tenantId: null, companyName: '' });
      setConfirmInput('');
      fetchTenants();
      alert('Đã xóa doanh nghiệp thành công!');
    } catch (err: any) {
      console.error('Error deleting tenant:', err);
      alert(err.response?.data?.detail || 'Không thể xóa doanh nghiệp. Vui lòng thử lại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.company_name.toLowerCase().includes(tenantSearchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'active'
        ? t.is_active
        : !t.is_active;
    const matchesTier = tierFilter === 'all'
      ? true
      : tierFilter === 'pro'
        ? t.subscription_tier === 'pro'
        : t.subscription_tier !== 'pro';
    return matchesSearch && matchesStatus && matchesTier;
  });

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-hairline pb-5">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          Quản lý Doanh nghiệp 
          <span className="text-[10px] font-mono border border-hairline bg-surface-2 px-1.5 py-0.5 rounded text-ink-subtle">
            {filteredTenants.length}
          </span>
        </h3>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 text-ink-subtle" size={12} />
            <input
              type="text"
              placeholder="Tìm tên doanh nghiệp..."
              value={tenantSearchTerm}
              onChange={(e) => setTenantSearchTerm(e.target.value)}
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
            <option value="suspended">Bị khóa</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender transition-colors cursor-pointer"
          >
            <option value="all">Tất cả gói cước</option>
            <option value="free">FREE</option>
            <option value="pro">PRO</option>
          </select>
          <button
            onClick={fetchTenants}
            disabled={loadingTenants}
            className="p-1.5 rounded-lg border border-hairline hover:bg-surface-2 text-ink-subtle hover:text-ink transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw size={12} className={loadingTenants ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        {loadingTenants ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
            <span className="text-xs text-ink-subtle">Đang tải danh sách Tenant...</span>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-subtle">
            Không tìm thấy doanh nghiệp nào.
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline text-ink-subtle select-none h-10 uppercase tracking-wider text-[10px]">
                <th className="font-bold pb-3 pl-2">DOANH NGHIỆP</th>
                <th className="font-bold pb-3 text-center">GÓI CƯỚC</th>
                <th className="font-bold pb-3 text-center">NHÂN SỰ</th>
                <th className="font-bold pb-3 text-center">TÀI LIỆU</th>
                <th className="font-bold pb-3">TRẠNG THÁI</th>
                <th className="font-bold pb-3 pr-2 text-right">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredTenants.map((t) => (
                <tr key={t.tenant_id} className="hover:bg-surface-2/40 transition-colors h-14">
                  <td className="pl-2 font-bold text-ink">
                    <div className="flex items-center gap-2">
                      <Building className="text-brand-lavender" size={14} />
                      {t.company_name}
                    </div>
                  </td>
                  <td className="text-center">
                    {t.subscription_tier === 'pro' ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 inline-flex items-center gap-1">
                        ⚡ PRO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-surface-2 border border-hairline text-ink-muted">
                        FREE
                      </span>
                    )}
                  </td>
                  <td className="text-center font-semibold text-ink">{t.staff_count}</td>
                  <td className="text-center font-semibold text-ink">{t.doc_count}</td>
                  <td>
                    {t.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 border border-red-500/30 text-red-400">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="pr-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleTenant(t.tenant_id, t.is_active)}
                        disabled={actionLoadingId !== null}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                          t.is_active
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        } disabled:opacity-50 flex items-center gap-1.5`}
                      >
                        {actionLoadingId === t.tenant_id ? (
                          <Loader2 className="animate-spin" size={10} />
                        ) : t.is_active ? (
                          <><Lock size={10} /> Khóa Tenant</>
                        ) : (
                          <><Unlock size={10} /> Kích hoạt</>
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteTenantModal({ isOpen: true, tenantId: t.tenant_id, companyName: t.company_name })}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors"
                        title="Xóa doanh nghiệp vĩnh viễn"
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

      {/* Modal xác nhận xóa Tenant */}
      <AnimatePresence>
        {deleteTenantModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setDeleteTenantModal({ isOpen: false, tenantId: null, companyName: '' }); setConfirmInput(''); }}
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
                  <h3 className="text-sm font-bold text-white">Xóa doanh nghiệp vĩnh viễn</h3>
                  <p className="text-[10px] text-red-400 font-medium">Hành động này KHÔNG THỂ HOÀN TÁC</p>
                </div>
              </div>

              <div className="text-xs text-[#8a8f98] leading-relaxed space-y-2">
                <p>Toàn bộ tài khoản, tài liệu tải lên (kể cả file vật lý trên đĩa và vector embeddings trong ChromaDB) và lịch sử chat của doanh nghiệp <strong>{deleteTenantModal.companyName}</strong> sẽ bị xóa vĩnh viễn khỏi hệ thống.</p>
                <p>Vui lòng gõ lại tên doanh nghiệp <strong>{deleteTenantModal.companyName}</strong> để xác nhận hành động xóa:</p>
              </div>

              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={deleteTenantModal.companyName}
                className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-red-500/50 transition-colors"
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setDeleteTenantModal({ isOpen: false, tenantId: null, companyName: '' }); setConfirmInput(''); }}
                  className="px-4 py-2 text-xs font-bold border border-[#23252a] hover:bg-[#141516] rounded-lg text-[#8a8f98] hover:text-white transition-colors flex-1"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleDeleteTenant}
                  disabled={confirmInput !== deleteTenantModal.companyName || actionLoadingId !== null}
                  className="px-4 py-2 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 flex-1"
                >
                  {actionLoadingId === deleteTenantModal.tenantId ? <Loader2 className="animate-spin" size={12} /> : "Xác nhận xóa"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
