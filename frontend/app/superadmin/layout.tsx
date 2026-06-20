'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import ThemeToggle from '@/app/components/ThemeToggle';
import AppLogo from '@/app/components/AppLogo';
import { 
  Users, Building, Cpu, DollarSign, CreditCard, User, LayoutDashboard,
  LogOut, ShieldAlert, Loader2, ChevronLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/app/lib/utils';

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, logout, isAdmin } = useAuth();

  const isSuperadmin = isAdmin && user?.tenant_id === null;

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isSuperadmin) {
        router.push('/chat');
      }
    }
  }, [user, authLoading, isSuperadmin]);

  const sidebarTabs = [
    { id: 'dashboard', name: 'Tổng quan', icon: LayoutDashboard, path: '/superadmin' },
    { id: 'tenants', name: 'Doanh nghiệp', icon: Building, path: '/superadmin/tenants' },
    { id: 'personal-users', name: 'Người dùng cá nhân', icon: Users, path: '/superadmin/personal-users' },
    { id: 'models', name: 'Mô hình AI', icon: Cpu, path: '/superadmin/models' },
    { id: 'business-stats', name: 'Thống kê kinh doanh', icon: DollarSign, path: '/superadmin/business-stats' },
    { id: 'upgrade-logs', name: 'Lịch sử nâng cấp', icon: CreditCard, path: '/superadmin/upgrade-logs' },
    { id: 'profile', name: 'Quản lý tài khoản', icon: User, path: '/superadmin/profile' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#010102] flex items-center justify-center text-white">
        <Loader2 className="animate-spin text-[#5e6ad2]" size={36} />
      </div>
    );
  }

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

  const currentTabName = sidebarTabs.find(t => t.path === pathname)?.name || 'Tổng quan';

  return (
    <div className="min-h-screen bg-canvas flex font-be-vietnam overflow-hidden text-ink transition-colors duration-200">
      
      {/* Sidebar */}
      <aside className="bg-surface-1 border-r border-hairline text-ink-muted flex flex-col w-64 shrink-0 transition-colors duration-200 relative z-40">
        <div className="p-4 flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center gap-3 mb-6 px-2">
            <button
              onClick={() => router.push('/chat')}
              className="p-1.5 border border-hairline text-ink-subtle hover:text-brand-lavender hover:bg-surface-2 rounded-md transition-all active:scale-90"
              title="Quay lại Chat"
            >
              <ChevronLeft size={16} />
            </button>
            <h1 className="text-sm font-bold tracking-tight text-ink">Quản trị hệ thống</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.path;
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.path)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg text-left text-xs font-semibold transition-all border border-transparent",
                    isActive
                      ? "bg-surface-2 border-hairline text-ink"
                      : "text-ink-muted hover:bg-surface-1/50 hover:text-ink"
                  )}
                  title={tab.name}
                >
                  <Icon size={15} className={isActive ? "text-brand-lavender" : "text-ink-subtle"} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>

          {/* User Info & Logout at bottom of admin sidebar */}
          <div className="mt-auto pt-4 border-t border-hairline px-2">
            <div className="flex items-center justify-between p-2 bg-surface-2 border border-hairline rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-brand-lavender flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-ink truncate leading-tight">{user?.full_name || user?.username}</p>
                  <p className="text-[8px] text-brand-lavender font-bold uppercase tracking-wider leading-none mt-0.5">
                    SUPERADMIN
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="p-1 text-ink-subtle hover:text-red-400 hover:bg-red-950/20 rounded transition-all"
                title="Đăng xuất"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-surface-1/70 backdrop-blur-md sticky top-0 border-b border-hairline px-8 flex items-center justify-between shrink-0 z-30 shadow-sm transition-colors duration-200">
          <div>
            <h2 className="text-sm text-ink-subtle font-bold uppercase tracking-widest mb-0.5">WikiBot Systems Control</h2>
            <h1 className="text-2xl font-be-vietnam font-bold text-ink">
              {currentTabName}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <ThemeToggle />
            <div className="h-8 w-px bg-hairline"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-ink leading-none">{user?.full_name || user?.username}</p>
                <p className="text-[10px] text-brand-lavender font-bold uppercase tracking-wider mt-1">Superadmin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-brand-lavender font-bold border border-hairline shadow-sm">
                {user?.username.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-canvas relative z-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
