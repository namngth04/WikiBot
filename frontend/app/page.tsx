'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isElectron } from '@/app/lib/platform';
import LandingPage from '@/app/landing/page';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [runningInDesktop, setRunningInDesktop] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDesktop = isElectron();
    setRunningInDesktop(isDesktop);
    try {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
    } catch (e) {
      console.error('Lỗi khi truy cập localStorage:', e);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    // Chỉ tự động chuyển hướng sang /chat trên Desktop App (Electron) nếu đã có token
    if (mounted && runningInDesktop && token) {
      router.replace('/chat');
    }
  }, [mounted, runningInDesktop, token, router]);

  // Trong lúc SSR hoặc đang khởi chạy hydration, hiển thị loader tối giản
  if (checking || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#010102]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5e6ad2]"></div>
          <p className="text-sm text-[#8a8f98] font-medium animate-pulse">Đang khởi chạy WikiBot...</p>
        </div>
      </div>
    );
  }

  // NẾU ĐANG CHẠY TRÊN DESKTOP APP (ELECTRON)
  if (runningInDesktop) {
    if (token) {
      // Đã có token, đang trong quá trình chuyển hướng sang /chat
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#010102]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5e6ad2]"></div>
            <p className="text-sm text-[#8a8f98] font-medium animate-pulse">Đang đi tới phòng chat...</p>
          </div>
        </div>
      );
    }
    
    // Nếu chọn Đăng ký trên Desktop: hiển thị RegisterPage trực tiếp
    if (showRegister) {
      return <RegisterPage onSwitchToLogin={() => setShowRegister(false)} />;
    }
    
    // Mặc định: Render trực tiếp LoginPage ngay tại trang chủ Desktop
    return <LoginPage onSwitchToRegister={() => setShowRegister(true)} />;
  }

  // NẾU CHẠY TRÊN WEB BROWSER THÔNG THƯỜNG: Hiển thị Landing Page giới thiệu
  return <LandingPage />;
}





