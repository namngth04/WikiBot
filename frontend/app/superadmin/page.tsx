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
  Building2,
  Trash2,
  DollarSign,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '@/app/components/ThemeToggle';
import ModelManagementTab from '@/components/admin/ModelManagementTab';

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


interface TenantData {
  tenant_id: number;
  company_name: string;
  invite_code: string;
  staff_count: number;
  doc_count: number;
  is_active: boolean;
}

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

interface AIProviderConfigData {
  ai_type: string;
  provider: string;
  local_model_path: string | null;
  api_base_url: string | null;
  api_key: string | null;
  api_model: string | null;
  use_custom_model: boolean;
  custom_api_model: string | null;
  default_temperature: number;
  default_max_tokens: number;
  embedding_model_name: string | null;
  timeout?: number | null;
  use_rag_provider?: boolean | null;
}

interface AISafetyConfigData {
  max_temperature_limit: number;
  max_context_length: number;
  max_tokens_limit: number;
  default_temperature: number;
  default_response_style: string;
}

interface RevenueStats {
  total_revenue: number;
  conversion_rate: number;
  pro_users_count: number;
  free_users_count: number;
  total_personal_users: number;
  revenue_by_month: { month: string; revenue: number }[];
  growth_rate: number;
}

export default function SuperadminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'resources' | 'tenants' | 'personal-users' | 'upgrade-logs' | 'ai-config'>('resources');
  const [aiSubTab, setAiSubTab] = useState<'system' | 'models'>('system');
  
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [personalUsers, setPersonalUsers] = useState<PersonalUserData[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [personalSearchTerm, setPersonalSearchTerm] = useState('');
  const [actionLoadingUserId, setActionLoadingUserId] = useState<number | null>(null);

  // AI Config states
  const [aiConfigs, setAiConfigs] = useState<AIProviderConfigData[]>([]);
  const [safetyConfig, setSafetyConfig] = useState<AISafetyConfigData | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, {success: boolean; message: string; latency_ms?: number} | null>>({});
  const [savingAI, setSavingAI] = useState<string | null>(null);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, Partial<AIProviderConfigData>>>({});
  const [savingSafety, setSavingSafety] = useState(false);
  const [editingSafety, setEditingSafety] = useState<AISafetyConfigData | null>(null);
  
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantSearchTerm, setTenantSearchTerm] = useState('');

  // Delete States
  const [deleteTenantModal, setDeleteTenantModal] = useState<{ isOpen: boolean; tenantId: number | null; companyName: string }>({ isOpen: false, tenantId: null, companyName: '' });
  const [deleteUserModal, setDeleteUserModal] = useState<{ isOpen: boolean; userId: number | null; username: string }>({ isOpen: false, userId: null, username: '' });
  const [confirmInput, setConfirmInput] = useState('');

  // Verify Superadmin privileges (isAdmin and no tenant)
  const isSuperadmin = isAdmin && user?.tenant_id === null;

  const fetchData = async () => {
    if (!isSuperadmin) return;
    
    setLoadingStats(true);
    setLoadingRequests(true);
    setLoadingTenants(true);
    
    try {
      // Fetch overview stats
      const statsRes = await api.get('/admin/stats/overview');
      setStats(statsRes.data);

      // Fetch upgrade requests
      const reqsRes = await api.get('/upgrade/requests');
      setRequests(reqsRes.data);

      // Fetch tenants list
      const tenantsRes = await api.get('/admin/tenants');
      setTenants(tenantsRes.data);

      // Fetch revenue stats
      setLoadingRevenue(true);
      try {
        const revenueRes = await api.get('/admin/stats/revenue');
        setRevenue(revenueRes.data);
      } catch (revErr) {
        console.error('Error fetching revenue stats:', revErr);
      } finally {
        setLoadingRevenue(false);
      }

      // Fetch AI configs for dashboard widget
      try {
        const [configsRes, safetyRes] = await Promise.all([
          api.get('/admin/ai-config'),
          api.get('/admin/ai-config/safety')
        ]);
        setAiConfigs(configsRes.data);
        setSafetyConfig(safetyRes.data);
        setEditingSafety(safetyRes.data);
        const initialEditing: Record<string, Partial<AIProviderConfigData>> = {};
        configsRes.data.forEach((c: AIProviderConfigData) => { initialEditing[c.ai_type] = {...c}; });
        setEditingConfigs(initialEditing);
      } catch (aiErr) {
        console.error('Error fetching AI configurations on load:', aiErr);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoadingStats(false);
      setLoadingRequests(false);
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

  // Fetch Personal Users list
  const fetchPersonalUsers = async () => {
    if (!isSuperadmin) return;
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

  // Handle Toggle Personal User Status (Suspend / Activate)
  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    setActionLoadingUserId(userId);
    const newStatus = !currentStatus;
    try {
      await api.put(`/admin/users/${userId}/status?is_active=${newStatus}`);
      // Refresh list in-place
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

  // Handle Delete Tenant
  const handleDeleteTenant = async () => {
    if (!deleteTenantModal.tenantId) return;
    setActionLoadingId(deleteTenantModal.tenantId);
    try {
      await api.delete(`/admin/tenants/${deleteTenantModal.tenantId}`);
      setDeleteTenantModal({ isOpen: false, tenantId: null, companyName: '' });
      setConfirmInput('');
      const tenantsRes = await api.get('/admin/tenants');
      setTenants(tenantsRes.data);
      alert('Đã xóa doanh nghiệp thành công!');
    } catch (err: any) {
      console.error('Error deleting tenant:', err);
      alert(err.response?.data?.detail || 'Không thể xóa doanh nghiệp. Vui lòng thử lại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete Personal User
  const handleDeletePersonalUser = async () => {
    if (!deleteUserModal.userId) return;
    setActionLoadingUserId(deleteUserModal.userId);
    try {
      await api.delete(`/admin/users/personal/${deleteUserModal.userId}`);
      setDeleteUserModal({ isOpen: false, userId: null, username: '' });
      setConfirmInput('');
      await fetchPersonalUsers();
      alert('Đã xóa người dùng cá nhân thành công!');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert(err.response?.data?.detail || 'Không thể xóa người dùng cá nhân. Vui lòng thử lại.');
    } finally {
      setActionLoadingUserId(null);
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

  // Filter personal users
  const filteredPersonalUsers = personalUsers.filter(u =>
    u.username.toLowerCase().includes(personalSearchTerm.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(personalSearchTerm.toLowerCase())) ||
    (u.full_name && u.full_name.toLowerCase().includes(personalSearchTerm.toLowerCase()))
  );

  // Fetch personal users when tab switches to it
  useEffect(() => {
    if (activeTab === 'personal-users' && isSuperadmin && personalUsers.length === 0) {
      fetchPersonalUsers();
    }
  }, [activeTab]);

  // AI Config functions
  const fetchAIConfigs = async () => {
    setLoadingAI(true);
    try {
      const [configsRes, safetyRes] = await Promise.all([
        api.get('/admin/ai-config'),
        api.get('/admin/ai-config/safety')
      ]);
      setAiConfigs(configsRes.data);
      setSafetyConfig(safetyRes.data);
      setEditingSafety(safetyRes.data);
      const initialEditing: Record<string, Partial<AIProviderConfigData>> = {};
      configsRes.data.forEach((c: AIProviderConfigData) => { initialEditing[c.ai_type] = {...c}; });
      setEditingConfigs(initialEditing);
    } catch (err) { console.error('Error fetching AI configs:', err); }
    finally { setLoadingAI(false); }
  };

  const handleSaveAIConfig = async (ai_type: string) => {
    setSavingAI(ai_type);
    try {
      await api.put(`/admin/ai-config/${ai_type}`, editingConfigs[ai_type]);
      await fetchAIConfigs();
    } catch (err: any) {
      alert(`Lỗi khi lưu cấu hình AI: ${err?.response?.data?.detail || 'Vui lòng thử lại'}`);
    }
    finally { setSavingAI(null); }
  };

  const handleTestConnection = async (ai_type: string) => {
    setTestResults(prev => ({...prev, [ai_type]: null}));
    try {
      const cfg = editingConfigs[ai_type] || {};
      const payload = {
        provider: cfg.provider,
        api_base_url: cfg.api_base_url || null,
        api_key: cfg.api_key || null,
        api_model: cfg.api_model || null,
        local_model_path: cfg.local_model_path || null,
        use_custom_model: cfg.use_custom_model || false,
        custom_api_model: cfg.custom_api_model || null,
        timeout: cfg.timeout || 30
      };
      const res = await api.post(`/admin/ai-config/${ai_type}/test`, payload);
      setTestResults(prev => ({...prev, [ai_type]: res.data}));
    } catch (err: any) {
      setTestResults(prev => ({...prev, [ai_type]: {success: false, message: 'Không thể kết nối'}}));
    }
  };

  const handleSaveSafety = async () => {
    if (!editingSafety) return;
    setSavingSafety(true);
    try {
      await api.put('/admin/ai-config/safety', editingSafety);
      setSafetyConfig(editingSafety);
      alert('Đã lưu Safety Config thành công!');
    } catch (err) {
      alert('Lỗi khi lưu Safety Config');
    } finally {
      setSavingSafety(false);
    }
  };

  // Lazy-load AI configs when tab switches to ai-config
  useEffect(() => {
    if (activeTab === 'ai-config' && isSuperadmin && aiConfigs.length === 0) {
      fetchAIConfigs();
    }
  }, [activeTab]);

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
            <p className="text-xs text-[#8a8f98]">Quản lý doanh nghiệp, theo dõi doanh thu và giám sát cấu hình LLM.</p>
          </div>
          <button 
            onClick={fetchData} 
            disabled={loadingStats || loadingRequests || loadingTenants || loadingRevenue}
            className="px-3 py-1.5 text-xs font-semibold border border-[#23252a] hover:bg-[#141516] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 text-[#8a8f98] hover:text-white"
          >
            <RefreshCw size={12} className={loadingStats || loadingRequests || loadingRevenue ? 'animate-spin' : ''} /> Tải lại dữ liệu
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
            onClick={() => setActiveTab('personal-users')}
            className={`pb-3 font-semibold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'personal-users'
                ? 'text-white border-b-2 border-[#5e6ad2]'
                : 'text-[#8a8f98] hover:text-white'
            }`}
          >
            👤 Người dùng cá nhân
            <span className="text-[10px] font-mono border border-[#23252a] bg-[#141516] px-1.5 py-0.5 rounded text-[#8a8f98]">
              {personalUsers.length}
            </span>
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
          <button
            onClick={() => setActiveTab('ai-config')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'ai-config' 
                ? 'text-white border-b-2 border-[#5e6ad2]' 
                : 'text-[#8a8f98] hover:text-white'
            }`}
          >
            🤖 Quản lý LLM
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

              {/* Premium Revenue Stats Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Revenue Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#5e6ad2]/40 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">Tổng doanh thu thương mại</span>
                    <div className="w-8 h-8 rounded bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center text-[#5e6ad2]">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  {loadingRevenue ? (
                    <div className="h-8 w-24 bg-[#141516] rounded animate-pulse" />
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="text-2xl font-extrabold text-white">{(revenue?.total_revenue ?? 0).toLocaleString('vi-VN')} VNĐ</span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <TrendingUp size={10} /> +{(revenue?.growth_rate ?? 0)}% tăng trưởng tháng này
                      </span>
                    </div>
                  )}
                </div>

                {/* Conversion Rate Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#5e6ad2]/40 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">Tỷ lệ nâng cấp PRO</span>
                    <div className="w-8 h-8 rounded bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6]">
                      <CreditCard size={16} />
                    </div>
                  </div>
                  {loadingRevenue ? (
                    <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-white">{revenue?.conversion_rate ?? 0.0}%</span>
                        <span className="text-[10px] text-[#8a8f98]">({revenue?.pro_users_count ?? 0}/{revenue?.total_personal_users ?? 0} cá nhân)</span>
                      </div>
                      <div className="w-full bg-[#141516] h-1.5 rounded-full overflow-hidden border border-[#23252a]">
                        <div 
                          className="bg-gradient-to-r from-[#5e6ad2] to-[#8b5cf6] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${revenue?.conversion_rate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Revenue History Month Card */}
                <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#5e6ad2]/40 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">Lịch sử doanh thu 6 tháng gần nhất</span>
                  </div>
                  {loadingRevenue ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-[#141516] rounded w-full animate-pulse" />
                      <div className="h-4 bg-[#141516] rounded w-3/4 animate-pulse" />
                    </div>
                  ) : !revenue?.revenue_by_month || revenue.revenue_by_month.length === 0 ? (
                    <span className="text-xs text-[#8a8f98] italic block py-4">Chưa có giao dịch nâng cấp nào</span>
                  ) : (
                    <div className="space-y-1.5 max-h-[80px] overflow-y-auto pr-1">
                      {revenue.revenue_by_month.map(item => (
                        <div key={item.month} className="flex justify-between items-center text-xs">
                          <span className="font-mono text-[#8a8f98]">{item.month}</span>
                          <span className="font-bold text-emerald-400">+{item.revenue.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                      ))}
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

              {/* Active AI Models Map */}
              <div className="p-6 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#23252a]/60 pb-4 mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-[#5e6ad2]" /> Bản Đồ Phân Phối Mô Hình AI (Active AI Engine Map)
                    </h3>
                    <p className="text-[11px] text-[#8a8f98] mt-0.5">Giám sát các mô hình AI đang được sử dụng thực tế cho các tác vụ trong hệ thống</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chat AI Card */}
                  <div className="p-4 rounded-xl border border-[#23252a]/60 bg-[#141516]/40 flex flex-col justify-start gap-4 group hover:border-[#5e6ad2]/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#8a8f98] tracking-wider uppercase">🗣️ LLM Chat Engine (Đa mô hình)</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#5e6ad2] group-hover:text-white transition-colors">MANAGED</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] text-[#565860] block">Chế độ vận hành</span>
                        <span className="text-xs font-extrabold text-white">Quản trị viên cấu hình động</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#565860] block">Trạng thái</span>
                        <span className="text-xs text-[#a5b4fc] font-semibold">
                          Hoạt động trực tiếp qua tab 🤖 Quản lý LLM
                        </span>
                      </div>
                      <div className="pt-1 border-t border-[#23252a]/40 text-[10px]">
                        <span className="text-[#565860]">Mục đích:</span> <span className="text-white font-semibold">Hỗ trợ RAG & Phản hồi câu hỏi</span>
                      </div>
                    </div>
                  </div>

                  {/* Embedding AI Card */}
                  {(() => {
                    const embedConfig = aiConfigs.find(c => c.ai_type === 'embedding');
                    return (
                      <div className="p-4 rounded-xl border border-[#23252a]/60 bg-[#141516]/40 flex flex-col justify-start gap-4 group hover:border-[#5e6ad2]/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#8a8f98] tracking-wider uppercase">📐 Embedding Vector</span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:text-white transition-colors">ACTIVE</span>
                        </div>
                        {loadingStats || aiConfigs.length === 0 ? (
                          <div className="space-y-2 py-2">
                            <div className="h-4 bg-[#1e2024] rounded w-3/4 animate-pulse" />
                            <div className="h-3 bg-[#1e2024] rounded w-1/2 animate-pulse" />
                          </div>
                        ) : embedConfig ? (
                          <div className="space-y-3">
                            <div>
                              <span className="text-[10px] text-[#565860] block">Provider</span>
                              <span className="text-xs font-extrabold text-white capitalize">{embedConfig.provider}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#565860] block">Model Active</span>
                              <code className="text-xs text-[#a5b4fc] font-mono break-all bg-[#010102]/60 px-1.5 py-0.5 rounded border border-[#23252a]">
                                {embedConfig.provider === 'local' 
                                  ? (embedConfig.embedding_model_name || 'paraphrase-multilingual-MiniLM-L12-v2')
                                  : (embedConfig.api_model || 'text-embedding-3-small')}
                              </code>
                            </div>
                            <div className="pt-1 border-t border-[#23252a]/40 text-[10px]">
                              <span className="text-[#565860]">Dùng cho:</span> <span className="text-white font-semibold">Tách và số hóa tài liệu RAG</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#8a8f98] italic">Chưa được cấu hình</span>
                        )}
                      </div>
                    );
                  })()}
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
            </motion.div>
          )}

          {activeTab === 'personal-users' && (
            <motion.div
              key="personal-users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-[#23252a] bg-[#0f1011]/30 p-6"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#23252a]/60 pb-5 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Quản lý Người dùng cá nhân (Personal Users)
                    <span className="text-[10px] font-mono border border-[#23252a] bg-[#141516] px-1.5 py-0.5 rounded text-[#8a8f98]">
                      {filteredPersonalUsers.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#8a8f98] mt-1">Người dùng tự do, không thuộc doanh nghiệp nào (tenant_id = null)</p>
                </div>

                {/* Search Bar + Refresh */}
                <div className="flex items-center gap-2">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 text-[#8a8f98]" size={12} />
                    <input
                      type="text"
                      placeholder="Tìm username, email, họ tên..."
                      value={personalSearchTerm}
                      onChange={(e) => setPersonalSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                    />
                  </div>
                  <button
                    onClick={fetchPersonalUsers}
                    disabled={loadingPersonal}
                    className="p-1.5 rounded-lg border border-[#23252a] hover:bg-[#141516] text-[#8a8f98] hover:text-white transition-colors disabled:opacity-50"
                    title="Tải lại danh sách"
                  >
                    <RefreshCw size={12} className={loadingPersonal ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Personal Users Table */}
              <div className="overflow-x-auto w-full">
                {loadingPersonal ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
                    <span className="text-xs text-[#8a8f98]">Đang tải danh sách người dùng cá nhân...</span>
                  </div>
                ) : filteredPersonalUsers.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users className="mx-auto mb-3 text-[#474a52]" size={32} />
                    <p className="text-xs text-[#8a8f98]">
                      {personalSearchTerm ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng cá nhân nào đăng ký.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#23252a]/60 text-[#8a8f98] select-none h-10 uppercase tracking-wider text-[10px]">
                        <th className="font-bold pb-3 pl-2">NGƯỜI DÙNG</th>
                        <th className="font-bold pb-3">GÓI DỊCH VỤ</th>
                        <th className="font-bold pb-3 text-center">TÀI LIỆU</th>
                        <th className="font-bold pb-3 text-center">HỘI THOẠI</th>
                        <th className="font-bold pb-3">NGÀY THAM GIA</th>
                        <th className="font-bold pb-3">TRẠNG THÁI</th>
                        <th className="font-bold pb-3 pr-2 text-right">HÀNH ĐỘNG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23252a]/40">
                      {filteredPersonalUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#141516]/40 transition-colors h-14">
                          {/* User Info */}
                          <td className="pl-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5e6ad2]/30 to-[#8b5cf6]/20 border border-[#5e6ad2]/30 flex items-center justify-center text-[10px] font-bold text-[#a5b4fc] uppercase flex-shrink-0">
                                {u.username.substring(0, 2)}
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span className="font-bold text-white">{u.username}</span>
                                <span className="text-[10px] text-[#565860]">{u.email || 'Chưa có email'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Subscription Tier Badge */}
                          <td>
                            {u.subscription_tier === 'pro' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 inline-flex items-center gap-1">
                                ⚡ PRO
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#141516] border border-[#23252a] text-[#8a8f98]">
                                FREE
                              </span>
                            )}
                          </td>

                          {/* Doc Count */}
                          <td className="text-center">
                            <span className="inline-flex items-center gap-1 text-[#d0d6e0] font-semibold">
                              <FileText size={11} className="text-[#474a52]" />
                              {u.doc_count}
                            </span>
                          </td>

                          {/* Conv Count */}
                          <td className="text-center">
                            <span className="inline-flex items-center gap-1 text-[#d0d6e0] font-semibold">
                              <MessageSquare size={11} className="text-[#474a52]" />
                              {u.conv_count}
                            </span>
                          </td>

                          {/* Joined Date */}
                          <td className="text-[#8a8f98]">
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-[#474a52]" />
                              {new Date(u.created_at).toLocaleDateString('vi-VN')}
                            </div>
                          </td>

                          {/* Status */}
                          <td>
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-red-500'}`} />
                              <span className={`text-[10px] font-semibold ${u.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                                {u.is_active ? 'Active' : 'Blocked'}
                              </span>
                            </div>
                          </td>

                          {/* Action */}
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

          {/* AI Config Tab */}
          {activeTab === 'ai-config' && (
            <motion.div
              key="ai-config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Quản lý Mô hình LLM & AI</h3>
                  <p className="text-xs text-[#8a8f98] mt-0.5">Cấu hình mô hình Embedding hệ thống và quản lý danh sách LLMs động</p>
                </div>
                {aiSubTab === 'system' && (
                  <button
                    onClick={fetchAIConfigs}
                    disabled={loadingAI}
                    className="px-3 py-1.5 text-xs font-semibold border border-[#23252a] hover:bg-[#141516] rounded-lg transition-colors flex items-center gap-1.5 text-[#8a8f98] hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={loadingAI ? 'animate-spin' : ''} /> Làm mới
                  </button>
                )}
              </div>

              {/* Internal Sub-Tabs */}
              <div className="flex gap-4 border-b border-[#23252a]/60 pb-2 text-xs">
                <button
                  onClick={() => setAiSubTab('system')}
                  className={`pb-1.5 font-bold transition-all relative ${
                    aiSubTab === 'system'
                      ? 'text-white border-b-2 border-[#5e6ad2]'
                      : 'text-[#8a8f98] hover:text-white'
                  }`}
                >
                  ⚙️ Cấu hình Hệ thống (Mặc định)
                </button>
                <button
                  onClick={() => setAiSubTab('models')}
                  className={`pb-1.5 font-bold transition-all relative ${
                    aiSubTab === 'models'
                      ? 'text-white border-b-2 border-[#5e6ad2]'
                      : 'text-[#8a8f98] hover:text-white'
                  }`}
                >
                  🤖 Quản lý Mô hình LLM
                </button>
              </div>

              {aiSubTab === 'system' ? (
                loadingAI ? (
                  <div className="py-16 flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
                    <span className="text-xs text-[#8a8f98]">Đang tải cấu hình AI...</span>
                  </div>
                ) : (
                  <>
                    {/* Provider Panels */}
                    {(['embedding'] as const).map((ai_type) => {
                      const cfg = editingConfigs[ai_type] || {};
                      const testResult = testResults[ai_type];
                      const typeLabels: Record<string, string> = { embedding: '📐 Cấu hình mô hình Embedding (Số hóa tài liệu)' };
                      const providers = ['local', 'openrouter', 'openai', 'gemini'];
                      return (
                        <div key={ai_type} className="rounded-xl border border-[#23252a] bg-[#0f1011]/30 p-6 space-y-4">
                          <div className="flex items-center gap-2 pb-3 border-b border-[#23252a]/60">
                            <span className="text-sm font-bold text-white">{typeLabels[ai_type]}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#23252a] bg-[#141516] text-[#8a8f98]">{ai_type.toUpperCase()}</span>
                          </div>

                          {/* Provider Selection */}
                          <div>
                            <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-2">Provider</label>
                            <div className="flex flex-wrap gap-2">
                              {providers.map(p => (
                                <button
                                  key={p}
                                  onClick={() => {
                                    const defaultUrls: Record<string, string> = {
                                      openrouter: 'https://openrouter.ai/api/v1',
                                      ollama: 'http://localhost:11434',
                                      openai: 'https://api.openai.com/v1',
                                      gemini: ''
                                    };
                                    setEditingConfigs(prev => ({
                                      ...prev, 
                                      [ai_type]: {
                                        ...prev[ai_type], 
                                        provider: p,
                                        api_base_url: defaultUrls[p] || ''
                                      }
                                    }));
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    cfg.provider === p
                                      ? 'bg-[#5e6ad2] border-[#5e6ad2] text-white'
                                      : 'border-[#23252a] text-[#8a8f98] hover:border-[#5e6ad2]/50 hover:text-white'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* API fields (non-local) */}
                          {cfg.provider !== 'local' && (
                            <>
                              <div>
                                <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">
                                  {cfg.provider === 'gemini' ? 'GCP Project ID (API Base URL)' : 'API Base URL'}
                                </label>
                                <input
                                  type="text"
                                  value={cfg.api_base_url || ''}
                                  onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], api_base_url: e.target.value}}))}
                                  className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                                  placeholder={cfg.provider === 'gemini' ? 'Nhập Project ID GCP của bạn (vd: my-gcp-project-123)' : 'https://openrouter.ai/api/v1'}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">
                                  {cfg.provider === 'gemini' ? 'JSON Key Service Account (API Key)' : 'API Key'}
                                </label>
                                <input
                                  type="password"
                                  value={cfg.api_key || ''}
                                  onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], api_key: e.target.value}}))}
                                  className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors font-mono"
                                  placeholder={cfg.provider === 'gemini' ? 'Dán toàn bộ nội dung file JSON Service Account Key tại đây' : '••••••••'}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Model</label>
                                <input
                                  type="text"
                                  value={cfg.api_model || ''}
                                  onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], api_model: e.target.value}}))}
                                  className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                                  placeholder={cfg.provider === 'gemini' ? 'multimodalembedding@001' : 'text-embedding-3-small'}
                                />
                              </div>
                            </>
                          )}

                          {/* Temperature & Max Tokens */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Temperature</label>
                              <input
                                type="number"
                                min={0} max={2} step={0.1}
                                value={cfg.default_temperature ?? 0.2}
                                onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], default_temperature: parseFloat(e.target.value)}}))}
                                className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Max Tokens</label>
                              <input
                                type="number"
                                min={128} max={4096}
                                value={cfg.default_max_tokens ?? 512}
                                onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], default_max_tokens: parseInt(e.target.value)}}))}
                                className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                              />
                            </div>
                          </div>

                          {/* Test Result Badge */}
                          {testResult !== undefined && testResult !== null && (
                            <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                              testResult.success
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                              <span>{testResult.success ? '✅' : '❌'}</span>
                              <span>{testResult.message}</span>
                              {testResult.success && testResult.latency_ms && (
                                <span className="ml-auto font-mono text-[10px]">{testResult.latency_ms}ms</span>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => handleTestConnection(ai_type)}
                              className="px-4 py-2 text-xs font-bold border border-[#23252a] hover:bg-[#141516] hover:border-[#5e6ad2]/50 rounded-lg transition-colors text-[#8a8f98] hover:text-white flex items-center gap-1.5"
                            >
                              🔌 Test Connection
                            </button>
                            <button
                              onClick={() => handleSaveAIConfig(ai_type)}
                              disabled={savingAI === ai_type}
                              className="px-4 py-2 text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {savingAI === ai_type ? <><Loader2 className="animate-spin" size={12} />Đang lưu...</> : '💾 Lưu cấu hình'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Safety Limits Panel */}
                    {editingSafety && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-4">
                        <div className="pb-3 border-b border-[#23252a]/60">
                          <h4 className="text-sm font-bold text-white">⚠️ Safety Limits Toàn Hệ Thống</h4>
                          <p className="text-xs text-[#8a8f98] mt-0.5">Giới hạn toàn cục áp dụng cho tất cả người dùng</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Max Temperature</label>
                            <input
                              type="number" min={0.1} max={2} step={0.1}
                              value={editingSafety.max_temperature_limit}
                              onChange={(e) => setEditingSafety({...editingSafety, max_temperature_limit: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-amber-500/50 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Max Tokens Limit</label>
                            <input
                              type="number" min={128} max={4096}
                              value={editingSafety.max_tokens_limit}
                              onChange={(e) => setEditingSafety({...editingSafety, max_tokens_limit: parseInt(e.target.value)})}
                              className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-amber-500/50 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Default Temperature</label>
                            <input
                              type="number" min={0} max={2} step={0.1}
                              value={editingSafety.default_temperature}
                              onChange={(e) => setEditingSafety({...editingSafety, default_temperature: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-amber-500/50 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider block mb-1">Default Response Style</label>
                            <select
                              value={editingSafety.default_response_style}
                              onChange={(e) => setEditingSafety({...editingSafety, default_response_style: e.target.value})}
                              className="w-full px-3 py-2 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-amber-500/50 transition-colors"
                            >
                              <option value="concise">Ngắn gọn</option>
                              <option value="detailed">Chi tiết</option>
                              <option value="technical">Kỹ thuật</option>
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={handleSaveSafety}
                          disabled={savingSafety}
                          className="px-5 py-2 text-xs font-bold bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {savingSafety ? <><Loader2 className="animate-spin" size={12} />Đang lưu...</> : '💾 Lưu Safety Config'}
                        </button>
                      </div>
                    )}
                  </>
                )
              ) : (
                <div className="mt-4">
                  <ModelManagementTab />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal xác nhận xóa Tenant */}
        <AnimatePresence>
          {deleteTenantModal.isOpen && (
            <>
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
                      <p className="text-[10px] text-[#8a8f98] font-medium">Hành động này KHÔNG THỂ HOÀN TÁC</p>
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
            </>
          )}
        </AnimatePresence>

        {/* Modal xác nhận xóa Personal User */}
        <AnimatePresence>
          {deleteUserModal.isOpen && (
            <>
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
                      <p className="text-[10px] text-[#8a8f98] font-medium">Hành động này KHÔNG THỂ HOÀN TÁC</p>
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
            </>
          )}
        </AnimatePresence>

      </main>

    </div>
  );
}
