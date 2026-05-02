'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Shield, FileText, ArrowLeft, Settings, LayoutDashboard, HelpCircle,
  ChevronLeft, ChevronRight, LogOut, Sparkles, Bell
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const { user, isAdmin, logout, loading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/chat');
    }
  }, [isAdmin, authLoading, router]);

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', name: 'Tổng quan', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'users', name: 'Nhân viên', icon: Users, path: '/admin/users' },
    { id: 'roles', name: 'Chức vụ', icon: Shield, path: '/admin/roles' },
    { id: 'documents', name: 'Tài liệu', icon: FileText, path: '/admin/documents' },
    { id: 'faqs', name: 'Hệ thống FAQ', icon: HelpCircle, path: '/admin/faqs' },
    { id: 'profile', name: 'Cài đặt', icon: Settings, path: '/admin/profile' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-be-vietnam overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className="bg-slate-900 text-slate-400 flex flex-col relative z-30 shadow-2xl"
      >
        <div className="py-6 flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className={cn(
            "flex items-center gap-3 mb-10 px-2 transition-all duration-300",
            !sidebarOpen && "justify-center px-0"
          )}>
            <div className="bg-primary-500 p-2 rounded-xl shadow-lg shadow-primary-500/20 shrink-0">
              <Sparkles className="text-white" size={20} />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.h1 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xl font-be-vietnam font-bold text-white tracking-tight whitespace-nowrap"
                >
                  Admin Panel
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.path || (pathname === '/admin' && tab.id === 'dashboard');
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.path)}
                  className={cn(
                    "w-full flex items-center transition-all duration-300 group rounded-xl",
                    sidebarOpen ? "gap-4 p-3" : "justify-center p-3 px-0",
                    isActive 
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" 
                      : "hover:bg-white/5 hover:text-white text-slate-400"
                  )}
                  title={!sidebarOpen ? tab.name : ""}
                >
                  <Icon size={20} className={cn("shrink-0", isActive ? "" : "group-hover:scale-110 transition-transform")} />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm font-medium whitespace-nowrap"
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
          <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
            <button
              onClick={() => router.push('/chat')}
              className={cn(
                "w-full flex items-center text-slate-400 hover:text-white hover:bg-white/5 transition-all group rounded-xl",
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
                "w-full flex items-center text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-all group rounded-xl",
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
          className="absolute -right-3 top-12 z-10 bg-white border border-slate-200 text-slate-500 p-1.5 rounded-full shadow-lg hover:shadow-xl hover:text-primary-600 hover:border-primary-300 transition-all active:scale-90 cursor-pointer"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-20">
          <div>
            <h2 className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-0.5">WikiBot Management</h2>
            <h1 className="text-2xl font-be-vietnam font-bold text-slate-900">
              {tabs.find(t => t.path === pathname)?.name || 'Tổng quan'}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded-xl transition-all">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 leading-none">{user?.full_name || user?.username}</p>
                <p className="text-[10px] text-primary-600 font-bold uppercase tracking-wider mt-1">Administrator</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary-600 font-bold shadow-sm">
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
          @apply bg-slate-200 rounded-full hover:bg-slate-300 transition-colors;
        }
      `}</style>
    </div>
  );
}
