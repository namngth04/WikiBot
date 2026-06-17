'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/context/auth-context';
import { Lock, User, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLogo from '@/app/components/AppLogo';
import { isElectron } from '@/app/lib/platform';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.3,
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

const errorVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
};

interface LoginPageProps {
  onSwitchToRegister?: () => void;
}

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requireSelection, setRequireSelection] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tempToken, setTempToken] = useState('');
  const router = useRouter();
  const { login, selectTenant } = useAuth();

  const handleRedirect = (loggedInUser: any) => {
    const isSystemAdmin = loggedInUser.role?.level === 0 && (loggedInUser.tenant_id === null || loggedInUser.tenant_id === undefined);
    const isTenantAdmin = (loggedInUser.role?.level === 0 || loggedInUser.role?.level === 1) && loggedInUser.tenant_id !== null && loggedInUser.tenant_id !== undefined;

    if (isElectron()) {
      if (isSystemAdmin) {
        router.push('/superadmin');
      } else if (isTenantAdmin) {
        router.push('/admin/dashboard');
      } else {
        router.push('/chat');
      }
    } else {
      // Chạy trên Web Browser: Tất cả người dùng (kể cả Admin) đều không chuyển hướng đến Dashboard, giữ lại ở trang chủ '/'
      router.push('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (result && result.require_tenant_selection) {
        setTempToken(result.temp_token);
        setTenants(result.tenants);
        setRequireSelection(true);
        return;
      }
      
      if (result) {
        handleRedirect(result);
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTenant = async (tenantId: number | null) => {
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await selectTenant(tempToken, tenantId);
      handleRedirect(loggedInUser);
    } catch (err: any) {
      setError(err.message || 'Lựa chọn Workspace thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      {/* Floating background blobs */}
      <motion.div
        className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, 50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-20 left-1/3 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl"
        animate={{ x: [0, 20, 0], y: [0, -40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Glassmorphism card */}
      <motion.div
        className="relative z-10 w-full max-w-md mx-4"
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-2xl">
          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link href="/" className="inline-flex flex-col items-center group cursor-pointer">
              <AppLogo size="lg" className="mb-4 mx-auto group-hover:scale-105 transition-transform duration-300" />
              <motion.h1
                className="text-3xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors duration-300"
                animate={{ textShadow: ['0 0 0px rgba(59,130,246,0)', '0 0 20px rgba(59,130,246,0.4)', '0 0 0px rgba(59,130,246,0)'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                WikiBot
              </motion.h1>
            </Link>
            <p className="text-slate-300 mt-2 text-sm">Hệ thống Chatbot Nội Bộ</p>
          </motion.div>

          {/* Error message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                className="mb-5 p-3 bg-red-500/15 border border-red-400/30 rounded-xl flex items-center gap-2 text-red-300"
                variants={errorVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic forms / Selector */}
          <AnimatePresence mode="wait">
            {!requireSelection ? (
              <motion.form
                key="login-form"
                onSubmit={handleSubmit}
                className="space-y-5"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <motion.div variants={itemVariants}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tên đăng nhập hoặc Email
                  </label>
                  <motion.div
                    className="relative"
                    whileFocus={{ scale: 1.01 }}
                  >
                    <User className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all outline-none"
                      placeholder="Nhập tên đăng nhập hoặc email"
                      required
                    />
                  </motion.div>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Mật khẩu
                  </label>
                  <motion.div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all outline-none"
                      placeholder="Nhập mật khẩu"
                      required
                    />
                  </motion.div>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                    whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(59,130,246,0.35)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        Đang đăng nhập...
                      </span>
                    ) : (
                      'Đăng nhập'
                    )}
                  </motion.button>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center text-xs text-slate-400 mt-4">
                  Chưa có tài khoản?{' '}
                  {onSwitchToRegister ? (
                    <button
                      type="button"
                      onClick={onSwitchToRegister}
                      className="text-blue-400 hover:text-blue-300 font-semibold transition-colors underline underline-offset-4 bg-transparent border-none p-0 cursor-pointer"
                    >
                      Đăng ký ngay
                    </button>
                  ) : (
                    <Link href="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors underline underline-offset-4">
                      Đăng ký ngay
                    </Link>
                  )}
                </motion.div>
              </motion.form>
            ) : (
              <motion.div
                key="workspace-selector"
                className="space-y-5"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-4">
                  <h2 className="text-lg font-medium text-slate-200">Chọn Workspace làm việc</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Tài khoản của bạn được liên kết với nhiều Workspace. Vui lòng chọn một để tiếp tục:
                  </p>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {tenants.map((t, idx) => (
                    <motion.button
                      key={t.tenant_id ?? `personal-${idx}`}
                      onClick={() => handleSelectTenant(t.tenant_id)}
                      disabled={loading}
                      className="w-full text-left p-4 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/30 hover:border-blue-500/50 rounded-xl transition-all duration-300 flex flex-col group disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {t.company_name}
                      </span>
                      <span className="text-xs text-slate-400 mt-1.5 flex justify-between w-full">
                        <span>Tài khoản: <strong className="text-slate-300">{t.username}</strong></span>
                        {t.tenant_id ? (
                          <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[10px] font-medium border border-blue-500/30">Doanh nghiệp</span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-500/30">Cá nhân</span>
                        )}
                      </span>
                    </motion.button>
                  ))}
                </div>

                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      setRequireSelection(false);
                      setTenants([]);
                      setTempToken('');
                    }}
                    disabled={loading}
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300 py-2 border-b border-transparent hover:border-white/20"
                  >
                    Quay lại màn hình đăng nhập
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
