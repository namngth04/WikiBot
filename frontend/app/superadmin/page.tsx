'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { Loader2, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

const UserRegistrationTrendChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.UserRegistrationTrendChart), { 
  ssr: false,
  loading: () => <div className="h-[250px] w-full bg-surface-2 animate-pulse rounded-2xl" />
});

const LLMCallDistributionChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.LLMCallDistributionChart), { 
  ssr: false,
  loading: () => <div className="h-[220px] w-full bg-surface-2 animate-pulse rounded-2xl" />
});

interface OverviewStats {
  total_users: number;
  total_messages: number;
  total_documents: number;
  satisfaction_rate: number;
}

interface TrendStats {
  user_trends: { date: string; personal: number; corporate: number }[];
  llm_distribution: { model_name: string; count: number }[];
}

export default function SuperadminDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [trends, setTrends] = useState<TrendStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, trendsRes] = await Promise.all([
        api.get('/admin/stats/overview'),
        api.get('/admin/stats/trends')
      ]);
      setStats(statsRes.data);
      setTrends(trendsRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center pb-4 border-b border-hairline">
        <div>
          <h3 className="text-base font-bold text-white">Giám sát hệ thống & tài nguyên</h3>
          <p className="text-xs text-ink-subtle mt-0.5">Tổng quan hoạt động hệ thống</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-lg border border-hairline hover:bg-surface-2 text-ink-subtle hover:text-ink transition-colors disabled:opacity-50"
          title="Làm mới"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
          <span className="text-xs text-ink-subtle">Đang tải dữ liệu tổng quan...</span>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 rounded-xl border border-hairline bg-surface-1">
              <span className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Người dùng</span>
              <span className="text-xl font-bold text-ink">{stats?.total_users ?? 0}</span>
            </div>
            <div className="p-5 rounded-xl border border-hairline bg-surface-1">
              <span className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Tài liệu tải lên</span>
              <span className="text-xl font-bold text-ink">{stats?.total_documents ?? 0}</span>
            </div>
            <div className="p-5 rounded-xl border border-hairline bg-surface-1">
              <span className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Câu hỏi RAG</span>
              <span className="text-xl font-bold text-ink">{stats?.total_messages ?? 0}</span>
            </div>
            <div className="p-5 rounded-xl border border-hairline bg-surface-1">
              <span className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Tỷ lệ hài lòng</span>
              <span className="text-xl font-bold text-ink">{stats?.satisfaction_rate ?? 0}%</span>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Registration Line Chart */}
            <div className="lg:col-span-2 p-6 rounded-2xl border border-hairline bg-surface-1 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Xu hướng đăng ký người dùng mới</h4>
              <UserRegistrationTrendChart data={trends?.user_trends || []} />
            </div>

            {/* LLM Call Distribution Pie Chart */}
            <div className="lg:col-span-1 p-6 rounded-2xl border border-hairline bg-surface-1 space-y-4 flex flex-col justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Phân bổ cuộc gọi AI</h4>
              <LLMCallDistributionChart data={trends?.llm_distribution || []} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

