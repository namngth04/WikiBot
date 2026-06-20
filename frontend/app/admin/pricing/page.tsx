'use client';

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Check, Sparkles, X, Users, FileText, Send, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/app/lib/api';

export default function AdminPricingPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Corporate quota and tier from real API
  const [corpQuota, setCorpQuota] = useState<{
    tier: string;
    employees_used: number;
    employees_limit: number | string;
    documents_used: number;
    documents_limit: number;
    questions_today: number;
    questions_limit: number;
  }>({
    tier: 'free',
    employees_used: 0,
    employees_limit: 5,
    documents_used: 0,
    documents_limit: 3,
    questions_today: 0,
    questions_limit: 10,
  });

  const fetchQuota = async () => {
    try {
      const res = await api.get('/upgrade/quota');
      const data = res.data;
      setCorpQuota({
        tier: data.subscription_tier,
        employees_used: data.staff_used || 0,
        employees_limit: data.staff_limit !== null && data.staff_limit !== undefined ? data.staff_limit : 'Không giới hạn',
        documents_used: data.documents_used,
        documents_limit: data.documents_limit,
        questions_today: data.questions_used,
        questions_limit: data.questions_limit,
      });
    } catch (err) {
      console.error('Failed to fetch corporate quota:', err);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  const handleUpgradeRequest = async () => {
    setLoading(true);
    try {
      await api.post('/upgrade/request');
      setSuccess('Đã nâng cấp gói cước doanh nghiệp lên PRO thành công!');
      fetchQuota();
      setShowQRModal(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Gửi yêu cầu nâng cấp thất bại. Vui lòng thử lại.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getTierName = (tier: string) => {
    if (tier === 'pro') return '⚡ Doanh nghiệp PRO';
    if (tier === 'enterprise') return '🛡️ Enterprise Dedicated';
    return '💼 Doanh nghiệp FREE';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast Messages */}
      {(success || error) && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500 border border-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 size={16} />
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-500 border border-rose-600 text-white px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface-1 border border-hairline p-6 rounded-[2rem] shadow-sm">
        <h3 className="text-xl font-be-vietnam font-bold text-ink flex items-center gap-2">
          <CreditCard className="text-brand-lavender w-6 h-6" />
          Quản lý Gói cước doanh nghiệp
        </h3>
        <p className="text-xs text-ink-subtle mt-1">
          Theo dõi hạn ngạch sử dụng tài nguyên của công ty và điều chỉnh gói dịch vụ phù hợp với quy mô nhân sự.
        </p>
      </div>

      {/* Current Quota Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Employees Quota */}
        <div className="bg-surface-1 border border-hairline rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Hạn ngạch nhân viên</span>
            <Users className="text-brand-lavender" size={20} />
          </div>
          <div>
            <div className="flex items-baseline mb-2">
              <span className="text-3xl font-extrabold text-ink">{corpQuota.employees_used}</span>
              <span className="text-ink-subtle text-sm ml-1">
                / {typeof corpQuota.employees_limit === 'number' ? `${corpQuota.employees_limit} nhân viên` : corpQuota.employees_limit}
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-lavender rounded-full transition-all duration-500" 
                style={{ 
                  width: typeof corpQuota.employees_limit === 'number' 
                    ? `${(corpQuota.employees_used / corpQuota.employees_limit) * 100}%` 
                    : '100%' 
                }}
              />
            </div>
          </div>
        </div>

        {/* Documents Quota */}
        <div className="bg-surface-1 border border-hairline rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Tài liệu tri thức (RAG)</span>
            <FileText className="text-cyan-500" size={20} />
          </div>
          <div>
            <div className="flex items-baseline mb-2">
              <span className="text-3xl font-extrabold text-ink">{corpQuota.documents_used}</span>
              <span className="text-ink-subtle text-sm ml-1">/ {corpQuota.documents_limit} tài liệu</span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                style={{ width: `${corpQuota.documents_limit > 0 ? (corpQuota.documents_used / corpQuota.documents_limit) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Daily API Questions Quota */}
        <div className="bg-surface-1 border border-hairline rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Lượt hỏi trong ngày</span>
            <Send className="text-purple-500" size={20} />
          </div>
          <div>
            <div className="flex items-baseline mb-2">
              <span className="text-3xl font-extrabold text-ink">{corpQuota.questions_today}</span>
              <span className="text-ink-subtle text-sm ml-1">/ {corpQuota.questions_limit} lượt</span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                style={{ width: `${corpQuota.questions_limit > 0 ? (corpQuota.questions_today / corpQuota.questions_limit) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Tier Info & Plans */}
      <div className="bg-surface-1 border border-hairline rounded-[2rem] p-8 space-y-6">
        <div>
          <h4 className="text-lg font-be-vietnam font-bold text-ink">Gói dịch vụ đang kích hoạt</h4>
          <span className="inline-block mt-2 px-4 py-1.5 bg-brand-lavender/10 text-brand-lavender text-xs font-extrabold rounded-full uppercase tracking-wider border border-brand-lavender/25">
            {getTierName(corpQuota.tier)}
          </span>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-w-4xl mx-auto">
          {/* DOANH NGHIEP FREE */}
          <div className={`flex flex-col p-6 rounded-2xl border bg-surface-2/10 relative overflow-hidden transition-all ${
            corpQuota.tier === 'free' ? 'border-brand-lavender bg-brand-lavender/[0.01]' : 'border-hairline'
          }`}>
            <div className="mb-6">
              <h4 className="text-base font-bold text-ink mb-1">Doanh nghiệp FREE</h4>
              <p className="text-[11px] text-ink-subtle min-h-[32px]">Dành cho doanh nghiệp trải nghiệm các tính năng tra cứu cơ bản.</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-2xl font-extrabold text-ink">0đ</span>
                <span className="text-ink-subtle text-xs ml-1">/ vĩnh viễn</span>
              </div>
            </div>

            {corpQuota.tier === 'free' ? (
              <span className="w-full py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-6 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle2 size={13} /> Gói hiện tại
              </span>
            ) : (
              <span className="w-full py-2 bg-surface-3 text-ink-subtle border border-hairline mb-6 rounded-xl text-xs font-bold text-center">
                Free Tier
              </span>
            )}

            <div className="space-y-3 flex-1">
              <span className="text-[10px] font-black text-ink-subtle block uppercase tracking-wider mb-1">TÍNH NĂNG GÓI</span>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                  <span className="text-ink-muted">Tối đa 5 tài khoản nhân viên</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                  <span className="text-ink-muted">Tối đa 3 tài liệu RAG chung</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                  <span className="text-ink-muted">10 lượt hỏi đáp/ngày (Doanh nghiệp)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* DOANH NGHIEP PRO */}
          <div className={`flex flex-col p-6 rounded-2xl border relative overflow-hidden transition-all ${
            corpQuota.tier === 'pro' ? 'border-brand-lavender bg-brand-lavender/[0.01]' : 'border-hairline shadow-md shadow-brand-lavender/5'
          }`}>
            <div className="absolute top-2.5 right-2.5 bg-brand-lavender text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Sparkles size={8} /> PHỔ BIẾN
            </div>

            <div className="mb-6">
              <h4 className="text-base font-bold text-ink mb-1">Doanh nghiệp PRO</h4>
              <p className="text-[11px] text-ink-subtle min-h-[32px]">Hỗ trợ mở rộng nhân sự, không giới hạn RAG và câu hỏi chat.</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-2xl font-extrabold text-ink">2.499.000đ</span>
              </div>
            </div>

            {corpQuota.tier === 'pro' ? (
              <span className="w-full py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-6 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle2 size={13} /> Gói hiện tại
              </span>
            ) : (
              <button
                onClick={() => setShowQRModal(true)}
                className="w-full py-2 bg-brand-lavender hover:bg-brand-lavender-hover text-white mb-6 rounded-xl text-xs font-bold transition-all active:scale-[0.97] shadow-sm flex items-center justify-center gap-1"
              >
                Nâng cấp Doanh nghiệp PRO ⚡
              </button>
            )}

            <div className="space-y-3 flex-1">
              <span className="text-[10px] font-black text-ink-subtle block uppercase tracking-wider mb-1">TÍNH NĂNG GÓI</span>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                  <span className="text-ink-muted">Không giới hạn nhân sự</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                  <span className="text-ink-muted">Không giới hạn tài liệu RAG</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-brand-lavender mt-0.5 shrink-0" />
                  <span className="text-ink-muted">Không giới hạn lượt hỏi đáp/ngày</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* VietQR Upgrading Payment Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-slate-900 text-white rounded-3xl p-6 border border-white/10 shadow-2xl max-w-md w-full relative overflow-hidden backdrop-blur-xl text-center"
            >
              <button
                onClick={() => setShowQRModal(false)}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                <X size={16} />
              </button>

              <div className="mb-4">
                <h4 className="text-base font-bold text-white">Nâng cấp Doanh nghiệp PRO</h4>
                <p className="text-xs text-slate-400 mt-1">Quét mã VietQR để kích hoạt ngay</p>
              </div>

              {/* VietQR Mock Image */}
              <div className="bg-white p-4 rounded-2xl inline-block mb-4 shadow-inner">
                <img 
                  src="https://api.vietqr.co/image/970422-108871032338-GjLh9vW.jpg?accountName=WIKIBOT%20ENTERPRISE&amount=2499000&addInfo=NANG%20CAP%20DOANH%20NGHIEP%20PRO" 
                  alt="VietQR Payment Code" 
                  className="w-48 h-48 mx-auto object-contain"
                />
              </div>

              <div className="space-y-1 mb-6 text-sm text-slate-300">
                <p>Số tài khoản: <span className="font-mono font-bold text-white">108871032338</span></p>
                <p>Ngân hàng: <span className="font-bold text-white">MB Bank</span></p>
                <p>Số tiền: <span className="font-bold text-brand-lavender text-base">2.499.000đ</span></p>
                <p className="text-xs text-slate-400 italic mt-2">Hệ thống sẽ tự động kích hoạt sau khi giao dịch thành công.</p>
              </div>

              <button
                onClick={handleUpgradeRequest}
                disabled={loading}
                className="w-full py-3 bg-brand-lavender hover:bg-brand-lavender-hover text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Đang kiểm tra giao dịch...
                  </>
                ) : (
                  <>
                    Kích hoạt thủ công (Giả làm thanh toán)
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
