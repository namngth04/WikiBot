'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { adminAPI } from '@/app/lib/api';
import { DashboardStats, UsageStats } from '@/app/lib/types';
import { 
  Users, MessageSquare, FileText, Star, TrendingUp, ThumbsUp, AlertCircle
} from 'lucide-react';

// Import các component biểu đồ động để tránh lỗi SSR và TypeScript vạch đỏ
const UsageTrendChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.UsageTrendChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-50 animate-pulse rounded-lg" />
});

const FeedbackPieChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.FeedbackPieChart), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-50 animate-pulse rounded-lg" />
});

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usage, setUsage] = useState<UsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const fetchData = async () => {
      console.log('--- Dashboard: Bắt đầu tải dữ liệu ---');
      try {
        const [statsRes, usageRes] = await Promise.all([
          adminAPI.getOverview(),
          adminAPI.getUsage(30)
        ]);
        console.log('Dashboard Stats Response:', statsRes.data);
        console.log('Usage Stats Response:', usageRes.data);
        
        setStats(statsRes.data);
        const usageData = Array.isArray(usageRes.data) ? usageRes.data : [];
        const normalized = usageData.map((item: Partial<UsageStats>) => ({
          date: String(item?.date ?? ''),
          count: Number(item?.count ?? 0),
        }));
        console.log('Normalized Usage Data:', normalized);
        setUsage(normalized);
      } catch (error) {
        console.error('Lỗi khi fetch dữ liệu Dashboard:', error);
      } finally {
        setLoading(false);
        console.log('--- Dashboard: Kết thúc tải dữ liệu ---');
      }
    };
    fetchData();
  }, []);

  if (!isMounted || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const COLORS = ['#10B981', '#EF4444', '#9CA3AF'];
  const feedbackData = stats ? [
    { name: 'Hài lòng', value: stats.feedback_ratio.like },
    { name: 'Không hài lòng', value: stats.feedback_ratio.dislike },
    { name: 'Không phản hồi', value: stats.feedback_ratio.none },
  ] : [];

  const hasFeedback = feedbackData.some(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng người dùng</p>
              <h3 className="text-2xl font-bold mt-1">{stats?.total_users || 0}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng tin nhắn</p>
              <h3 className="text-2xl font-bold mt-1">{stats?.total_messages || 0}</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <MessageSquare size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tài liệu hệ thống</p>
              <h3 className="text-2xl font-bold mt-1">{stats?.total_documents || 0}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <FileText size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Đánh giá trung bình</p>
              <h3 className="text-2xl font-bold mt-1">{stats?.avg_rating || 0}/1</h3>
            </div>
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <Star size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-800">Tần suất tra cứu (30 ngày qua)</h3>
          </div>
          <div className="w-full">
            {usage.length > 0 ? (
              <UsageTrendChart data={usage} />
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <AlertCircle size={40} className="mb-2" />
                <p>Chưa có dữ liệu tra cứu trong 30 ngày qua</p>
              </div>
            )}
          </div>
        </div>

        {/* Feedback Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <ThumbsUp size={20} className="text-green-600" />
            <h3 className="font-bold text-gray-800">Phân bổ phản hồi</h3>
          </div>
          <div className="w-full">
            {hasFeedback ? (
              <FeedbackPieChart data={feedbackData} colors={COLORS} />
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <ThumbsUp size={40} className="mb-2 opacity-20" />
                <p>Chưa có phản hồi từ người dùng</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
