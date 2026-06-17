'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { api } from '@/app/lib/api';
import AppLogo from '@/app/components/AppLogo';
import { Check, X, Sparkles, Shield, AlertCircle, ArrowLeft, ArrowRight, Loader2, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isElectron } from '@/app/lib/platform';

interface QuotaData {
  subscription_tier: string;
  questions_limit: number;
  questions_used: number;
  documents_limit: number;
  documents_used: number;
  file_size_limit_mb: number;
  ollama_allowed: boolean;
}

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'success' | 'error'>('none');
  const [errorMessage, setErrorMessage] = useState('');
  const [billingType, setBillingType] = useState<'personal' | 'business'>('personal');
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
  const [runningInDesktop, setRunningInDesktop] = useState(false);

  useEffect(() => {
    setRunningInDesktop(isElectron());
  }, []);

  // Fetch current quota and subscription status
  const fetchQuota = async () => {
    if (!user) return;
    setQuotaLoading(true);
    try {
      const res = await api.get('/upgrade/quota');
      setQuota(res.data);
    } catch (err: any) {
      console.error('Error fetching quota:', err);
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchQuota();
    }
  }, [user]);

  // Handle upgrade request
  const handleUpgradeRequest = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    setRequestLoading(true);
    setErrorMessage('');
    
    try {
      const res = await api.post('/upgrade/request');
      setRequestStatus('success');
      // Đợi 2 giây rồi đóng modal và tải lại dữ liệu
      setTimeout(() => {
        setShowQRModal(false);
        setRequestStatus('none');
        fetchQuota();
      }, 2000);
    } catch (err: any) {
      setRequestStatus('error');
      setErrorMessage(err.response?.data?.detail || 'Đã có lỗi xảy ra khi gửi yêu cầu nâng cấp');
    } finally {
      setRequestLoading(false);
    }
  };

  // Generate VietQR Image URL
  const getVietQRUrl = () => {
    const bankId = 'MB'; // MB Bank
    const accountNo = '9999988888'; // WikiBot premium account
    const amount = billingType === 'business' ? 2499000 : 99000;
    const addInfo = billingType === 'business' ? `WIKIBOT CORP PRO ${user?.username || 'GUEST'}` : `WIKIBOT PRO ${user?.username || 'GUEST'}`;
    const accountName = 'CONG TY CONG NGHE WIKIBOT';
    
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName)}`;
  };

  const isPro = quota?.subscription_tier === 'pro';
  const isEnterprise = quota?.subscription_tier === 'enterprise';
  const isCompanyAdmin = user?.user_type === 'employee' && user?.role?.level === 1;
  const isNormalEmployee = user?.tenant_id && !isCompanyAdmin;

  return (
    <div className="min-h-screen bg-[#010102] text-[#f7f8f8] selection:bg-[#5e6ad2]/30 selection:text-white font-sans antialiased overflow-x-hidden relative">
      
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[30%] w-[40%] h-[50%] rounded-full bg-[#5e6ad2]/10 blur-[130px]" />
        <div className="absolute top-[-5%] right-[30%] w-[35%] h-[45%] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#23252a]/60 bg-[#010102]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {runningInDesktop ? (
              <div className="flex items-center gap-2.5">
                <AppLogo size="md" />
              </div>
            ) : (
              <Link href="/" className="flex items-center gap-2.5 group">
                <AppLogo size="md" />
              </Link>
            )}
            {!runningInDesktop && (
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/#features" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">Tính năng</Link>
                <Link href="/#architecture" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">Kiến trúc</Link>
                <Link href="/pricing" className="text-sm text-white font-medium">Bảng giá</Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {authLoading ? (
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
                        <p className="text-[10px] text-[#8a8f98] truncate mt-0.5">@{user.username} · {user.email || 'Chưa có email'}</p>
                        <div className="mt-2.5 px-2.5 py-1.5 bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 rounded-lg text-[10px] flex items-center justify-between">
                          <span className="text-[#8a8f98]">Gói hiện tại:</span>
                          <span className="text-[#a5b4fc] font-bold">
                            {user.user_type === 'superadmin' || user?.role?.level === 0
                              ? 'Super Admin ⚡'
                              : (user.user_type === 'employee' || user.tenant_id
                                ? (user.subscription_tier === 'pro' ? 'Doanh nghiệp PRO' : 'Doanh nghiệp FREE')
                                : (user.subscription_tier === 'pro' ? 'Cá nhân PRO' : 'Cá nhân FREE')
                              )
                            }
                          </span>
                        </div>
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
                {!runningInDesktop && (
                  <Link href="/login" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors font-medium">
                    Đăng nhập
                  </Link>
                )}
                <Link href="/login" className="px-4 py-1.5 text-xs font-semibold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-md transition-all active:scale-[0.98]">
                  Dùng thử miễn phí
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Pricing Sections */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
        
        {/* Header Title */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          {runningInDesktop ? (
            <button 
              onClick={() => router.push('/dashboard')} 
              className="inline-flex items-center gap-1.5 text-xs text-[#8a8f98] hover:text-white transition-colors mb-6 group"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" /> Quay lại Dashboard
            </button>
          ) : (
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#8a8f98] hover:text-white transition-colors mb-6 group">
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" /> Quay lại trang chủ
            </Link>
          )}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-tight">
            Chọn gói cước phù hợp cho hiệu suất của bạn
          </h1>
          <p className="text-[#8a8f98] text-base font-light mb-6">
            Giải pháp chatbot RAG bảo mật, chính xác và có khả năng mở rộng không giới hạn cho cá nhân và tổ chức.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-12">
          <div className="bg-[#0f1011] p-1.5 rounded-xl border border-[#23252a]/60 flex gap-1">
            <button
              onClick={() => setBillingType('personal')}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                billingType === 'personal'
                  ? 'bg-[#5e6ad2] text-white shadow-md'
                  : 'text-[#8a8f98] hover:text-white'
              }`}
            >
              Cá nhân
            </button>
            <button
              onClick={() => setBillingType('business')}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                billingType === 'business'
                  ? 'bg-[#5e6ad2] text-white shadow-md'
                  : 'text-[#8a8f98] hover:text-white'
              }`}
            >
              Doanh nghiệp
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-20 max-w-4xl mx-auto">
          
          {billingType === 'personal' ? (
            <>
              {/* PERSONAL FREE PLAN */}
              <div className="flex flex-col p-8 rounded-2xl border border-[#23252a] bg-[#0f1011]/40 backdrop-blur-sm relative overflow-hidden transition-all hover:border-[#23252a]/90">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-2">Cá nhân FREE</h3>
                  <p className="text-xs text-[#8a8f98] min-h-[32px]">Dành cho người dùng cá nhân trải nghiệm chatbot cơ bản.</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold text-white">0đ</span>
                    <span className="text-[#8a8f98] text-sm ml-2">/ vĩnh viễn</span>
                  </div>
                </div>
                
                <button
                  disabled={true}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#141516] text-[#8a8f98] border border-[#23252a] cursor-not-allowed mb-8"
                >
                  {quota?.subscription_tier === 'free' && !user?.tenant_id ? 'Gói hiện tại' : 'Đã vượt qua'}
                </button>

                <div className="space-y-4 flex-1">
                  <span className="text-xs font-bold text-[#8a8f98] block uppercase tracking-wider mb-2">TÍNH NĂNG BAO GỒM</span>
                  <ul className="space-y-3 text-xs">
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Giới hạn 10 câu hỏi/ngày</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Upload tối đa 3 tài liệu RAG</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Dung lượng tài liệu &lt; 2MB/file</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <X size={14} className="text-red-500/70 mt-0.5 shrink-0" />
                      <span className="text-[#8a8f98]">Không hỗ trợ Ollama Local (Offline)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* PERSONAL PRO PLAN */}
              <div className="flex flex-col p-8 rounded-2xl border-2 border-[#5e6ad2] bg-[#0f1011]/80 backdrop-blur-sm relative overflow-hidden shadow-xl shadow-[#5e6ad2]/5 transition-all hover:shadow-[#5e6ad2]/10">
                <div className="absolute top-3 right-3 bg-[#5e6ad2] text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-md">
                  <Sparkles size={10} /> PHỔ BIẾN
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-2">Cá nhân PRO</h3>
                  <p className="text-xs text-[#8a8f98] min-h-[32px]">Mở rộng giới hạn, tăng cường khả năng phân tích và bảo mật cá nhân.</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold text-white">99.000đ</span>
                  </div>
                </div>

                {!user ? (
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[#5e6ad2]/20 mb-8"
                  >
                    Đăng nhập để nâng cấp <ArrowRight size={12} />
                  </button>
                ) : isPro && !user?.tenant_id ? (
                  <button
                    disabled={true}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default mb-8"
                  >
                    ⚡ Gói hiện tại của bạn (PRO)
                  </button>
                ) : isNormalEmployee ? (
                  <button
                    disabled={true}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#141516] text-[#8a8f98] border border-[#23252a] cursor-not-allowed mb-8"
                    title="Chỉ có Quản trị doanh nghiệp mới có quyền nâng cấp gói cước"
                  >
                    Gói cước do quản trị doanh nghiệp quản lý
                  </button>
                ) : isCompanyAdmin ? (
                  <button
                    disabled={true}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#141516] text-[#8a8f98] border border-[#23252a] cursor-not-allowed mb-8"
                    title="Tài khoản Doanh nghiệp không thể nâng cấp gói cước Cá nhân"
                  >
                    Chỉ dành cho Cá nhân
                  </button>
                ) : (
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[#5e6ad2]/20 mb-8"
                  >
                    Nâng cấp Pro Ngay ⚡
                  </button>
                )}

                <div className="space-y-4 flex-1">
                  <span className="text-xs font-bold text-[#8a8f98] block uppercase tracking-wider mb-2">TẤT CẢ TÍNH NĂNG FREE, KÈM THEO:</span>
                  <ul className="space-y-3 text-xs">
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium">Không giới hạn số câu hỏi/ngày</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium">Tối đa 100 tài liệu RAG</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium">Hỗ trợ file dung lượng lên tới 100MB</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium text-emerald-400">Mở khóa Ollama Local (Bảo mật 100%)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Trích dẫn nguồn trực quan đến từng trang</span>
                    </li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* BUSINESS FREE PLAN */}
              <div className="flex flex-col p-8 rounded-2xl border border-[#23252a] bg-[#0f1011]/40 backdrop-blur-sm relative overflow-hidden transition-all hover:border-[#23252a]/90">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-2">Doanh nghiệp FREE</h3>
                  <p className="text-xs text-[#8a8f98] min-h-[32px]">Giải pháp dùng thử giới hạn cho đội nhóm và doanh nghiệp nhỏ.</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold text-white">0đ</span>
                    <span className="text-[#8a8f98] text-sm ml-2">/ vĩnh viễn</span>
                  </div>
                </div>

                <button
                  disabled={true}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#141516] text-[#8a8f98] border border-[#23252a] cursor-not-allowed mb-8"
                >
                  {quota?.subscription_tier === 'free' && user?.tenant_id ? 'Gói hiện tại' : 'Đã vượt qua'}
                </button>

                <div className="space-y-4 flex-1">
                  <span className="text-xs font-bold text-[#8a8f98] block uppercase tracking-wider mb-2">TÍNH NĂNG BAO GỒM</span>
                  <ul className="space-y-3 text-xs">
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Tối đa 5 nhân sự (bao gồm Admin)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Tối đa 3 tài liệu RAG chung</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Giới hạn 10 câu hỏi/ngày chung toàn công ty</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Dung lượng tài liệu &lt; 2MB/file</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* BUSINESS PRO PLAN */}
              <div className="flex flex-col p-8 rounded-2xl border-2 border-[#5e6ad2] bg-[#0f1011]/80 backdrop-blur-sm relative overflow-hidden shadow-xl shadow-[#5e6ad2]/5 transition-all hover:shadow-[#5e6ad2]/10">
                <div className="absolute top-3 right-3 bg-[#5e6ad2] text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-md">
                  <Sparkles size={10} /> PHỔ BIẾN
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-2">Doanh nghiệp PRO</h3>
                  <p className="text-xs text-[#8a8f98] min-h-[32px]">Đầy đủ sức mạnh RAG, quản trị nhân sự và không giới hạn tài nguyên.</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-extrabold text-white">2.499.000đ</span>
                  </div>
                </div>

                {!user ? (
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[#5e6ad2]/20 mb-8"
                  >
                    Đăng nhập để nâng cấp <ArrowRight size={12} />
                  </button>
                ) : isPro && user?.tenant_id ? (
                  <button
                    disabled={true}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default mb-8"
                  >
                    ⚡ Gói hiện tại (DOANH NGHIỆP PRO)
                  </button>
                ) : isNormalEmployee ? (
                  <button
                    disabled={true}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#141516] text-[#8a8f98] border border-[#23252a] cursor-not-allowed mb-8"
                    title="Chỉ có Quản trị doanh nghiệp mới có quyền nâng cấp gói cước"
                  >
                    Gói cước do quản trị doanh nghiệp quản lý
                  </button>
                ) : (user?.user_type === 'personal' || !user?.tenant_id) ? (
                  <button
                    disabled={true}
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#141516] text-[#8a8f98] border border-[#23252a] cursor-not-allowed mb-8"
                    title="Gói cước này chỉ áp dụng cho tài khoản Doanh nghiệp"
                  >
                    Chỉ dành cho Doanh nghiệp
                  </button>
                ) : (
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[#5e6ad2]/20 mb-8"
                  >
                    Nâng cấp Doanh nghiệp PRO ⚡
                  </button>
                )}

                <div className="space-y-4 flex-1">
                  <span className="text-xs font-bold text-[#8a8f98] block uppercase tracking-wider mb-2">TẤT CẢ TÍNH NĂNG DOANH NGHIỆP FREE, KÈM:</span>
                  <ul className="space-y-3 text-xs">
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium">Không giới hạn số lượng nhân sự</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium">Không giới hạn số lượng tài liệu chung</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium">Không giới hạn số lượt hỏi đáp/ngày</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8] font-medium text-emerald-400">Mở khóa Ollama Local (Mạng LAN nội bộ)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={14} className="text-[#5e6ad2] mt-0.5 shrink-0" />
                      <span className="text-[#f7f8f8]">Phân quyền RBAC sâu sắc cho tài liệu nội bộ</span>
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Download Banner for Pricing page */}
        {!runningInDesktop && (
          <div className="max-w-4xl mx-auto mb-16 p-8 rounded-2xl border border-[#23252a] bg-[#0f1011]/80 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-[#5e6ad2]/5">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#5e6ad2]/5 blur-3xl rounded-full pointer-events-none" />
            <div className="text-left">
              <h3 className="text-lg font-bold text-white mb-2">Bạn chưa cài đặt ứng dụng Desktop?</h3>
              <p className="text-xs text-[#8a8f98] max-w-xl leading-relaxed">
                Hãy tải ngay WikiBot Desktop để kích hoạt toàn vẹn các tính năng trò chuyện, số hóa dữ liệu RAG và đồng bộ hóa Ollama offline.
              </p>
            </div>
            <Link
              href="/#download"
              className="px-6 py-3 bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-md shadow-[#5e6ad2]/20 flex items-center gap-1.5 shrink-0"
            >
              📥 Tải Ứng Dụng Desktop
            </Link>
          </div>
        )}

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto border-t border-[#23252a]/60 pt-16">
          <h2 className="text-2xl font-bold text-center text-white mb-10">Những câu hỏi thường gặp</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            <div className="p-5 rounded-xl bg-[#0f1011]/30 border border-[#23252a]/50">
              <h4 className="font-bold text-white mb-2">⚡ Hạn ngạch Free được cập nhật vào lúc nào?</h4>
              <p className="text-[#8a8f98] leading-relaxed">
                Hạn ngạch 10 câu hỏi mỗi ngày của gói Free sẽ được reset tự động vào lúc 00:00 (UTC) hàng ngày.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-[#0f1011]/30 border border-[#23252a]/50">
              <h4 className="font-bold text-white mb-2">🛡️ Cơ chế bảo mật của Ollama Local hoạt động ra sao?</h4>
              <p className="text-[#8a8f98] leading-relaxed">
                Khi kích hoạt Pro, bạn có thể thiết lập Ollama kết nối đến mô hình LLM chạy ngay trên máy tính của bạn. Mọi tài liệu và câu hỏi RAG sẽ được suy luận offline cục bộ, hoàn toàn không đẩy lên cloud bên ngoài.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-[#0f1011]/30 border border-[#23252a]/50">
              <h4 className="font-bold text-white mb-2">💰 Tôi có thể thanh toán qua phương thức nào?</h4>
              <p className="text-[#8a8f98] leading-relaxed">
                Trong hệ thống thử nghiệm Demo, chúng tôi sử dụng mã VietQR MB Bank. Bạn chỉ cần quét mã QR, bấm nút giả lập thanh toán, Superadmin sẽ duyệt nâng cấp PRO cho tài khoản của bạn ngay lập tức.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-[#0f1011]/30 border border-[#23252a]/50">
              <h4 className="font-bold text-white mb-2">🏢 Gói Enterprise hỗ trợ tối đa bao nhiêu user?</h4>
              <p className="text-[#8a8f98] leading-relaxed">
                Không giới hạn! Gói Enterprise sẽ được tùy biến tài nguyên dựa theo năng lực máy chủ nội bộ hoặc hạ tầng Kubernetes của doanh nghiệp bạn.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      {!runningInDesktop && (
        <footer className="border-t border-[#23252a]/40 py-10 px-6 relative z-10 text-xs text-[#8a8f98] bg-[#010102]">
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
      )}

      {/* VietQR Demo Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-[#010102]/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!requestLoading && requestStatus !== 'success') {
                  setShowQRModal(false);
                }
              }}
            />

            {/* Modal Body */}
            <motion.div
              className="relative z-10 w-full max-w-md bg-[#0f1011] border border-[#23252a] rounded-2xl shadow-2xl overflow-hidden p-6 text-left"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#23252a]/60 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-[#5e6ad2]" size={18} />
                  <span className="font-bold text-white text-sm">Nâng cấp tài khoản PRO</span>
                </div>
                <button
                  onClick={() => setShowQRModal(false)}
                  disabled={requestLoading || requestStatus === 'success'}
                  className="p-1 rounded-md text-[#8a8f98] hover:text-white hover:bg-[#141516] transition-all disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              {requestStatus === 'success' ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-xl mb-4 animate-bounce">
                    ✓
                  </div>
                  <h4 className="font-bold text-white text-base mb-2">Gửi yêu cầu thành công!</h4>
                  <p className="text-xs text-[#8a8f98] max-w-xs leading-relaxed">
                    Yêu cầu nâng cấp PRO đã được chuyển tới Superadmin. Tài khoản của bạn sẽ tự động kích hoạt ngay khi được phê duyệt.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bank info details */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#141516] border border-[#23252a] rounded-xl text-xs text-left">
                    <div>
                      <span className="text-[#8a8f98] block">Ngân hàng</span>
                      <strong className="text-white">MB Bank (Quân Đội)</strong>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block">Chủ tài khoản</span>
                      <strong className="text-white">CONG TY WIKIBOT</strong>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block">Số tài khoản</span>
                      <strong className="text-white font-mono">9999988888</strong>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block">Số tiền</span>
                      <strong className="text-emerald-400">99.000đ</strong>
                    </div>
                    <div className="col-span-2 border-t border-[#23252a]/60 pt-2 mt-1">
                      <span className="text-[#8a8f98] block">Nội dung chuyển khoản</span>
                      <strong className="text-[#5e6ad2] font-mono break-all text-xs">
                        WIKIBOT PRO {user?.username}
                      </strong>
                    </div>
                  </div>

                  {/* QR Image Area */}
                  <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-[#23252a] relative overflow-hidden group shadow-inner">
                    <img
                      src={getVietQRUrl()}
                      alt="VietQR Demo Code"
                      className="w-48 h-48 object-contain"
                    />
                    <div className="absolute inset-0 bg-[#0f1011]/90 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-center p-4 transition-all duration-200 pointer-events-none">
                      <Shield size={24} className="text-[#5e6ad2] mb-2" />
                      <span className="text-xs font-bold text-white">VietQR Demo Tĩnh</span>
                      <span className="text-[10px] text-[#8a8f98] max-w-[200px] mt-1 leading-relaxed">
                        Chuyển tiền thực tế 99.000 VNĐ để được duyệt hoặc bấm nút giả lập phía dưới để trải nghiệm ngay.
                      </span>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Simulate upgrade buttons */}
                  <div className="border-t border-[#23252a]/60 pt-4 flex gap-3">
                    <button
                      onClick={() => setShowQRModal(false)}
                      disabled={requestLoading}
                      className="flex-1 py-2 text-xs font-semibold border border-[#23252a] hover:bg-[#141516] text-[#8a8f98] hover:text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleUpgradeRequest}
                      disabled={requestLoading}
                      className="flex-1 py-2 text-xs font-bold bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#5e6ad2]/20 disabled:opacity-50"
                    >
                      {requestLoading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          Giả lập thanh toán ⚡
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
