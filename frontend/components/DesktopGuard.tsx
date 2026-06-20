'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { isElectron } from '@/app/lib/platform';
import AppLogo from '@/app/components/AppLogo';

interface DesktopGuardProps {
  children: React.ReactNode;
  allowAdminWeb?: boolean; // If true, Super Admins can bypass on web browser
  allowWebDashboard?: boolean; // If true, rendering is allowed on Web for dashboard overview
}

export default function DesktopGuard({ children, allowAdminWeb = true, allowWebDashboard = false }: DesktopGuardProps) {
  const [runningInDesktop, setRunningInDesktop] = useState(true); // Default true to prevent flash
  const [checking, setChecking] = useState(true);
  const [userRole, setUserRole] = useState<{ level: number } | null>(null);

  useEffect(() => {
    // Check if running in Electron
    const isDesktop = isElectron();
    setRunningInDesktop(isDesktop);
    
    // Retrieve user for role-based bypass
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUserRole(u.role || null);
      } catch (e) {
        console.error(e);
      }
    }
    
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#010102]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#5e6ad2]"></div>
          <p className="text-[#8a8f98] font-medium animate-pulse">Đang kiểm định môi trường...</p>
        </div>
      </div>
    );
  }

  // If in desktop app, allow access immediately
  if (runningInDesktop) {
    return <>{children}</>;
  }

  // Bypass for Dashboard on web browser if allowed
  if (allowWebDashboard) {
    return <>{children}</>;
  }

  // Bypass for Super Admin / System Admin if allowed
  if (allowAdminWeb && userRole && userRole.level === 0) {
    return <>{children}</>;
  }

  // Otherwise, show the premium blocking/download page
  return (
    <div className="min-h-screen bg-[#010102] text-[#f7f8f8] flex flex-col justify-between selection:bg-[#5e6ad2]/30 selection:text-white font-sans antialiased relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-[500px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] rounded-full bg-[#5e6ad2]/10 blur-[130px] animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="z-10 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <AppLogo size="md" />
          </Link>
          <Link 
            href="/" 
            className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="max-w-xl w-full p-8 md:p-10 rounded-2xl border border-[#23252a] bg-[#0f1011]/80 backdrop-blur-xl shadow-2xl shadow-[#5e6ad2]/5 text-center flex flex-col items-center">
          {/* Icon/Logo */}
          <div className="w-16 h-16 rounded-2xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center text-3xl mb-8 shadow-inner shadow-[#5e6ad2]/20 relative group">
            <AppLogo size="lg" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500" />
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8a8f98] mb-4">
            Tải ứng dụng WikiBot Desktop
          </h2>
          
          <p className="text-sm md:text-base text-[#8a8f98] max-w-sm font-light leading-relaxed mb-8">
            Để bảo mật tối đa tri thức doanh nghiệp, tối ưu hóa xử lý OCR ngoại tuyến và đồng bộ LLM cục bộ, phòng chat & xử lý tài liệu chỉ khả dụng trên **ứng dụng Desktop**.
          </p>

          {/* Feature highlights */}
          <div className="w-full grid grid-cols-2 gap-3 mb-8 text-left text-xs text-[#8a8f98]">
            <div className="p-3 rounded-lg border border-[#23252a]/40 bg-[#0b0c0d]/40 flex items-center gap-2">
              <span className="text-[#5e6ad2] text-sm">✔</span>
              <span>Hỏi đáp Offline 100%</span>
            </div>
            <div className="p-3 rounded-lg border border-[#23252a]/40 bg-[#0b0c0d]/40 flex items-center gap-2">
              <span className="text-[#5e6ad2] text-sm">✔</span>
              <span>Xử lý OCR PDF & Word</span>
            </div>
            <div className="p-3 rounded-lg border border-[#23252a]/40 bg-[#0b0c0d]/40 flex items-center gap-2">
              <span className="text-[#5e6ad2] text-sm">✔</span>
              <span>Tích hợp Ollama Local</span>
            </div>
            <div className="p-3 rounded-lg border border-[#23252a]/40 bg-[#0b0c0d]/40 flex items-center gap-2">
              <span className="text-[#5e6ad2] text-sm">✔</span>
              <span>Phân quyền RBAC tối mật</span>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="w-full flex flex-col gap-3">
            <a 
              href="#" 
              className="w-full py-3.5 px-6 font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#5e6ad2]/20 flex items-center justify-center gap-2"
            >
              📥 Tải về cho Windows (.exe)
            </a>
            
            <div className="flex gap-3">
              <a 
                href="#" 
                className="flex-1 py-3 px-4 text-xs font-semibold border border-[#23252a] hover:border-[#34343a] bg-[#0f1011] hover:bg-[#141516] text-[#f7f8f8] rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                🍎 macOS (.dmg)
              </a>
              <a 
                href="#" 
                className="flex-1 py-3 px-4 text-xs font-semibold border border-[#23252a] hover:border-[#34343a] bg-[#0f1011] hover:bg-[#141516] text-[#f7f8f8] rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                🐧 Linux (.AppImage)
              </a>
            </div>
          </div>

          {/* Pro Upgrade teaser */}
          <div className="mt-8 pt-6 border-t border-[#23252a]/60 w-full flex items-center justify-between text-xs">
            <span className="text-[#8a8f98]">Bạn muốn nâng cấp tài khoản?</span>
            <Link 
              href="/pricing" 
              className="text-[#5e6ad2] hover:underline font-semibold"
            >
              Xem gói Pro & Enterprise ⚡
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[#8a8f98] border-t border-[#23252a]/40 bg-[#010102]">
        WikiBot © 2026. Môi trường ứng dụng an toàn.
      </footer>
    </div>
  );
}
