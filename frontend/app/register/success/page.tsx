'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, CheckCircle, ArrowRight, Laptop, Home } from 'lucide-react';
import AppLogo from '@/app/components/AppLogo';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export default function RegisterSuccessPage() {
  useEffect(() => {
    // Automatically trigger the download after page load
    const timer = setTimeout(() => {
      window.location.href = '/downloads/WikiBot-Setup.exe';
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] relative overflow-hidden py-12 px-4 select-none">
      {/* Background gradients */}
      <motion.div
        className="absolute -top-20 -left-20 w-[450px] h-[450px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [0, 30, 0], y: [0, 40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Main card */}
      <motion.div
        className="relative z-10 w-full max-w-xl"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="backdrop-blur-2xl bg-slate-900/75 border border-slate-800/80 p-8 md:p-10 rounded-3xl shadow-2xl relative text-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none" />

          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <Link href="/">
              <AppLogo size="lg" className="hover:scale-105 transition-transform duration-300" />
            </Link>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Success Icon */}
            <motion.div variants={itemVariants} className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
                <CheckCircle className="text-emerald-500 relative z-10" size={72} />
              </div>
            </motion.div>

            {/* Success Title */}
            <motion.div variants={itemVariants}>
              <h1 className="text-3xl font-bold text-white tracking-tight bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-slate-200">
                Đăng ký thành công!
              </h1>
              <p className="text-slate-400 mt-2 text-sm font-light leading-relaxed">
                Tài khoản của bạn đã sẵn sàng. Ứng dụng Desktop (Electron) đang được tải xuống tự động...
              </p>
            </motion.div>

            {/* Manual Download Button */}
            <motion.div variants={itemVariants} className="pt-2">
              <a
                href="/downloads/WikiBot-Setup.exe"
                className="inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-medium shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm cursor-pointer"
              >
                <Download size={18} />
                Tự tải xuống thủ công (nếu không tự chạy)
              </a>
            </motion.div>

            {/* Installation Instructions */}
            <motion.div
              variants={itemVariants}
              className="bg-[#0b0f19]/60 border border-slate-800/80 rounded-2xl p-6 text-left space-y-4 mt-4"
            >
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Laptop size={16} className="text-blue-400" />
                Hướng dẫn cài đặt & sử dụng:
              </h3>
              
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400">
                    1
                  </span>
                  <p className="pt-0.5">
                    Chạy file <code className="text-blue-300 font-mono">WikiBot-Setup.exe</code> vừa tải về máy để tiến hành cài đặt ứng dụng.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400">
                    2
                  </span>
                  <p className="pt-0.5">
                    Mở ứng dụng WikiBot trên Desktop, sử dụng <strong>tên đăng nhập</strong> và <strong>mật khẩu</strong> bạn vừa tạo để đăng nhập.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400">
                    3
                  </span>
                  <p className="pt-0.5">
                    Bắt đầu trải nghiệm các tính năng chat RAG thông minh, tải lên tài liệu PDF/Excel và quản lý tri thức cục bộ.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Back Home */}
            <motion.div variants={itemVariants} className="pt-4 border-t border-slate-800/60">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs"
              >
                <Home size={14} />
                Quay lại Trang chủ
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
