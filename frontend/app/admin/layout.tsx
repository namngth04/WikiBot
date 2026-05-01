'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import {
  Users, Shield, FileText, ArrowLeft, Settings, LayoutDashboard, HelpCircle
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/chat');
    }
  }, [isAdmin, authLoading, router]);

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', name: 'Tổng quan', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'users', name: 'Quản lý Nhân viên', icon: Users, path: '/admin/users' },
    { id: 'roles', name: 'Quản lý Chức vụ', icon: Shield, path: '/admin/roles' },
    { id: 'documents', name: 'Quản lý Tài liệu', icon: FileText, path: '/admin/documents' },
    { id: 'faqs', name: 'Quản lý FAQ', icon: HelpCircle, path: '/admin/faqs' },
    { id: 'profile', name: 'Thông tin cá nhân', icon: Settings, path: '/admin/profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={20} />
              <span>Quay lại Chat</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
          </div>
          <div className="text-sm text-gray-500">
            {user?.full_name || user?.username} (Admin)
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.path || (pathname === '/admin' && tab.id === 'users');
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.path)}
                className={`px-6 py-3 flex items-center gap-2 font-medium transition-colors ${
                  isActive
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon size={18} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
