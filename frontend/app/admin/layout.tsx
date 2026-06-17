'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Users, Shield, FileText, LayoutDashboard, HelpCircle,
  ChevronLeft, LogOut, Bell, Brain, MessageSquare, Cpu, User, CreditCard
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ThemeToggle from '@/app/components/ThemeToggle';
import DesktopGuard from '@/components/DesktopGuard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, isCompanyAdmin, logout, loading: authLoading } = useAuth();

  // Redirect if not admin of any kind, or if system superadmin (→ /superadmin)
  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin && !isCompanyAdmin) {
        router.push('/chat');
      } else if (isAdmin && (user?.tenant_id === null || user?.tenant_id === undefined)) {
        router.push('/superadmin');
      }
    }
  }, [isAdmin, isCompanyAdmin, user, authLoading, router]);

  if (authLoading || (!isAdmin && !isCompanyAdmin) || (isAdmin && (user?.tenant_id === null || user?.tenant_id === undefined))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas transition-colors duration-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-lavender"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', name: 'Tổng quan', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'users', name: 'Nhân viên', icon: Users, path: '/admin/users' },
    { id: 'roles', name: 'Vai trò', icon: Shield, path: '/admin/roles' },
    { id: 'documents', name: 'Tài liệu', icon: FileText, path: '/admin/documents' },
    { id: 'faqs', name: 'Hệ thống FAQ', icon: HelpCircle, path: '/admin/faqs' },
    { id: 'feedback', name: 'Ý kiến phản hồi', icon: MessageSquare, path: '/admin/feedback' },
    { id: 'models', name: 'Mô hình AI', icon: Cpu, path: '/admin/models' },
    { id: 'profile', name: 'Quản lý tài khoản', icon: User, path: '/admin/profile' },
    { id: 'pricing', name: 'Quản lý gói cước', icon: CreditCard, path: '/admin/pricing' },
  ];

  return (
    <DesktopGuard allowAdminWeb={true}>
      <div className="min-h-screen bg-canvas flex font-be-vietnam overflow-hidden text-ink transition-colors duration-200">
        {/* Sidebar */}
        <aside className="bg-surface-1 border-r border-hairline text-ink-muted flex flex-col w-64 shrink-0 transition-colors duration-200">
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
              <h1 className="text-sm font-bold tracking-tight text-ink">Quản trị</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.path || (pathname === '/admin' && tab.id === 'dashboard');
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
                    <p className="text-[8px] text-ink-subtle uppercase font-semibold leading-none mt-0.5">
                      {isCompanyAdmin ? 'Doanh nghiệp' : 'Quản trị'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => logout()}
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
          <header className="h-20 bg-surface-1/70 backdrop-blur-md sticky top-0 border-b border-hairline px-8 flex items-center justify-between shrink-0 z-[90] shadow-sm transition-colors duration-200">
            <div>
              <h1 className="text-2xl font-be-vietnam font-bold text-ink">
                {tabs.find(t => t.path === pathname)?.name || 'Tổng quan'}
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <ThemeToggle />
              <button className="relative p-2 text-ink-muted hover:text-brand-lavender hover:bg-surface-2 rounded-xl transition-all">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-surface-1"></span>
              </button>
              <div className="h-8 w-px bg-hairline"></div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-ink leading-none">{user?.full_name || user?.username}</p>
                  <p className="text-[10px] text-brand-lavender font-bold uppercase tracking-wider mt-1">{isCompanyAdmin ? 'Company Admin' : 'Administrator'}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-brand-lavender font-bold border border-hairline shadow-sm">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          {/* Content Scroll Area */}
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* Styles for scrollbar */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 5px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            @apply bg-hairline rounded-full hover:bg-hairline-strong transition-colors;
          }
        `}</style>
      </div>
    </DesktopGuard>
  );
}
