'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { api } from '@/app/lib/api';
import { motion } from 'framer-motion';
import {
  MessageSquare, Send, FileText, Zap, ArrowRight,
  Settings, Sparkles, LogOut, BarChart3, Loader2, User, Heart
} from 'lucide-react';
import AppLogo from '@/app/components/AppLogo';
import DesktopGuard from '@/components/DesktopGuard';
import { isElectron } from '@/app/lib/platform';

interface UserStats {
  conv_count: number;
  message_count: number;
  doc_count: number;
  questions_used_today: number;
  quota_limit: number;
  subscription_tier: string;
  satisfaction_rate?: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' as const }
  })
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAdmin, isCompanyAdmin, loading: authLoading, logout } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [runningInDesktop, setRunningInDesktop] = useState(true);

  useEffect(() => {
    setRunningInDesktop(isElectron());
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      // Superadmin → /superadmin
      if (isAdmin && (user.tenant_id === null || user.tenant_id === undefined)) {
        router.push('/superadmin');
        return;
      }
      // Company Admin → /admin/dashboard
      if (isCompanyAdmin) {
        router.push('/admin/dashboard');
        return;
      }
      // Personal user → load stats
      fetchStats();
    }
  }, [user, authLoading, isAdmin, isCompanyAdmin]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/users/me/stats');
      setUserStats(res.data);
    } catch (err) {
      console.error('Error fetching user stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#010102] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5e6ad2]" size={36} />
      </div>
    );
  }

  const isFree = userStats?.subscription_tier === 'free';
  const quotaPercent = userStats
    ? Math.min((userStats.questions_used_today / userStats.quota_limit) * 100, 100)
    : 0;

  const statsCards = [
    {
      icon: MessageSquare,
      label: 'Hội thoại',
      value: userStats?.conv_count ?? 0,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      icon: Send,
      label: 'Câu hỏi đã gửi',
      value: userStats?.message_count ?? 0,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      icon: FileText,
      label: 'Tài liệu',
      value: userStats?.doc_count ?? 0,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      icon: Heart,
      label: 'Tỷ lệ hài lòng',
      value: userStats?.satisfaction_rate !== undefined ? `${userStats.satisfaction_rate}%` : '100%',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
    },
    {
      icon: Zap,
      label: 'Quota hôm nay',
      value: null, // Rendered separately as progress bar
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ];

  return (
    <DesktopGuard allowWebDashboard={true}>
      <div className="min-h-screen bg-[#010102] text-[#f7f8f8] font-sans antialiased">
        {/* Background glow */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#5e6ad2]/8 blur-[120px] pointer-events-none" />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AppLogo size="sm" />
              <div className="h-4 w-px bg-[#23252a]" />
              <span className="text-xs font-mono font-bold tracking-widest text-[#8a8f98]">DASHBOARD</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/chat')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                  runningInDesktop
                    ? 'border border-[#23252a] hover:bg-[#141516] text-[#8a8f98] hover:text-white'
                    : 'border border-[#5e6ad2]/30 bg-[#5e6ad2]/10 hover:bg-[#5e6ad2]/20 text-[#a5b4fc]'
                }`}
              >
                {runningInDesktop ? 'Quay lại Chat' : '📥 Tải Desktop App'}
              </button>
              <button
                onClick={() => { logout(); router.push('/login'); }}
                className="p-1.5 rounded-lg border border-[#23252a] hover:bg-[#141516] text-[#8a8f98] hover:text-white transition-colors"
                title="Đăng xuất"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10 relative z-10">

          {/* User Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-5 mb-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5e6ad2]/30 to-[#8b5cf6]/20 border border-[#5e6ad2]/30 flex items-center justify-center text-2xl font-bold text-[#a5b4fc]">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{user.full_name || user.username}</h1>
                {userStats && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isFree
                      ? 'bg-[#141516] border border-[#23252a] text-[#8a8f98]'
                      : 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300'
                  }`}>
                    {isFree ? 'FREE' : '⚡ PRO'}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#8a8f98] mt-0.5">@{user.username} · {user.email || 'Chưa có email'}</p>
            </div>
          </motion.div>

          {/* Desktop App Alert Banner (Hiển thị khi chạy trên Web Browser) */}
          {!runningInDesktop && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-[#5e6ad2]/10 via-[#8b5cf6]/10 to-[#5e6ad2]/5 border border-[#5e6ad2]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-[#5e6ad2]/5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#5e6ad2]/5 blur-2xl rounded-full pointer-events-none" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center text-xl text-[#5e6ad2] shrink-0">
                  🖥️
                </div>
                <div>
                  <p className="font-bold text-white flex items-center gap-2">
                    Bạn đang sử dụng phiên bản Web
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5e6ad2]/20 text-[#a5b4fc]">Bản xem thông tin</span>
                  </p>
                  <p className="text-xs text-[#8a8f98] mt-0.5 max-w-xl">
                    Để bảo mật tri thức doanh nghiệp tối đa, sử dụng tính năng **trò chuyện AI (RAG)**, quản lý tài liệu và cấu hình Ollama offline, vui lòng tải và đăng nhập trên ứng dụng Desktop.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/chat')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white transition-all active:scale-[0.98] shadow-md shadow-[#5e6ad2]/20 shrink-0"
              >
                📥 Tải App Cho Desktop
              </button>
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-10">
            {loadingStats ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl border border-[#23252a] bg-[#0f1011]/30 animate-pulse" />
              ))
            ) : (
              statsCards.map((card, i) => (
                <motion.div
                  key={card.label}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className={`p-5 rounded-xl border ${card.border} bg-[#0f1011]/30 hover:border-opacity-60 transition-all`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-[#8a8f98] tracking-wider uppercase">{card.label}</span>
                    <div className={`w-8 h-8 rounded ${card.bg} border ${card.border} flex items-center justify-center ${card.color}`}>
                      <card.icon size={16} />
                    </div>
                  </div>

                  {card.value !== null ? (
                    <span className="text-3xl font-extrabold text-white">{card.value}</span>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-extrabold text-white">
                          {userStats?.questions_used_today ?? 0}
                          <span className="text-sm text-[#8a8f98] font-normal ml-1">
                            / {userStats?.quota_limit === 999999 ? '∞' : userStats?.quota_limit ?? 10}
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-[#141516] h-1.5 rounded-full overflow-hidden border border-[#23252a]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${quotaPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#565860] mt-1">câu hỏi hôm nay</p>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Upgrade Banner (Free users only) */}
          {userStats && isFree && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-[#5e6ad2]/10 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="text-amber-400 flex-shrink-0" size={24} />
                <div>
                  <p className="font-bold text-white">Nâng cấp lên Pro để không giới hạn câu hỏi</p>
                  <p className="text-xs text-[#8a8f98] mt-0.5">Gói Free giới hạn 10 câu hỏi/ngày. Pro không giới hạn + hỗ trợ tài liệu lớn hơn.</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/chat?section=manage&tab=pricing')}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-purple-600 text-white hover:opacity-90 transition-opacity flex items-center gap-2 flex-shrink-0"
              >
                Xem gói Pro <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="rounded-xl border border-[#23252a] bg-[#0f1011]/30 p-6"
          >
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-[#5e6ad2]" />
              Truy cập nhanh
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { 
                  label: 'Quay lại Chat', 
                  icon: MessageSquare, 
                  path: '/chat', 
                  desc: runningInDesktop ? 'Tiếp tục hội thoại' : 'Yêu cầu Desktop App 🖥️' 
                },
                { 
                  label: 'Cài đặt tài khoản', 
                  icon: Settings, 
                  path: '/settings', 
                  desc: 'Hồ sơ & mật khẩu' 
                },
                { 
                  label: 'Cài đặt AI', 
                  icon: Sparkles, 
                  path: '/settings/ai', 
                  desc: runningInDesktop ? 'Temperature, style...' : 'Yêu cầu Desktop App 🖥️' 
                },
              ].map((link) => (
                <button
                  key={link.path}
                  onClick={() => router.push(link.path)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-[#23252a] bg-[#141516]/50 hover:bg-[#141516] hover:border-[#2c2e35] transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center text-[#5e6ad2] flex-shrink-0 group-hover:bg-[#5e6ad2]/20 transition-colors">
                    <link.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{link.label}</p>
                    <p className="text-[10px] text-[#8a8f98]">{link.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

        </main>
      </div>
    </DesktopGuard>
  );
}

