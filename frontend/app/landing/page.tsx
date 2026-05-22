'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import AppLogo from '@/app/components/AppLogo';

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

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
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">Tính năng</a>
              <a href="#architecture" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">Kiến trúc</a>
              <Link href="/pricing" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">Bảng giá</Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full border border-[#23252a] animate-pulse bg-[#0f1011]" />
            ) : user ? (
              <>
                <Link 
                  href="/chat" 
                  className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors font-medium"
                >
                  Phòng chat
                </Link>
                <Link 
                  href="/chat" 
                  className="px-4 py-1.5 text-xs font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-lg shadow-[#5e6ad2]/20"
                >
                  Vào WikiBot ⚡
                </Link>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors font-medium"
                >
                  Đăng nhập
                </Link>
                <Link 
                  href="/login" 
                  className="px-4 py-1.5 text-xs font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-lg shadow-[#5e6ad2]/20"
                >
                  Dùng thử miễn phí
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 text-[#5e6ad2] text-xs font-medium tracking-wide mb-8 animate-fade-in shadow-inner shadow-[#5e6ad2]/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5e6ad2] animate-ping" />
          Giới thiệu phiên bản WikiBot v2.0 - Hệ thống RAG đa phương thức
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-[#d0d6e0] to-[#8a8f98] max-w-4xl leading-[1.08] mb-6 letter-spacing-[-2.5px]">
          Khai phá tri thức nội bộ doanh nghiệp với AI thế hệ mới
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-xl text-[#8a8f98] max-w-2xl font-light leading-relaxed mb-10">
          Số hóa kho tài liệu PDF, Word, Txt thông minh. Hỏi đáp trích dẫn nguồn cực kỳ chính xác, phân quyền RBAC nghiêm ngặt và hỗ trợ triển khai Offline 100%.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link 
            href={user ? "/chat" : "/login"} 
            className="w-full sm:w-auto px-8 py-3 text-sm font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-xl shadow-[#5e6ad2]/20 flex items-center justify-center gap-2"
          >
            {user ? "Vào phòng chat ngay" : "Bắt đầu miễn phí ngay"} ⚡
          </Link>
          <Link 
            href="/pricing" 
            className="w-full sm:w-auto px-8 py-3 text-sm font-semibold border border-[#23252a] hover:border-[#34343a] bg-[#0f1011]/80 hover:bg-[#141516]/80 text-[#f7f8f8] rounded-md transition-all active:scale-[0.98] flex items-center justify-center"
          >
            Xem bảng giá & Gói cước
          </Link>
        </div>

        {/* Interactive Mockup Preview */}
        <div className="w-full max-w-5xl rounded-xl border border-[#23252a] bg-[#0f1011] overflow-hidden shadow-2xl shadow-[#5e6ad2]/5 aspect-[16/10] relative group">
          <div className="absolute inset-0 bg-gradient-to-t from-[#010102] via-transparent to-transparent opacity-60 z-10" />
          
          {/* Window Header */}
          <div className="h-10 border-b border-[#23252a]/70 px-4 flex items-center gap-2 bg-[#0b0c0d]/60">
            <span className="w-3 h-3 rounded-full bg-red-500/20 group-hover:bg-red-500/60 transition-colors" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/20 group-hover:bg-yellow-500/60 transition-colors" />
            <span className="w-3 h-3 rounded-full bg-green-500/20 group-hover:bg-green-500/60 transition-colors" />
            <span className="text-[11px] text-[#8a8f98] font-mono ml-4">wikibot-app://workspace</span>
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
                  💬 Phân tích báo cáo tài chính Q1
                </div>
                <div className="p-2.5 rounded-md hover:bg-[#141516] transition-colors text-xs text-[#8a8f98]">
                  💬 Hướng dẫn lập chỉ mục vector
                </div>
                <div className="p-2.5 rounded-md hover:bg-[#141516] transition-colors text-xs text-[#8a8f98]">
                  💬 Quy định bảo mật dữ liệu
                </div>
              </div>
              <div className="mt-auto border-t border-[#23252a]/50 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#5e6ad2]/20 border border-[#5e6ad2]/30 flex items-center justify-center text-[10px] font-bold text-[#5e6ad2]">
                    F
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold">Gói Free</span>
                    <span className="text-[9px] text-[#8a8f98]">4/10 câu hỏi hôm nay</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chat Container Area */}
            <div className="flex-1 flex flex-col h-full relative">
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto mb-16 scrollbar-thin">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-[#141516] border border-[#23252a] flex items-center justify-center text-xs font-bold text-[#8a8f98]">U</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold mb-1 text-[#8a8f98]">Người dùng cá nhân</h4>
                    <p className="text-xs text-[#d0d6e0] leading-relaxed">Hãy tóm tắt chính sách nghỉ phép trong tài liệu nhân sự nội bộ.</p>
                  </div>
                </div>
                
                <div className="flex gap-3 border-t border-[#23252a]/20 pt-4">
                  <div className="w-8 h-8 rounded bg-[#5e6ad2]/15 border border-[#5e6ad2]/30 flex items-center justify-center text-xs"><AppLogo size="sm" /></div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold mb-1 text-[#5e6ad2] flex items-center gap-2">
                      WikiBot Assistant
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">98% tin cậy</span>
                    </h4>
                    <div className="text-xs text-[#d0d6e0] space-y-2 leading-relaxed">
                      <p>Dựa trên **Quy chế Nhân sự 2026** (trang 12), chính sách nghỉ phép của nhân viên được quy định như sau:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>**Nghỉ phép thường niên**: Nhân viên chính thức có 12 ngày phép hưởng nguyên lương mỗi năm.</li>
                        <li>**Thâm niên**: Cứ mỗi 5 năm làm việc, số ngày phép sẽ tăng thêm 1 ngày.</li>
                      </ul>
                      <div className="mt-3 p-2 bg-[#0b0c0d]/60 border border-[#23252a] rounded flex items-center gap-2 text-[10px]">
                        <span className="text-amber-500 font-bold">📄 Nguồn trích dẫn:</span>
                        <span className="text-[#8a8f98] underline">QD-NS-2026-v2.pdf (Trang 12)</span>
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
            <span className="text-[#5e6ad2] text-xs font-bold tracking-widest uppercase">Các Cột Mốc Tri Thức</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mt-2">Công nghệ đỉnh cao hỗ trợ doanh nghiệp</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-xl border border-[#23252a] bg-[#0f1011]/60 hover:bg-[#0f1011] transition-all hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-[#5e6ad2]/5">
              <div className="w-10 h-10 rounded bg-[#5e6ad2]/10 border border-[#5e6ad2]/30 flex items-center justify-center text-lg mb-6">🔍</div>
              <h3 className="text-lg font-bold text-white mb-2">Đường ống RAG thế hệ mới</h3>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Nâng cao câu hỏi tự động (Query Enhancer), chấm điểm độ tin cậy của câu trả lời, đảm bảo không xảy ra hiện tượng "ảo tưởng thông tin" của mô hình ngôn ngữ lớn.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-xl border border-[#23252a] bg-[#0f1011]/60 hover:bg-[#0f1011] transition-all hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-[#5e6ad2]/5">
              <div className="w-10 h-10 rounded bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-lg mb-6">📄</div>
              <h3 className="text-lg font-bold text-white mb-2">Số hóa tài liệu đa phương thức</h3>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Tích hợp OCR Paddle và Vision LLM bóc tách bảng biểu phức tạp và hình ảnh từ file PDF, Word sang Markdown chuẩn xác, giữ nguyên vẹn cấu trúc thông tin dạng lưới.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-xl border border-[#23252a] bg-[#0f1011]/60 hover:bg-[#0f1011] transition-all hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-[#5e6ad2]/5">
              <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg mb-6">🛡️</div>
              <h3 className="text-lg font-bold text-white mb-2">Bảo mật dữ liệu tuyệt đối</h3>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Phân quyền truy cập theo vai trò (RBAC) nghiêm ngặt. Hỗ trợ mô hình Hybrid mã hóa đầu-cuối hoặc chạy hoàn toàn Offline 100% trên máy chủ công ty (Local Ollama).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Detail Section */}
      <section id="architecture" className="py-24 px-6 max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <span className="text-[#5e6ad2] text-xs font-bold tracking-widest uppercase">Data Residency</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mt-2 mb-6 leading-tight">
              Phù hợp với mọi tiêu chuẩn an toàn thông tin
            </h2>
            <div className="space-y-6 text-[#8a8f98] text-sm leading-relaxed">
              <div className="flex gap-4">
                <span className="text-lg text-[#5e6ad2]">✔</span>
                <div>
                  <strong className="text-white block mb-1">Standard Cloud SaaS</strong>
                  Dữ liệu được phân tách logic nghiêm ngặt bằng khoá ngoại, suy luận nhanh chóng qua các Cloud LLM an toàn.
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-lg text-[#5e6ad2]">✔</span>
                <div>
                  <strong className="text-white block mb-1">Individual Private Mode</strong>
                  Đồng bộ hóa metadata nhẹ nhàng trên Cloud, toàn bộ tài liệu RAG và suy luận AI được xử lý cục bộ qua Ollama Local tại máy của bạn.
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-lg text-[#5e6ad2]">✔</span>
                <div>
                  <strong className="text-white block mb-1">Enterprise On-Premise (100% Offline)</strong>
                  Triển khai trọn gói Docker trong mạng nội bộ bảo mật của doanh nghiệp. Không yêu cầu bất kỳ kết nối internet nào ra ngoài.
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full p-8 rounded-xl border border-[#23252a] bg-[#0b0c0d]/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#5e6ad2]/5 blur-xl rounded-full" />
            <h3 className="text-lg font-bold text-white mb-4">Mô phỏng Luồng Dữ liệu</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs p-3 rounded bg-[#141516] border border-[#23252a]">
                <span>Tài liệu nội bộ (.pdf/.docx)</span>
                <span className="text-[#5e6ad2]">Tải lên ➜</span>
              </div>
              <div className="flex items-center justify-between text-xs p-3 rounded bg-[#141516] border border-[#23252a]">
                <span>Multimodal Parser (OCR & Markdown)</span>
                <span className="text-[#5e6ad2]">Xử lý cấu trúc ➜</span>
              </div>
              <div className="flex items-center justify-between text-xs p-3 rounded bg-[#141516] border border-[#23252a]">
                <span>Chroma Vector DB (Lập chỉ mục)</span>
                <span className="text-[#5e6ad2]">Embedding ➜</span>
              </div>
              <div className="flex items-center justify-between text-xs p-3 rounded bg-[#141516] border border-[#23252a]">
                <span>Local Ollama / Cloud LLM</span>
                <span className="text-emerald-500">RAG Response ✔</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto relative z-10 border-t border-[#23252a]/40">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">
          Sẵn sàng đưa AI vào công việc của bạn?
        </h2>
        <p className="text-base text-[#8a8f98] mb-10 max-w-xl mx-auto font-light">
          Trải nghiệm ngay khả năng trích xuất thông tin đỉnh cao của RAG kết hợp OCR của WikiBot. Đăng ký tài khoản miễn phí chỉ trong 10 giây.
        </p>
        <Link 
          href={user ? "/chat" : "/login"} 
          className="px-8 py-3.5 text-sm font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98] shadow-lg shadow-[#5e6ad2]/20 inline-flex items-center gap-2"
        >
          {user ? "Vào phòng chat ngay" : "Bắt đầu miễn phí ngay"} ⚡
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
            <Link href="/pricing" className="hover:text-white transition-colors">Bảng giá</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
