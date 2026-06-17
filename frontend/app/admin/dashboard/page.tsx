'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { adminAPI, API_BASE_URL } from '@/app/lib/api';
import { DashboardStats, UsageStats } from '@/app/lib/types';
import { 
  Users, MessageSquare, FileText, Star, ThumbsUp, AlertCircle,
  ArrowUpRight, ArrowDownRight, Activity, Sparkles, Loader2, RefreshCw
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';

// Import các component biểu đồ động để tránh lỗi SSR
const UsageTrendChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.UsageTrendChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2 animate-pulse rounded-2xl" />
});

const FeedbackPieChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.FeedbackPieChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2 animate-pulse rounded-2xl" />
});

const TopicBarChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.TopicBarChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2 animate-pulse rounded-2xl" />
});

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [refreshingTopics, setRefreshingTopics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const handleRefreshTopics = async () => {
    setRefreshingTopics(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics/topics?refresh=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const topicsData = await res.json();
        setTopics(topicsData);
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật lại chủ đề:', error);
    } finally {
      setRefreshingTopics(false);
    }
  };

  const [timeFilter, setTimeFilter] = useState('30');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const fetchUsageData = async () => {
    setLoadingUsage(true);
    try {
      const params: any = {};
      if (timeFilter === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      } else {
        params.days = parseInt(timeFilter);
      }
      const usageRes = await adminAPI.getUsage(params);
      const usageData = Array.isArray(usageRes.data) ? usageRes.data : [];
      const normalized = usageData.map((item: Partial<UsageStats>) => ({
        date: String(item?.date ?? ''),
        count: Number(item?.count ?? 0),
      }));
      setUsage(normalized);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu sử dụng:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [statsRes, topicsRes] = await Promise.all([
          adminAPI.getOverview(),
          fetch(`${API_BASE_URL}/api/admin/analytics/topics`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        setStats(statsRes.data);

        if (topicsRes.ok) {
          const topicsData = await topicsRes.json();
          setTopics(topicsData);
        }
      } catch (error) {
        console.error('Lỗi khi fetch dữ liệu Dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchUsageData();
    }
  }, [isMounted, timeFilter, startDate, endDate]);

  if (!isMounted || loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 bg-surface-1 border border-hairline rounded-3xl skeleton" />
        ))}
        <div className="lg:col-span-2 h-[450px] bg-surface-1 border border-hairline rounded-[2rem] skeleton" />
        <div className="h-[450px] bg-surface-1 border border-hairline rounded-[2rem] skeleton" />
      </div>
    );
  }

  const feedbackData = stats ? [
    { name: 'Hài lòng', value: stats.feedback_ratio.like },
    { name: 'Không hài lòng', value: stats.feedback_ratio.dislike },
    { name: 'Chưa đánh giá', value: stats.feedback_ratio.none },
  ] : [];

  const hasFeedback = feedbackData.some(d => d.value > 0);

  // Helper function để format trend
  const formatTrend = (trend: number | null | undefined): string => {
    if (trend === null || trend === undefined) return '0.0%';
    const formatted = trend.toFixed(1);
    return trend > 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 select-none"
    >
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Người dùng', value: stats?.total_users, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', trend: formatTrend(stats?.user_trend) },
          { label: 'Tổng tin nhắn', value: stats?.total_messages, icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20', trend: formatTrend(stats?.message_trend) },
          { label: 'Tài liệu', value: stats?.total_documents, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', trend: formatTrend(stats?.document_trend) },
          { label: 'Tỷ lệ hài lòng', value: `${stats?.satisfaction_rate}%`, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', trend: formatTrend(stats?.rating_trend) },
        ].map((item, idx) => (
          <motion.div 
            key={idx}
            variants={itemVariants}
            className="bg-surface-1/60 backdrop-blur-md p-6 rounded-3xl border border-hairline shadow-md hover:shadow-xl hover:border-brand-lavender/30 transition-all duration-300 group cursor-default relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-secure/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className={`p-3 rounded-2xl border ${item.bg} ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                <item.icon size={20} />
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${
                item.trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25" : 
                item.trend.startsWith('-') ? "bg-rose-500/10 text-rose-500 border-rose-500/25" : "bg-surface-2 text-ink-subtle border-hairline"
              }`}>
                {item.trend.startsWith('+') && <ArrowUpRight size={10} />}
                {item.trend.startsWith('-') && <ArrowDownRight size={10} />}
                {item.trend}
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-ink-tertiary uppercase tracking-widest leading-none">{item.label}</p>
              <h3 className="text-3xl font-be-vietnam font-bold text-ink mt-2 tracking-tight">{item.value !== undefined ? item.value : 0}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Trend - Bento Large */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-2 bg-surface-1/60 backdrop-blur-md p-8 rounded-[2rem] border border-hairline shadow-md relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-lavender/10 text-brand-lavender border border-brand-lavender-border rounded-xl">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="font-be-vietnam font-bold text-ink text-lg">Hoạt động hệ thống</h3>
                <p className="text-xs text-ink-subtle font-medium mt-0.5">
                  Tần suất tra cứu {timeFilter === 'custom' ? `từ ${startDate} đến ${endDate}` : `trong ${timeFilter} ngày gần nhất`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="bg-surface-2 border border-hairline text-xs font-bold text-ink-muted rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-lavender/25 outline-none transition-all cursor-pointer"
              >
                <option value="7">7 ngày qua</option>
                <option value="30">30 ngày qua</option>
                <option value="90">90 ngày qua</option>
                <option value="custom">Tùy chọn...</option>
              </select>

              {timeFilter === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2 py-1 bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender"
                  />
                  <span className="text-ink-subtle text-[10px]">đến</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2 py-1 bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="h-[300px] w-full relative">
            {loadingUsage && (
              <div className="absolute inset-0 bg-surface-1/40 flex items-center justify-center backdrop-blur-[1px] z-10 rounded-2xl">
                <Loader2 className="animate-spin text-brand-lavender" size={24} />
              </div>
            )}
            {usage.length > 0 ? (
              <UsageTrendChart data={usage} />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-ink-tertiary">
                <AlertCircle size={44} strokeWidth={1.5} className="mb-3 opacity-25" />
                <p className="font-medium text-sm">Chưa có dữ liệu thống kê</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Feedback Distribution - Bento Small */}
        <motion.div 
          variants={itemVariants}
          className="bg-surface-1/60 backdrop-blur-md p-8 rounded-[2rem] border border-hairline shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 rounded-xl">
              <ThumbsUp size={18} />
            </div>
            <div>
              <h3 className="font-be-vietnam font-bold text-ink text-lg">Đánh giá RAG</h3>
              <p className="text-xs text-ink-subtle font-medium mt-0.5">Mức độ hài lòng của nhân viên</p>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center min-h-[220px]">
            {hasFeedback ? (
              <FeedbackPieChart 
                data={feedbackData} 
                colors={['#10b981', '#f43f5e', '#64748b']} 
              />
            ) : (
              <div className="flex flex-col items-center text-ink-tertiary">
                <ThumbsUp size={44} strokeWidth={1.5} className="mb-3 opacity-25" />
                <p className="font-medium text-sm">Chưa có đánh giá từ cuộc chat</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-6 border-t border-hairline grid grid-cols-3 gap-2">
            {feedbackData.map((d, i) => (
              <div key={i} className="text-center flex flex-col items-center">
                <div className="h-8 flex items-center justify-center">
                  <p className="text-[10px] font-bold text-ink-tertiary uppercase leading-tight">{d.name}</p>
                </div>
                <p className="text-base font-be-vietnam font-bold text-ink mt-1">{d.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Topic Analytics Section [NEW] */}
      <motion.div 
        variants={itemVariants}
        className="bg-surface-1/60 backdrop-blur-md p-8 rounded-[2rem] border border-hairline shadow-md relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-xl">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-be-vietnam font-bold text-ink text-lg">Phân tích và thống kê chủ đề</h3>
              <p className="text-xs text-ink-subtle font-medium mt-0.5">Các chủ đề hội thoại nhân viên đang quan tâm nhiều nhất trong tuần</p>
            </div>
          </div>
          <button
            onClick={handleRefreshTopics}
            disabled={refreshingTopics}
            className="text-xs font-semibold text-brand-lavender bg-brand-lavender/10 px-3 py-1.5 rounded-xl border border-brand-lavender/20 flex items-center gap-1.5 shadow-sm hover:bg-brand-lavender/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {refreshingTopics ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            <span>Cập nhật lại</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Biểu đồ cột ngang (8/12) */}
          <div className="lg:col-span-8 h-[280px]">
            {topics.length > 0 ? (
              <TopicBarChart data={topics} />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-ink-tertiary bg-surface-2/40 border border-hairline border-dashed rounded-3xl p-6">
                <AlertCircle size={44} strokeWidth={1.5} className="mb-3 opacity-25 animate-pulse" />
                <p className="font-medium text-xs">Đang phân tích và gom cụm chủ đề bằng AI...</p>
              </div>
            )}
          </div>
          
          {/* Chú thích & Insight mô tả (4/12) */}
          <div className="lg:col-span-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">Tóm tắt các chủ đề nổi bật</h4>
            <div className="space-y-2.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
              {topics.length > 0 ? (
                topics.map((t, idx) => (
                  <div key={idx} className="p-3 bg-surface-2 border border-hairline rounded-xl flex flex-col gap-1 hover:border-brand-lavender/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-ink">{t.topic}</span>
                      <span className="text-[10px] font-bold text-brand-lavender bg-brand-lavender/10 px-2 py-0.5 rounded-full border border-brand-lavender/25">
                        {t.count} câu hỏi ({t.percentage}%)
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5">{t.description}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-ink-subtle italic">
                  Chưa có đủ dữ liệu hội thoại tuần này để AI phân tích.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Removed FAQ optimization and model status card section */}
    </motion.div>
  );
}
