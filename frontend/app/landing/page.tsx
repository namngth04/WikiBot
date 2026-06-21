'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import AppLogo from '@/app/components/AppLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronDown, Monitor, Download, ShieldCheck, Sparkles, Cpu } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#010102] text-[#f7f8f8] selection:bg-[#5e6ad2]/30 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[50%] h-[60%] rounded-full bg-[#5e6ad2]/10 blur-[120px]" />
        <div className="absolute top-[-5%] right-[20%] w-[40%] h-[50%] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <AppLogo size="md" />
              <span className="font-be-vietnam font-extrabold tracking-tight text-white group-hover:text-blue-400 transition-colors">WikiBot</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">Tính năng</a>
              <a href="#download" className="text-sm text-[#a5b4fc] hover:text-[#f7f8f8] transition-colors flex items-center gap-1 font-semibold">📥 Tải App Desktop</a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full border border-[#23252a] animate-pulse bg-[#0f1011]" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                {/* User Avatar Circle */}
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 p-1.5 rounded-xl border border-[#23252a] bg-[#0f1011]/80 hover:bg-[#141516] hover:border-[#34343a] transition-all duration-200 active:scale-[0.98] select-none"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] flex items-center justify-center font-bold text-white text-xs shadow-md shadow-[#5e6ad2]/20">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={14} className={`text-[#8a8f98] transition-transform duration-200 mr-1 ${showDropdown ? 'rotate-180 text-white' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2.5 w-64 rounded-xl border border-[#23252a] bg-[#0f1011]/95 backdrop-blur-xl p-2.5 shadow-2xl shadow-[#5e6ad2]/5 z-50 overflow-hidden text-left"
                    >
                      {/* Glow effect */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#5e6ad2]/5 blur-xl rounded-full pointer-events-none" />

                      {/* User profile segment */}
                      <div className="px-3 py-2.5 border-b border-[#23252a]/60 mb-2">
                        <p className="text-xs font-semibold text-white truncate">{user.full_name || user.username}</p>
                        <p className="text-[10px] text-[#8a8f98] truncate mt-0.5">@{user.username}</p>
                      </div>

                      {/* Action items */}
                      <div className="space-y-1">
                        <button
                          onClick={() => { setShowDropdown(false); logout(); router.push('/'); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/10 text-left"
                        >
                          <LogOut size={14} />
                          Đăng xuất
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-4 py-1.5 text-xs font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-lg shadow-[#5e6ad2]/20"
                >
                  Đăng ký tài khoản
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 text-[#5e6ad2] text-xs font-medium tracking-wide mb-8 shadow-inner shadow-[#5e6ad2]/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5e6ad2] animate-ping" />
          Mới: Hỗ trợ RAG đa phương thức và trích xuất tài liệu nâng cao
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-[#d0d6e0] to-[#8a8f98] max-w-4xl leading-[1.08] mb-6">
          Trợ lý Tri thức Nội bộ ngay trên Desktop của bạn
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-xl text-[#8a8f98] max-w-2xl font-light leading-relaxed mb-10">
          Quản lý tài liệu thông minh, tra cứu RAG chính xác, hỗ trợ OCR văn bản giấy tờ và kết nối mô hình local Ollama bảo mật. Đăng ký tài khoản và tải ứng dụng Desktop Client để bắt đầu.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-xl shadow-[#5e6ad2]/20 flex items-center justify-center gap-2"
          >
            Đăng ký sử dụng ⚡
          </Link>
          <a
            href="#download"
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold border border-[#23252a] hover:border-[#34343a] bg-[#0f1011]/80 hover:bg-[#141516]/80 text-[#f7f8f8] rounded-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Tải ứng dụng Desktop
          </a>
        </div>

        {/* Window Mockup Preview */}
        <div className="w-full max-w-5xl rounded-xl border border-[#23252a] bg-[#0f1011] overflow-hidden shadow-2xl shadow-[#5e6ad2]/5 aspect-[16/10] relative group">
          <div className="absolute inset-0 bg-gradient-to-t from-[#010102] via-transparent to-transparent opacity-60 z-10" />

          {/* Window Header */}
          <div className="h-10 border-b border-[#23252a]/70 px-4 flex items-center gap-2 bg-[#0b0c0d]/60">
            <span className="w-3 h-3 rounded-full bg-red-500/20 group-hover:bg-red-500/60 transition-colors" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/20 group-hover:bg-yellow-500/60 transition-colors" />
            <span className="w-3 h-3 rounded-full bg-green-500/20 group-hover:bg-green-500/60 transition-colors" />
            <span className="text-[11px] text-[#8a8f98] font-mono ml-4">wikibot-app://desktop-client</span>
          </div>

          {/* Mockup Chat Workspace */}
          <div className="p-6 flex gap-6 h-[calc(100%-40px)] text-left select-none">
            {/* Sidebar */}
            <div className="w-1/4 hidden md:flex flex-col gap-4 border-r border-[#23252a]/50 pr-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8a8f98]">CUỘC TRÒ CHUYỆN</span>
                <span className="text-[10px] text-[#5e6ad2] font-semibold border border-[#5e6ad2]/30 px-1.5 py-0.5 rounded">NEW</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="p-2.5 rounded-md bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-xs font-medium text-[#f7f8f8]">
                  💬 Quy định nghỉ phép nhân viên
                </div>
                <div className="p-2.5 rounded-md hover:bg-[#141516] transition-colors text-xs text-[#8a8f98]">
                  💬 Tài liệu kỹ thuật dự án
                </div>
                <div className="p-2.5 rounded-md hover:bg-[#141516] transition-colors text-xs text-[#8a8f98]">
                  💬 Quy trình phê duyệt mua hàng
                </div>
              </div>
            </div>

            {/* Chat Container Area */}
            <div className="flex-1 flex flex-col h-full relative">
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto mb-16 scrollbar-thin">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-[#141516] border border-[#23252a] flex items-center justify-center text-xs font-bold text-[#8a8f98]">U</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold mb-1 text-[#8a8f98]">Người dùng</h4>
                    <p className="text-xs text-[#d0d6e0] leading-relaxed">Hãy tóm tắt chính sách nghỉ phép của nhân viên.</p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-[#23252a]/20 pt-4">
                  <div className="w-8 h-8 rounded bg-[#5e6ad2]/15 border border-[#5e6ad2]/30 flex items-center justify-center text-xs"><AppLogo size="sm" /></div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold mb-1 text-[#5e6ad2] flex items-center gap-2">
                      WikiBot
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">Tin cậy</span>
                    </h4>
                    <div className="text-xs text-[#d0d6e0] space-y-2 leading-relaxed">
                      <p>Dựa trên **Quy chế Nhân sự** (trang 12), chính sách nghỉ phép của nhân viên được quy định như sau:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>**Số ngày phép**: Nhân viên chính thức có 12 ngày phép hưởng nguyên lương mỗi năm.</li>
                        <li>**Thâm niên**: Cứ mỗi 5 năm làm việc, số ngày phép sẽ tăng thêm 1 ngày.</li>
                      </ul>
                      <div className="mt-3 p-2 bg-[#0b0c0d]/60 border border-[#23252a] rounded flex items-center gap-2 text-[10px]">
                        <span className="text-amber-500 font-bold">📄 Trích dẫn:</span>
                        <span className="text-[#8a8f98] underline">Quy-che-nhan-su.pdf (Trang 12)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#141516] border border-[#23252a] rounded-lg px-4 flex items-center justify-between">
                <span className="text-xs text-[#8a8f98]">Hỏi WikiBot bất cứ điều gì về tài liệu...</span>
                <span className="px-2 py-1 rounded bg-[#5e6ad2] text-[10px] font-bold text-white shadow-md">GỬI ↵</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-24 px-6 border-t border-[#23252a]/40 bg-[#0b0c0d]/40 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#5e6ad2] text-xs font-bold tracking-widest uppercase">Trải Nghiệm Cải Tiến</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mt-2">Tính năng chuyên biệt trên ứng dụng Desktop</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-xl border border-[#23252a] bg-[#0f1011]/60 hover:bg-[#0f1011] transition-all hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-[#5e6ad2]/5">
              <div className="w-10 h-10 rounded bg-[#5e6ad2]/10 border border-[#5e6ad2]/30 flex items-center justify-center text-lg mb-6"><Monitor size={20} className="text-[#5e6ad2]" /></div>
              <h3 className="text-lg font-bold text-white mb-2">Giao diện Desktop mượt mà</h3>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Ứng dụng khách Client độc lập cài trên máy tính giúp trò chuyện, xuất tài liệu và quản lý tri thức một cách nhanh chóng, tối ưu hóa phần cứng và hiển thị không độ trễ.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-xl border border-[#23252a] bg-[#0f1011]/60 hover:bg-[#0f1011] transition-all hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-[#5e6ad2]/5">
              <div className="w-10 h-10 rounded bg-indigo-500/10 border border-indigo-500/30 flex items-center center text-lg mb-6"><Cpu size={20} className="text-indigo-400" /></div>
              <h3 className="text-lg font-bold text-white mb-2">Vận hành Mô hình Local Độc lập</h3>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Kết nối và chạy trực tiếp các mô hình AI cục bộ ngay trên hạ tầng máy chủ. Không phụ thuộc vào Cloud bên thứ ba, bảo mật thông tin tuyệt đối.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-xl border border-[#23252a] bg-[#0f1011]/60 hover:bg-[#0f1011] transition-all hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-[#5e6ad2]/5">
              <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg mb-6"><ShieldCheck size={20} className="text-emerald-400" /></div>
              <h3 className="text-lg font-bold text-white mb-2">Quản lý và số hóa tài liệu RAG</h3>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Tải lên và tự động chuyển đổi file PDF, Word, Ảnh OCR, Markdown thành vector tri thức. Hỗ trợ hệ thống phân quyền tài liệu RBAC nghiêm ngặt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Download Desktop App Section */}
      <section id="download" className="py-24 px-6 border-t border-[#23252a]/40 bg-gradient-to-b from-transparent to-[#0f1011]/20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#5e6ad2] text-xs font-bold tracking-widest uppercase mb-3 block">BẢN CÀI ĐẶT DESKTOP</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
            Tải WikiBot Client
          </h2>
          <p className="text-sm md:text-base text-[#8a8f98] max-w-2xl mx-auto font-light leading-relaxed mb-12">
            Trải nghiệm trọn vẹn sức mạnh của trợ lý tri thức RAG kết hợp OCR. Chọn bản tải xuống tương ứng với hệ điều hành của bạn.
          </p>

          {/* OS Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 max-w-2xl mx-auto">
            {/* Windows */}
            <div className="p-6 rounded-2xl border border-[#23252a] bg-[#0b0c0d]/60 backdrop-blur-sm flex flex-col items-center hover:border-[#5e6ad2]/30 transition-all hover:scale-[1.02] group">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                🪟
              </div>
              <h3 className="font-bold text-white mb-1">Windows</h3>
              <span className="text-[10px] text-[#8a8f98] mb-6">Windows 10 / 11 (.exe installer)</span>
              <a
                href="/downloads/WikiBot-Setup.exe"
                className="w-full py-2.5 bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-md shadow-[#5e6ad2]/10"
              >
                📥 Tải Installer Windows
              </a>
            </div>

            {/* macOS */}
            <div className="p-6 rounded-2xl border border-[#23252a] bg-[#0b0c0d]/60 backdrop-blur-sm flex flex-col items-center hover:border-[#5e6ad2]/30 transition-all hover:scale-[1.02] group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                🍎
              </div>
              <h3 className="font-bold text-white mb-1">macOS</h3>
              <span className="text-[10px] text-[#8a8f98] mb-6">M1/M2/M3 & Intel Silicon (.dmg)</span>
              <a
                href="/downloads/WikiBot-Mac.dmg"
                className="w-full py-2.5 bg-[#141516] hover:bg-[#1c1e22] text-[#f7f8f8] font-semibold border border-[#23252a] rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
              >
                📥 Tải Installer macOS
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto relative z-10 border-t border-[#23252a]/40">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
          Bắt đầu chuẩn hóa tri thức nội bộ ngay hôm nay
        </h2>
        <p className="text-base text-[#8a8f98] mb-10 max-w-xl mx-auto font-light">
          Tạo tài khoản cá nhân hoặc doanh nghiệp dùng thử miễn phí, cài đặt ứng dụng Desktop Client và bắt đầu RAG tài liệu.
        </p>
        <Link
          href="/register"
          className="px-8 py-3.5 text-sm font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-lg shadow-[#5e6ad2]/20 inline-flex items-center gap-2"
        >
          Đăng ký dùng thử ngay ⚡
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#23252a]/40 py-12 px-6 relative z-10 text-xs text-[#8a8f98] bg-[#010102]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <AppLogo size="sm" />
            <span className="font-semibold text-white">WikiBot</span>
            <span>© 2026. Tất cả quyền được bảo lưu.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</a>
            <a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

