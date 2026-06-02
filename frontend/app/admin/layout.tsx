'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Shield, FileText, ArrowLeft, Settings, LayoutDashboard, HelpCircle,
  ChevronLeft, ChevronRight, LogOut, Sparkles, Bell, Brain, MessageSquare, User
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AppLogo from '@/app/components/AppLogo';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Redirect if not admin of any kind, or if system superadmin (→ /superadmin)
  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin && !isCompanyAdmin) {
        router.push('/chat');
      } else if (isAdmin && (user?.tenant_id === null || user?.tenant_id === undefined)) {
        router.push('/superadmin');
      }
      // isCompanyAdmin (tenant_id not null) → stay at /admin
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
    { id: 'roles', name: 'Chức vụ', icon: Shield, path: '/admin/roles' },
    { id: 'documents', name: 'Tài liệu', icon: FileText, path: '/admin/documents' },
    { id: 'faqs', name: 'Hệ thống FAQ', icon: HelpCircle, path: '/admin/faqs' },
    { id: 'feedback', name: 'Ý kiến phản hồi', icon: MessageSquare, path: '/admin/feedback' },
    { id: 'ai-config', name: 'Cấu hình AI', icon: Brain, path: '/admin/ai-config' },
  ];

  return (
    <DesktopGuard allowAdminWeb={true}>
      <div className="min-h-screen bg-canvas flex font-be-vietnam overflow-hidden text-ink transition-colors duration-200">
        {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 80 }}
        className="bg-surface-1 border-r border-hairline text-ink-muted flex flex-col relative z-30 transition-all duration-300"
      >
        <div className="py-6 flex flex-col h-full overflow-hidden px-4">
          {/* Logo */}
          <div className={cn(
            "flex items-center gap-3 mb-10 px-2 transition-all duration-300",
            !sidebarOpen && "justify-center px-0"
          )}>
            <AppLogo size="md" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.h1 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xl font-be-vietnam font-bold text-ink tracking-tight whitespace-nowrap"
                >
                  Admin Panel
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 relative">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.path || (pathname === '/admin' && tab.id === 'dashboard');
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.path)}
                  className={cn(
                    "w-full flex items-center transition-all duration-300 group rounded-2xl relative overflow-hidden",
                    sidebarOpen ? "gap-4 p-3.5" : "justify-center p-3.5 px-0",
                    isActive 
                      ? "text-white font-bold" 
                      : "hover:bg-surface-2 hover:text-ink text-ink-subtle"
                  )}
                  title={!sidebarOpen ? tab.name : ""}
                >
                  {/* Active Background Indicator using layoutId */}
                  {isActive && (
                    <motion.div
                      layoutId="activeAdminTab"
                      className="absolute inset-0 bg-brand-lavender shadow-lg shadow-brand-lavender/20 z-0 rounded-2xl"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}

                  <Icon size={20} className={cn(
                    "shrink-0 group-hover:scale-110 transition-transform relative z-10",
                    isActive ? "text-white" : "text-ink-subtle"
                  )} />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm font-medium whitespace-nowrap relative z-10"
                      >
                        {tab.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="mt-auto pt-6 border-t border-hairline space-y-2">
            <button
              onClick={() => router.push('/chat')}
              className={cn(
                "w-full flex items-center text-ink-muted hover:text-ink hover:bg-surface-2 transition-all group rounded-xl",
                sidebarOpen ? "gap-4 p-3" : "justify-center p-3 px-0"
              )}
              title={!sidebarOpen ? "Quay lại Chat" : ""}
            >
              <ArrowLeft size={20} className="shrink-0 group-hover:-translate-x-1 transition-transform" />
              {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">Quay lại Chat</span>}
            </button>
            <button
              onClick={() => logout()}
              className={cn(
                "w-full flex items-center text-ink-muted hover:text-rose-400 hover:bg-rose-950/20 transition-all group rounded-xl",
                sidebarOpen ? "gap-4 p-3" : "justify-center p-3 px-0"
              )}
              title={!sidebarOpen ? "Đăng xuất" : ""}
            >
              <LogOut size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
              {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">Đăng xuất</span>}
            </button>
          </div>
        </div>

        {/* Toggle Sidebar */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-12 z-10 bg-surface-1 border border-hairline text-ink-muted p-1.5 rounded-full shadow-lg hover:shadow-xl hover:text-brand-lavender hover:border-brand-lavender/50 transition-all active:scale-90 cursor-pointer"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-surface-1/70 backdrop-blur-md sticky top-0 border-b border-hairline px-8 flex items-center justify-between shrink-0 z-[90] shadow-sm transition-colors duration-200">
          <div>
            <h2 className="text-sm text-ink-subtle font-bold uppercase tracking-widest mb-0.5">WikiBot Management</h2>
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
