'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { api } from '@/app/lib/api';
import AppLogo from '@/app/components/AppLogo';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Check, 
  X, 
  ShieldAlert, 
  Loader2, 
  LogOut, 
  Clock, 
  RefreshCw,
  Search,
  Sparkles,
  Cpu,
  HardDrive,
  Layers,
  Building,
  Lock,
  Unlock,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '@/app/components/ThemeToggle';

interface UpgradeRequest {
  id: number;
  user_id: number;
  username: string;
  full_name: string | null;
  status: string;
  created_at: string;
}

interface OverviewStats {
  total_users: number;
  total_messages: number;
  total_documents: number;
  satisfaction_rate: number;
}

interface ResourceStats {
  disk_usage_mb: number;
  chromadb_chunks: number;
  ram_usage_percent: number;
  cpu_usage_percent: number;
  total_tenants: number;
}

interface TenantData {
  tenant_id: number;
  company_name: string;
  invite_code: string;
  staff_count: number;
  doc_count: number;
  is_active: boolean;
}

export default function SuperadminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'resources' | 'tenants' | 'upgrade-logs'>('resources');
  
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [resources, setResources] = useState<ResourceStats | null>(null);
  const [tenants, setTenants] = useState<TenantData[]>([]);
  
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantSearchTerm, setTenantSearchTerm] = useState('');

  // Verify Superadmin privileges (isAdmin and no tenant)
  const isSuperadmin = isAdmin && user?.tenant_id === null;

  const fetchData = async () => {
    if (!isSuperadmin) return;
    
    setLoadingStats(true);
    setLoadingRequests(true);
    setLoadingResources(true);
    setLoadingTenants(true);
    
    try {
      // Fetch overview stats
      const statsRes = await api.get('/admin/stats/overview');
      setStats(statsRes.data);

      // Fetch upgrade requests
      const reqsRes = await api.get('/upgrade/requests');
      setRequests(reqsRes.data);

      // Fetch vĩ mô resource stats
      const resourcesRes = await api.get('/admin/stats/resources');
      setResources(resourcesRes.data);

      // Fetch tenants list
      const tenantsRes = await api.get('/admin/tenants');
      setTenants(tenantsRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoadingStats(false);
      setLoadingRequests(false);
      setLoadingResources(false);
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isSuperadmin) {
        router.push('/chat'); // Not a superadmin -> kick to chat
      } else {
        fetchData();
      }
    }
  }, [user, authLoading]);

  // Handle Toggle Tenant Status (Suspend / Activate)
  const handleToggleTenant = async (tenantId: number, currentStatus: boolean) => {
    setActionLoadingId(tenantId);
    const newStatus = !currentStatus;
    try {
      await api.put(`/admin/tenants/${tenantId}/status?is_active=${newStatus}`);
      // Refresh list
      const tenantsRes = await api.get('/admin/tenants');
      setTenants(tenantsRes.data);
    } catch (err) {
      console.error('Error updating tenant status:', err);
      alert('Không thể cập nhật trạng thái doanh nghiệp. Vui lòng thử lại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Format Date Helper
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (req.full_name && req.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  // Filter tenants
  const filteredTenants = tenants.filter(t => 
    t.company_name.toLowerCase().includes(tenantSearchTerm.toLowerCase()) ||
    t.invite_code.toLowerCase().includes(tenantSearchTerm.toLowerCase())
  );

  // If Auth loading, show spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#010102] flex items-center justify-center text-white">
        <Loader2 className="animate-spin text-[#5e6ad2]" size={36} />
      </div>
    );
  }

  // If NOT Superadmin, show access denied
  if (!user || !isSuperadmin) {
    return (
      <div className="min-h-screen bg-[#010102] text-[#f7f8f8] flex flex-col items-center justify-center p-6 select-none font-sans relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />
        
        <motion.div 
          className="max-w-md w-full p-8 rounded-2xl border border-red-500/20 bg-[#0f1011]/80 backdrop-blur-md text-center shadow-2xl relative z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-6">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Truy cập bị từ chối</h2>
          <p className="text-xs text-[#8a8f98] mb-8 leading-relaxed">
            Bạn không có quyền truy cập trang Superadmin Control Tower. Tính năng này chỉ dành cho quản trị viên tối cao của hệ thống WikiBot.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="px-6 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
            >
              Đăng nhập tài khoản khác
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010102] text-[#f7f8f8] font-sans antialiased overflow-x-hidden relative">
      
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[50%] h-[60%] rounded-full bg-[#5e6ad2]/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo size="sm" />
            <div className="h-4 w-[1px] bg-[#23252a]" />
            <span className="text-xs font-mono font-bold tracking-widest text-[#8a8f98]">CONTROL TOWER</span>
          </div>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-white leading-none">{user.full_name || user.username}</span>
              <span className="text-[9px] text-[#5e6ad2] font-mono tracking-wider mt-1">SUPERADMIN</span>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="p-1.5 rounded-lg border border-[#23252a] hover:bg-[#141516] text-[#8a8f98] hover:text-white transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        
        {/* Title & Refresh */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Bảng quản trị tối cao WikiBot <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#5e6ad2] animate-pulse">LIVE</span>
            </h1>
            <p className="text-xs text-[#8a8f98]">Giám sát tài nguyên vĩ mô, khóa/mở khóa doanh nghiệp và theo dõi doanh thu.</p>
          </div>
          <button 
            onClick={fetchData} 
            disabled={loadingStats || loadingRequests || loadingResources || loadingTenants}
            className="px-3 py-1.5 text-xs font-semibold border border-[#23252a] hover:bg-[#141516] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 text-[#8a8f98] hover:text-white"
          >
            <RefreshCw size={12} className={loadingStats || loadingRequests ? 'animate-spin' : ''} /> Tải lại dữ liệu
          </button>
        </div>

        {/* Dynamic 3-Tab Navigator */}
        <div className="flex border-b border-[#23252a]/60 mb-8 gap-6 text-sm">
          <button
            onClick={() => setActiveTab('resources')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'resources' 
                ? 'text-white border-b-2 border-[#5e6ad2]' 
                : 'text-[#8a8f98] hover:text-white'
            }`}
          >
            📊 Giám sát Tài nguyên & Hệ thống
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'tenants' 
                ? 'text-white border-b-2 border-[#5e6ad2]' 
                : 'text-[#8a8f98] hover:text-white'
            }`}
          >
            🏢 Danh sách Khách thuê (Tenants)
          </button>
          <button
            onClick={() => setActiveTab('upgrade-logs')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'upgrade-logs' 
                ? 'text-white border-b-2 border-[#5e6ad2]' 
                : 'text-[#8a8f98] hover:text-white'
            }`}
          >
            ⚡ Lịch sử Nâng cấp Gói cước (Auto-PRO)
          </button>
        </div>

        {/* Tab Contents */}
        <AnimatePresence mode="wait">
          {activeTab === 'resources' && (
            <motion.div
              key="resources"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Premium Resources Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* CPU Usage Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">VI XỬ LÝ (CPU)</span>
                    <div className="w-8 h-8 rounded bg-cyan-500/5 border border-cyan-500/15 flex items-center justify-center text-cyan-400">
                      <Cpu size={16} />
                    </div>
                  </div>
                  {loadingResources ? (
                    <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-white">{resources?.cpu_usage_percent ?? 0.0}%</span>
                        <span className="text-[10px] text-[#8a8f98]">đang tải</span>
                      </div>
                      {/* Premium Progress Bar */}
                      <div className="w-full bg-[#141516] h-1.5 rounded-full overflow-hidden border border-[#23252a]">
                        <div 
                          className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${resources?.cpu_usage_percent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* RAM Usage Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">BỘ NHỚ TRONG (RAM)</span>
                    <div className="w-8 h-8 rounded bg-purple-500/5 border border-purple-500/15 flex items-center justify-center text-purple-400">
                      <Cpu size={16} />
                    </div>
                  </div>
                  {loadingResources ? (
                    <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-white">{resources?.ram_usage_percent ?? 0.0}%</span>
                        <span className="text-[10px] text-[#8a8f98]">tiêu thụ</span>
                      </div>
                      {/* Premium Progress Bar */}
                      <div className="w-full bg-[#141516] h-1.5 rounded-full overflow-hidden border border-[#23252a]">
                        <div 
                          className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${resources?.ram_usage_percent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Disk Space Usage Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">DUNG LƯỢNG ĐĨA FILE</span>
                    <div className="w-8 h-8 rounded bg-amber-500/5 border border-amber-500/15 flex items-center justify-center text-amber-500">
                      <HardDrive size={16} />
                    </div>
                  </div>
                  {loadingResources ? (
                    <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-white">{resources?.disk_usage_mb ?? 0.0} MB</span>
                      <span className="text-[10px] text-[#8a8f98]">tài liệu vật lý</span>
                    </div>
                  )}
                </div>

                {/* ChromaDB Vector chunks Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">CHROMA DB VECTOR CHUNKS</span>
                    <div className="w-8 h-8 rounded bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-center text-emerald-400">
                      <Layers size={16} />
                    </div>
                  </div>
                  {loadingResources ? (
                    <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-white">{resources?.chromadb_chunks ?? 0}</span>
                      <span className="text-[10px] text-[#8a8f98]">mảnh vector index</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Standard resources count (User, Doc, Messages) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/20">
                  <span className="text-[10px] font-bold text-[#8a8f98] uppercase block mb-1">Người dùng</span>
                  <span className="text-xl font-bold text-white">{stats?.total_users ?? 0}</span>
                </div>
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/20">
                  <span className="text-[10px] font-bold text-[#8a8f98] uppercase block mb-1">Tài liệu tải lên</span>
                  <span className="text-xl font-bold text-white">{stats?.total_documents ?? 0}</span>
                </div>
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/20">
                  <span className="text-[10px] font-bold text-[#8a8f98] uppercase block mb-1">Câu hỏi RAG</span>
                  <span className="text-xl font-bold text-white">{stats?.total_messages ?? 0}</span>
                </div>
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/20">
                  <span className="text-[10px] font-bold text-[#8a8f98] uppercase block mb-1">Tỷ lệ hài lòng</span>
                  <span className="text-xl font-bold text-white">{stats?.satisfaction_rate ?? 0}%</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tenants' && (
            <motion.div
              key="tenants"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-[#23252a] bg-[#0f1011]/30 p-6"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#23252a]/60 pb-5 mb-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Quản lý Doanh nghiệp (SaaS Tenants) <span className="text-[10px] font-mono border border-[#23252a] bg-[#141516] px-1.5 py-0.5 rounded text-[#8a8f98]">{filteredTenants.length}</span>
                </h3>
                
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 text-[#8a8f98]" size={12} />
                  <input
                    type="text"
                    placeholder="Tìm tên doanh nghiệp, mã mời..."
                    value={tenantSearchTerm}
                    onChange={(e) => setTenantSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                  />
                </div>
              </div>

              {/* Tenants Table */}
              <div className="overflow-x-auto w-full">
                {loadingTenants ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
                    <span className="text-xs text-[#8a8f98]">Đang tải danh sách Tenant...</span>
                  </div>
                ) : filteredTenants.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#8a8f98]">
                    Không tìm thấy doanh nghiệp nào.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#23252a]/60 text-[#8a8f98] select-none h-10 uppercase tracking-wider text-[10px]">
                        <th className="font-bold pb-3 pl-2">DOANH NGHIỆP</th>
                        <th className="font-bold pb-3">MÃ MỜI (INVITE CODE)</th>
                        <th className="font-bold pb-3 text-center">NHÂN SỰ</th>
                        <th className="font-bold pb-3 text-center">TÀI LIỆU</th>
                        <th className="font-bold pb-3">TRẠNG THÁI</th>
                        <th className="font-bold pb-3 pr-2 text-right">HÀNH ĐỘNG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23252a]/40">
                      {filteredTenants.map((t) => (
                        <tr key={t.tenant_id} className="hover:bg-[#141516]/40 transition-colors h-14">
                          <td className="pl-2 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <Building className="text-[#5e6ad2]" size={14} />
                              {t.company_name}
                            </div>
                          </td>
                          <td className="font-mono text-[#8a8f98]">{t.invite_code}</td>
                          <td className="text-center font-semibold text-[#d0d6e0]">{t.staff_count}</td>
                          <td className="text-center font-semibold text-[#d0d6e0]">{t.doc_count}</td>
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
                            <button
                              onClick={() => handleToggleTenant(t.tenant_id, t.is_active)}
                              disabled={actionLoadingId !== null}
                              className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                                t.is_active
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              } disabled:opacity-50 flex items-center gap-1.5 ml-auto`}
                            >
                              {actionLoadingId === t.tenant_id ? (
                                <Loader2 className="animate-spin" size={10} />
                              ) : t.is_active ? (
                                <><Lock size={10} /> Khóa Tenant</>
                              ) : (
                                <><Unlock size={10} /> Kích hoạt</>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'upgrade-logs' && (
            <motion.div
              key="upgrade-logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-[#23252a] bg-[#0f1011]/30 p-6"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#23252a]/60 pb-5 mb-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Nhật ký Nâng cấp Gói cước (Auto-PRO) <span className="text-[10px] font-mono border border-[#23252a] bg-[#141516] px-1.5 py-0.5 rounded text-[#8a8f98]">{filteredRequests.length}</span>
                </h3>
                
                {/* Search Bar */}
                <div className="relative w-full md:w-48">
                  <Search className="absolute left-2.5 top-2.5 text-[#8a8f98]" size={12} />
                  <input
                    type="text"
                    placeholder="Tìm tên người dùng..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                {loadingRequests ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
                    <span className="text-xs text-[#8a8f98]">Đang tải danh sách nâng cấp...</span>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#8a8f98]">
                    Không có yêu cầu nâng cấp nào.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#23252a]/60 text-[#8a8f98] select-none h-10 text-[10px] uppercase tracking-wider">
                        <th className="font-bold pb-3 pl-2">NGƯỜI DÙNG</th>
                        <th className="font-bold pb-3">HỌ VÀ TÊN</th>
                        <th className="font-bold pb-3">NGÀY YÊU CẦU</th>
                        <th className="font-bold pb-3">HẠN MỨC MỚI</th>
                        <th className="font-bold pb-3 pr-2 text-right">TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23252a]/40">
                      {filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-[#141516]/40 transition-colors h-14">
                          <td className="pl-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#141516] border border-[#23252a] flex items-center justify-center text-[10px] font-bold text-[#8a8f98] uppercase">
                                {req.username.substring(0, 2)}
                              </div>
                              <span className="font-bold text-white">{req.username}</span>
                            </div>
                          </td>
                          <td className="text-[#d0d6e0]">
                            {req.full_name || <span className="text-[#565860] italic">Chưa cập nhật</span>}
                          </td>
                          <td className="text-[#8a8f98]">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-[#474a52]" />
                              {formatDate(req.created_at)}
                            </div>
                          </td>
                          <td>
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                              PRO TIER ⚡
                            </span>
                          </td>
                          <td className="pr-2 text-right">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 inline-flex items-center gap-1">
                              ✓ Auto-Approved ⚡
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

    </div>
  );
}
