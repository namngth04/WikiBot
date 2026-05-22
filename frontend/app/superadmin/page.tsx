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
  ChevronRight, 
  Clock, 
  User as UserIcon, 
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function SuperadminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Verify Superadmin privileges (isAdmin and no tenant)
  const isSuperadmin = isAdmin && user?.tenant_id === null;

  const fetchData = async () => {
    if (!isSuperadmin) return;
    
    setLoadingStats(true);
    setLoadingRequests(true);
    
    try {
      // Fetch overview stats
      const statsRes = await api.get('/admin/stats/overview');
      setStats(statsRes.data);

      // Fetch upgrade requests
      const reqsRes = await api.get('/upgrade/requests');
      setRequests(reqsRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoadingStats(false);
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isSuperadmin) {
        // Not a superadmin
      } else {
        fetchData();
      }
    }
  }, [user, authLoading]);

  // Handle Approve
  const handleApprove = async (id: number) => {
    setActionLoadingId(id);
    setActionType('approve');
    try {
      await api.post(`/upgrade/approve/${id}`);
      // Refresh requests & stats
      const reqsRes = await api.get('/upgrade/requests');
      setRequests(reqsRes.data);
      const statsRes = await api.get('/admin/stats/overview');
      setStats(statsRes.data);
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Phê duyệt thất bại. Vui lòng thử lại.');
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  };

  // Handle Reject
  const handleReject = async (id: number) => {
    setActionLoadingId(id);
    setActionType('reject');
    try {
      await api.post(`/upgrade/reject/${id}`);
      // Refresh requests
      const reqsRes = await api.get('/upgrade/requests');
      setRequests(reqsRes.data);
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Từ chối thất bại. Vui lòng thử lại.');
    } finally {
      setActionLoadingId(null);
      setActionType(null);
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
    
    if (filterStatus === 'all') return matchesSearch;
    return req.status === filterStatus && matchesSearch;
  });

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
        {/* Glow */}
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
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="flex-1 py-2 text-xs font-semibold bg-[#23252a] hover:bg-[#2c2f35] text-white rounded-lg transition-colors border border-[#343840]"
            >
              Về Phòng Chat
            </button>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="flex-1 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
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
      <header className="sticky top-0 z-40 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo size="sm" />
            <div className="h-4 w-[1px] bg-[#23252a]" />
            <span className="text-xs font-mono font-bold tracking-widest text-[#8a8f98]">CONTROL TOWER</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-white">{user.full_name || user.username}</span>
              <span className="text-[9px] text-[#5e6ad2] font-mono tracking-wider">SUPERADMIN</span>
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
        
        {/* Title and stats title */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Bảng quản trị tối cao WikiBot <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#5e6ad2] animate-pulse">LIVE</span>
            </h1>
            <p className="text-xs text-[#8a8f98]">Giám sát tài nguyên toàn hệ thống và phê duyệt yêu cầu nâng cấp thương mại.</p>
          </div>
          <button 
            onClick={fetchData} 
            disabled={loadingStats || loadingRequests}
            className="px-3 py-1.5 text-xs font-semibold border border-[#23252a] hover:bg-[#141516] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 text-[#8a8f98] hover:text-white"
          >
            <RefreshCw size={12} className={loadingStats || loadingRequests ? 'animate-spin' : ''} /> Tải lại dữ liệu
          </button>
        </div>

        {/* Resources Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {/* Card Users */}
          <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">NGƯỜI DÙNG</span>
              <div className="w-8 h-8 rounded bg-[#5e6ad2]/5 border border-[#5e6ad2]/15 flex items-center justify-center text-[#5e6ad2]">
                <Users size={16} />
              </div>
            </div>
            {loadingStats ? (
              <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{stats?.total_users ?? 0}</span>
                <span className="text-[10px] text-[#8a8f98]">tài khoản active</span>
              </div>
            )}
          </div>

          {/* Card Documents */}
          <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">TÀI LIỆU RAG</span>
              <div className="w-8 h-8 rounded bg-cyan-500/5 border border-cyan-500/15 flex items-center justify-center text-cyan-400">
                <FileText size={16} />
              </div>
            </div>
            {loadingStats ? (
              <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{stats?.total_documents ?? 0}</span>
                <span className="text-[10px] text-[#8a8f98]">tệp tin được index</span>
              </div>
            )}
          </div>

          {/* Card Messages */}
          <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">TỔNG TRUY VẤN</span>
              <div className="w-8 h-8 rounded bg-amber-500/5 border border-amber-500/15 flex items-center justify-center text-amber-500">
                <MessageSquare size={16} />
              </div>
            </div>
            {loadingStats ? (
              <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{stats?.total_messages ?? 0}</span>
                <span className="text-[10px] text-[#8a8f98]">câu hỏi suy luận</span>
              </div>
            )}
          </div>

          {/* Card Vector Chunks */}
          <div className="p-5 rounded-xl border border-[#23252a] bg-[#0f1011]/30 relative overflow-hidden group hover:border-[#23252a]/80 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#8a8f98] tracking-wider uppercase">TỶ LỆ HÀI LÒNG</span>
              <div className="w-8 h-8 rounded bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Sparkles size={16} />
              </div>
            </div>
            {loadingStats ? (
              <div className="h-8 w-16 bg-[#141516] rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white">{stats?.satisfaction_rate ?? 0}%</span>
                <span className="text-[10px] text-[#8a8f98]">đánh giá tích cực</span>
              </div>
            )}
          </div>
        </div>

        {/* Requests Management Section */}
        <div className="rounded-xl border border-[#23252a] bg-[#0f1011]/30 p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#23252a]/60 pb-5 mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Danh sách yêu cầu nâng cấp PRO <span className="text-[10px] font-mono border border-[#23252a] bg-[#141516] px-1.5 py-0.5 rounded text-[#8a8f98]">{filteredRequests.length}</span>
            </h3>
            
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative w-full md:w-48">
                <Search className="absolute left-2.5 top-2.5 text-[#8a8f98]" size={12} />
                <input
                  type="text"
                  placeholder="Tìm username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#141516] border border-[#23252a] rounded-lg text-white outline-none focus:border-[#5e6ad2] transition-colors"
                />
              </div>

              {/* Status Filters */}
              <div className="flex border border-[#23252a] bg-[#141516] rounded-lg p-0.5 text-[10px]">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'all' ? 'bg-[#23252a] text-white font-bold' : 'text-[#8a8f98] hover:text-white'}`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'pending' ? 'bg-[#5e6ad2] text-white font-bold' : 'text-[#8a8f98] hover:text-white'}`}
                >
                  Chờ duyệt
                </button>
                <button
                  onClick={() => setFilterStatus('approved')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-[#8a8f98] hover:text-white'}`}
                >
                  Đã duyệt
                </button>
                <button
                  onClick={() => setFilterStatus('rejected')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'rejected' ? 'bg-red-500/20 text-red-400 font-bold' : 'text-[#8a8f98] hover:text-white'}`}
                >
                  Từ chối
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto w-full">
            {loadingRequests ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
                <span className="text-xs text-[#8a8f98]">Đang tải danh sách yêu cầu...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#8a8f98]">
                Không có yêu cầu nâng cấp nào được tìm thấy.
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#23252a]/60 text-[#8a8f98] select-none h-10">
                    <th className="font-bold pb-3 pl-2">NGƯỜI DÙNG</th>
                    <th className="font-bold pb-3">HỌ VÀ TÊN</th>
                    <th className="font-bold pb-3">NGÀY YÊU CẦU</th>
                    <th className="font-bold pb-3">TRẠNG THÁI</th>
                    <th className="font-bold pb-3 pr-2 text-right">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23252a]/40">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#141516]/40 transition-colors h-14">
                      {/* USERNAME */}
                      <td className="pl-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#141516] border border-[#23252a] flex items-center justify-center text-[10px] font-bold text-[#8a8f98] uppercase">
                            {req.username.substring(0, 2)}
                          </div>
                          <span className="font-bold text-white">{req.username}</span>
                        </div>
                      </td>

                      {/* FULL NAME */}
                      <td className="text-[#d0d6e0]">
                        {req.full_name || <span className="text-[#565860] italic">Chưa cập nhật</span>}
                      </td>

                      {/* CREATED AT */}
                      <td className="text-[#8a8f98]">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-[#474a52]" />
                          {formatDate(req.created_at)}
                        </div>
                      </td>

                      {/* STATUS BADGE */}
                      <td>
                        {req.status === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[#5e6ad2]/10 border border-[#5e6ad2]/30 text-[#8a8f98] flex items-center gap-1 w-fit">
                            <span className="w-1 h-1 rounded-full bg-[#5e6ad2] animate-ping" />
                            Đang chờ duyệt
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 w-fit">
                            ✓ Đã phê duyệt
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1 w-fit">
                            ✕ Đã từ chối
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="pr-2 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            {actionLoadingId === req.id && actionType === 'reject' ? (
                              <button disabled className="px-2.5 py-1 text-[10px] bg-[#141516] border border-[#23252a] rounded text-[#8a8f98] flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" /> Từ chối
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReject(req.id)}
                                disabled={actionLoadingId !== null}
                                className="px-2.5 py-1 text-[10px] font-semibold bg-[#141516] hover:bg-red-500/10 border border-[#23252a] hover:border-red-500/30 rounded text-[#8a8f98] hover:text-red-400 transition-colors disabled:opacity-50"
                              >
                                Từ chối
                              </button>
                            )}

                            {actionLoadingId === req.id && actionType === 'approve' ? (
                              <button disabled className="px-3 py-1 text-[10px] bg-[#5e6ad2]/50 rounded text-white flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" /> Duyệt
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApprove(req.id)}
                                disabled={actionLoadingId !== null}
                                className="px-3 py-1 text-[10px] font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded transition-all active:scale-[0.98] shadow-md shadow-[#5e6ad2]/10 disabled:opacity-50"
                              >
                                Phê duyệt ⚡
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#474a52] italic pr-2">
                            Không có hành động
                          </span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

      </main>

    </div>
  );
}
