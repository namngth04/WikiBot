'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { 
  DollarSign, TrendingUp, CreditCard, RefreshCw, Loader2, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const RevenueTrendChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.RevenueTrendChart), { 
  ssr: false,
  loading: () => <div className="h-[250px] w-full bg-surface-2 animate-pulse rounded-2xl" />
});

const RevenueComparisonChart = dynamic(() => import('@/components/admin/Charts').then(mod => mod.RevenueComparisonChart), { 
  ssr: false,
  loading: () => <div className="h-[250px] w-full bg-surface-2 animate-pulse rounded-2xl" />
});

interface RevenueStats {
  total_revenue: number;
  personal_revenue: number;
  corporate_revenue: number;
  conversion_rate: number;
  pro_users_count: number;
  free_users_count: number;
  total_personal_users: number;
  revenue_by_month: { month: string; revenue: number }[];
  growth_rate: number;
}
export default function BusinessStatsPage() {
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [timeFilter, setTimeFilter] = useState('30'); // '7' | '30' | '90' | 'all' | 'custom'
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const params: any = {};
      if (timeFilter === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      } else if (timeFilter !== 'all') {
        params.days = parseInt(timeFilter);
      } else {
        params.days = 99999;
      }
      const revenueRes = await api.get('/admin/stats/revenue', { params });
      setRevenue(revenueRes.data);
    } catch (err) {
      console.error('Error fetching revenue stats:', err);
    } finally {
      setLoadingRevenue(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [timeFilter, startDate, endDate]);

  const getFilteredMetrics = () => {
    if (!revenue) return { total: 0, growth: 0, list: [] };

    return {
      total: revenue.total_revenue,
      growth: revenue.growth_rate,
      list: revenue.revenue_by_month
    };
  };

  const metrics = getFilteredMetrics();

  // Comparison data: Personal vs Corporate SaaS (doanh thu thực từ API)
  const comparisonData = [
    { category: 'Cá nhân PRO', revenue: revenue?.personal_revenue ?? 0 },
    { category: 'Doanh nghiệp SaaS', revenue: revenue?.corporate_revenue ?? 0 }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-hairline gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Thống kê kinh doanh</h3>
          <p className="text-xs text-ink-subtle mt-0.5">Giám sát doanh thu thương mại và tỉ lệ nâng cấp tài khoản thành viên</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Time Filter Select */}
          <div className="relative flex-1 md:flex-none">
            <Calendar className="absolute left-2.5 top-2.5 text-ink-subtle" size={12} />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender w-full md:w-36 appearance-none cursor-pointer"
            >
              <option value="7">7 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
              <option value="all">Toàn thời gian</option>
              <option value="custom">Tùy chọn...</option>
            </select>
          </div>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender"
              />
              <span className="text-ink-subtle">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-surface-2 border border-hairline rounded-lg text-ink outline-none focus:border-brand-lavender"
              />
            </div>
          )}

          <button
            onClick={fetchRevenue}
            disabled={loadingRevenue}
            className="p-1.5 rounded-lg border border-hairline hover:bg-surface-2 text-ink-subtle hover:text-ink transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw size={12} className={loadingRevenue ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loadingRevenue ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#5e6ad2]" size={28} />
          <span className="text-xs text-ink-subtle">Đang tải số liệu doanh thu...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Revenue Card */}
            <div className="p-5 rounded-xl border border-hairline bg-surface-1 relative overflow-hidden group hover:border-[#5e6ad2]/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-ink-subtle tracking-wider uppercase">Tổng doanh thu</span>
                <div className="w-8 h-8 rounded bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center text-[#5e6ad2]">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-extrabold text-ink">{metrics.total.toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>

            {/* Conversion Rate Card */}
            <div className="p-5 rounded-xl border border-hairline bg-surface-1 relative overflow-hidden group hover:border-[#5e6ad2]/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-ink-subtle tracking-wider uppercase">Tỷ lệ nâng cấp PRO</span>
                <div className="w-8 h-8 rounded bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6]">
                  <CreditCard size={16} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-ink">{revenue?.conversion_rate ?? 0.0}%</span>
                  <span className="text-[10px] text-ink-subtle">({revenue?.pro_users_count ?? 0}/{revenue?.total_personal_users ?? 0} tài khoản)</span>
                </div>
                <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden border border-hairline">
                  <div 
                    className="bg-gradient-to-r from-[#5e6ad2] to-[#8b5cf6] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${revenue?.conversion_rate ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Total upgrade transactions count */}
            <div className="p-5 rounded-xl border border-hairline bg-surface-1 relative overflow-hidden group hover:border-[#5e6ad2]/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-ink-subtle tracking-wider uppercase">Số lượng nâng cấp</span>
                <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-extrabold text-ink">{revenue?.pro_users_count ?? 0} giao dịch</span>
                <span className="text-[10px] text-ink-subtle">Tính trong khoảng thời gian bộ lọc</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend Area Chart */}
            <div className="p-6 rounded-2xl border border-hairline bg-surface-1 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Xu hướng doanh thu</h4>
              <RevenueTrendChart data={metrics.list} />
            </div>

            {/* Revenue Comparison Chart */}
            <div className="p-6 rounded-2xl border border-hairline bg-surface-1 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">So sánh cơ cấu doanh thu</h4>
              <RevenueComparisonChart data={comparisonData} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

