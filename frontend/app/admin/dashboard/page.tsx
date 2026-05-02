'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { adminAPI } from '@/app/lib/api';
import { DashboardStats, UsageStats } from '@/app/lib/types';
import { 
  Users, MessageSquare, FileText, Star, TrendingUp, ThumbsUp, AlertCircle,
  ArrowUpRight, ArrowDownRight, Activity, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

// Import các component biểu đồ động để tránh lỗi SSR
const UsageTrendChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.UsageTrendChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
});

const FeedbackPieChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.FeedbackPieChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
});

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const fetchData = async () => {
      try {
        const [statsRes, usageRes] = await Promise.all([
          adminAPI.getOverview(),
          adminAPI.getUsage(30)
        ]);
        
        setStats(statsRes.data);
        const usageData = Array.isArray(usageRes.data) ? usageRes.data : [];
        const normalized = usageData.map((item: Partial<UsageStats>) => ({
          date: String(item?.date ?? ''),
          count: Number(item?.count ?? 0),
        }));
        setUsage(normalized);
      } catch (error) {
        console.error('Lỗi khi fetch dữ liệu Dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (!isMounted || loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        ))}
        <div className="lg:col-span-3 h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        <div className="h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  const feedbackData = stats ? [
    { name: 'Hài lòng', value: stats.feedback_ratio.like },
    { name: 'Không hài lòng', value: stats.feedback_ratio.dislike },
    { name: 'Chưa đánh giá', value: stats.feedback_ratio.none },
  ] : [];

  const hasFeedback = feedbackData.some(d => d.value > 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Người dùng', value: stats?.total_users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12%' },
          { label: 'Tổng tin nhắn', value: stats?.total_messages, icon: MessageSquare, color: 'text-violet-600', bg: 'bg-violet-50', trend: '+5.4%' },
          { label: 'Tài liệu', value: stats?.total_documents, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Ổn định' },
          { label: 'Đánh giá TB', value: `${stats?.avg_rating}/1`, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50', trend: '-2.1%' },
        ].map((item, idx) => (
          <motion.div 
            key={idx}
            variants={itemVariants}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-soft hover:shadow-soft-xl transition-all group cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-2xl transition-colors", item.bg, item.color)}>
                <item.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                item.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : 
                item.trend.startsWith('-') ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"
              )}>
                {item.trend.startsWith('+') && <ArrowUpRight size={12} />}
                {item.trend.startsWith('-') && <ArrowDownRight size={12} />}
                {item.trend}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <h3 className="text-3xl font-be-vietnam font-bold text-slate-900 mt-1">{item.value || 0}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Trend - Bento Large */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-soft relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="font-be-vietnam font-bold text-slate-900 text-lg">Hoạt động hệ thống</h3>
                <p className="text-xs text-slate-400 font-medium">Tần suất tra cứu trong 30 ngày gần nhất</p>
              </div>
            </div>
            <select className="bg-slate-50 border-none text-xs font-bold text-slate-500 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500/10 outline-none">
              <option>30 ngày qua</option>
              <option>7 ngày qua</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            {usage.length > 0 ? (
              <UsageTrendChart data={usage} />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-300">
                <AlertCircle size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
                <p className="font-medium">Chưa có dữ liệu thống kê</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Feedback Distribution - Bento Small */}
        <motion.div 
          variants={itemVariants}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-soft flex flex-col"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ThumbsUp size={20} />
            </div>
            <div>
              <h3 className="font-be-vietnam font-bold text-slate-900 text-lg">Phản hồi</h3>
              <p className="text-xs text-slate-400 font-medium">Mức độ hài lòng của nhân viên</p>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            {hasFeedback ? (
              <FeedbackPieChart 
                data={feedbackData} 
                colors={['#10b981', '#f43f5e', '#cbd5e1']} 
              />
            ) : (
              <div className="flex flex-col items-center text-slate-300">
                <ThumbsUp size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
                <p className="font-medium">Chưa có đánh giá</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-50 grid grid-cols-3 gap-2">
            {feedbackData.map((d, i) => (
              <div key={i} className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{d.name}</p>
                <p className="text-sm font-be-vietnam font-bold text-slate-900">{d.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity / Insights Section */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="md:col-span-2 bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-xl font-be-vietnam font-bold mb-2">Tối ưu hóa dữ liệu FAQ</h3>
            <p className="text-slate-400 text-sm max-w-md mb-6">Hệ thống phát hiện 12 câu hỏi mới thường xuyên xuất hiện nhưng chưa có trong danh mục FAQ chuẩn.</p>
            <button 
              onClick={() => router.push('/admin/faqs')}
              className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-primary-500 hover:text-white transition-all active:scale-95"
            >
              Xem gợi ý ngay
            </button>
          </div>
          <Sparkles className="absolute -right-8 -bottom-8 text-white/5 w-64 h-64 group-hover:text-primary-500/10 transition-colors duration-700" />
        </div>
        
        <div className="bg-primary-600 rounded-[2rem] p-8 text-white">
          <h3 className="text-xl font-be-vietnam font-bold mb-4">Trạng thái RAG</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/70">Vector DB</span>
              <span className="font-bold">Hoạt động</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-[98%] shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/70">LLM Response Time</span>
              <span className="font-bold">1.2s</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-[85%] shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
