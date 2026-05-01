'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { UsageStats } from '@/app/lib/types';

// Đăng ký các thành phần cần thiết cho Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface UsageTrendChartProps {
  data: UsageStats[];
}

export const UsageTrendChart = ({ data }: UsageTrendChartProps) => {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[250px] w-full flex items-center justify-center text-gray-400">Đang khởi tạo biểu đồ...</div>;
  }

  if (!data?.length) {
    return <div className="h-[250px] w-full flex items-center justify-center text-gray-400">Không có dữ liệu hiển thị</div>;
  }

  const chartData = {
    labels: data.map(item => item.date),
    datasets: [
      {
        label: 'Số lượt tra cứu',
        data: data.map(item => item.count),
        fill: true,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderColor: '#2563eb',
        borderWidth: 3,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4, // Tạo độ cong cho đường
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#fff',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        usePointStyle: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          drawBorder: false,
          color: '#f3f4f6',
        },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className="w-full h-[250px]">
      <Line data={chartData} options={options} />
    </div>
  );
};

interface FeedbackPieChartProps {
  data: { name: string; value: number }[];
  colors: string[];
}

export const FeedbackPieChart = ({ data, colors }: FeedbackPieChartProps) => {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[250px] w-full flex items-center justify-center text-gray-400">Đang khởi tạo biểu đồ...</div>;
  }

  // Lọc dữ liệu > 0
  const filteredData = data.filter(item => item.value > 0);

  if (filteredData.length === 0) {
    return (
      <div className="h-[250px] w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
        <div className="w-20 h-20 rounded-full border-4 border-gray-200 border-dashed mb-2" />
        <p>Chưa có dữ liệu phản hồi</p>
      </div>
    );
  }

  const chartData = {
    labels: filteredData.map(item => item.name),
    datasets: [
      {
        data: filteredData.map(item => item.value),
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: '#fff',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
      },
    },
    cutout: '60%', // Tạo biểu đồ Doughnut
  };

  return (
    <div className="w-full h-[250px] flex items-center justify-center">
      <Pie data={chartData} options={options} />
    </div>
  );
};
