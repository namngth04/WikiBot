'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/context/auth-context';
import { API_BASE_URL } from '@/app/lib/api';
import { Lock, User, AlertCircle, Mail, Phone, UserCheck, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLogo from '@/app/components/AppLogo';
import { isElectron } from '@/app/lib/platform';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

const errorVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
};

interface RegisterPageProps {
  onSwitchToLogin?: () => void;
}

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regType, setRegType] = useState<'personal' | 'company'>('personal');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (password.length < 6) {
      setError('Mật khẩu phải chứa ít nhất 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);

    try {
      // 1. Call public registration API (expanded for SaaS self-service)
      const registerRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          full_name: fullName || username,
          email: email || null,
          phone: phone || null,
          subscription_tier: 'free',
          tenant_id: null,
          company_name: regType === 'company' ? companyName : null,
        }),
      });

      if (!registerRes.ok) {
        const errData = await registerRes.json();
        throw new Error(errData.detail || 'Đăng ký thất bại');
      }

      const userData = await registerRes.json();

      // 2. Auto-login on success
      await login(username, password);
      
      // Redirect to correct dashboard
      if (regType === 'company' || (userData.role_id === 2)) {
        router.push('/admin/dashboard'); // Company Admin goes to admin panel
      } else {
        if (isElectron()) {
          router.push('/chat'); // Personal user/staff goes to chat room
        } else {
          router.push('/dashboard'); // Web user goes to dashboard
        }
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra trong quá trình đăng ký');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] relative overflow-hidden py-12 px-4 select-none">
      {/* Floating background blobs (matching login aesthetics exactly) */}
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
      <motion.div
        className="absolute -bottom-20 left-1/3 w-[350px] h-[350px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"
        animate={{ x: [0, 20, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Premium Glassmorphic Card */}
      <motion.div
        className="relative z-10 w-full max-w-lg"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="backdrop-blur-2xl bg-slate-900/75 border border-slate-800/80 p-8 md:p-10 rounded-3xl shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none" />
          
          {/* Header */}
          <div className="text-center mb-6">
            <Link href="/" className="inline-flex flex-col items-center group cursor-pointer">
              <AppLogo size="lg" className="mb-4 mx-auto group-hover:scale-105 transition-transform duration-300" />
              <h1 className="text-3xl font-bold text-white tracking-tight bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 group-hover:text-blue-400 transition-colors duration-300">
                Đăng ký WikiBot
              </h1>
            </Link>
            <p className="text-slate-400 mt-2 text-sm font-light">Tạo tài khoản dùng thử miễn phí trong 10 giây</p>
          </div>

          {/* SaaS Tab Selector */}
          <div className="flex bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setRegType('personal')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                regType === 'personal'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cá Nhân
            </button>
            <button
              type="button"
              onClick={() => setRegType('company')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                regType === 'company'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Đăng Ký Doanh Nghiệp
            </button>
          </div>


          {/* Error display */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-red-300"
                variants={errorVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-xs font-medium leading-relaxed">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Registration Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Full Name */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Họ và Tên
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                  placeholder="Nhập họ và tên"
                />
              </div>
            </motion.div>

            {/* Dynamic B2B Company fields */}
            <AnimatePresence mode="wait">
              {regType === 'company' && (
                <motion.div
                  key="company-name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Tên Doanh nghiệp / Tổ chức <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-3 text-slate-500" size={18} />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                      placeholder="Nhập tên doanh nghiệp/tổ chức"
                      required={regType === 'company'}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>


            {/* Username */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Tên đăng nhập <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                  placeholder="Nhập tên đăng tài khoản (tối thiểu 3 ký tự)"
                  required
                  minLength={3}
                />
              </div>
            </motion.div>

            {/* Email & Phone side-by-side on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </motion.div>

              {/* Phone */}
              <motion.div variants={itemVariants}>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-500" size={18} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                    placeholder="0987xxxxxx"
                  />
                </div>
              </motion.div>
            </div>

            {/* Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  required
                  minLength={6}
                />
              </div>
            </motion.div>

            {/* Confirm Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Xác nhận mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0b0f19]/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all outline-none text-sm"
                  placeholder="Xác nhận mật khẩu"
                  required
                />
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={itemVariants} className="pt-2">
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden text-sm"
                whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Đang đăng ký tài khoản...
                  </span>
                ) : (
                  'Đăng Ký & Trải Nghiệm Ngay ⚡'
                )}
              </motion.button>
            </motion.div>
          </motion.form>

          {/* Footer / Switch back to login */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
            Đã có tài khoản?{' '}
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors underline underline-offset-4 bg-transparent border-none p-0 cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            ) : (
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors underline underline-offset-4">
                Đăng nhập ngay
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
