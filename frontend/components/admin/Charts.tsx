'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { UsageStats } from '@/app/lib/types';

// Đăng ký các thành phần cần thiết cho Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  const [isDark, setIsDark] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
    
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return <div className="h-[250px] w-full flex items-center justify-center text-ink-tertiary">Đang khởi tạo biểu đồ...</div>;
  }

  if (!data?.length) {
    return <div className="h-[250px] w-full flex items-center justify-center text-ink-tertiary">Không có dữ liệu hiển thị</div>;
  }

  const brandColor = isDark ? '#5e6ad2' : '#533afd';
  const brandBg = isDark ? 'rgba(94, 106, 210, 0.1)' : 'rgba(83, 58, 253, 0.08)';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9';
  const textColor = isDark ? '#8a8f98' : '#94a3b8';
  const tooltipBg = isDark ? '#141516' : '#ffffff';
  const tooltipBorder = isDark ? '#23252a' : '#e2e8f0';
  const tooltipText = isDark ? '#f7f8f8' : '#0d253d';
  const tooltipSubtext = isDark ? '#8a8f98' : '#475569';

  const chartData = {
    labels: data.map(item => item.date),
    datasets: [
      {
        label: 'Số lượt tra cứu',
        data: data.map(item => item.count),
        fill: true,
        backgroundColor: brandBg,
        borderColor: brandColor,
        borderWidth: 2.5,
        pointBackgroundColor: brandColor,
        pointBorderColor: isDark ? '#0f1011' : '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
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
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipSubtext,
        borderColor: tooltipBorder,
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
          color: gridColor,
        },
        ticks: {
          color: textColor,
          font: { size: 10, family: 'var(--font-be-vietnam)' },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: { size: 10, family: 'var(--font-be-vietnam)' },
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
  const [isDark, setIsDark] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
    
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return <div className="h-[250px] w-full flex items-center justify-center text-ink-tertiary">Đang khởi tạo biểu đồ...</div>;
  }

  const activeIndices = data.map((item, index) => item.value > 0 ? index : -1).filter(index => index !== -1);
  const filteredData = activeIndices.map(index => data[index]);
  const filteredColors = activeIndices.map(index => colors[index]);

  if (filteredData.length === 0) {
    return (
      <div className="h-[250px] w-full flex flex-col items-center justify-center text-ink-tertiary bg-surface-2/40 border border-hairline rounded-3xl">
        <div className="w-16 h-16 rounded-full border-2 border-hairline border-dashed mb-3 animate-pulse" />
        <p className="text-xs font-medium">Chưa có dữ liệu phản hồi</p>
      </div>
    );
  }

  const tooltipBg = isDark ? '#141516' : '#ffffff';
  const tooltipBorder = isDark ? '#23252a' : '#e2e8f0';
  const tooltipText = isDark ? '#f7f8f8' : '#0d253d';
  const tooltipSubtext = isDark ? '#8a8f98' : '#475569';

  const chartData = {
    labels: filteredData.map(item => item.name),
    datasets: [
      {
        data: filteredData.map(item => item.value),
        backgroundColor: filteredColors,
        borderColor: isDark ? '#0f1011' : '#fff',
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
        display: false,
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipSubtext,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 12,
      },
    },
    cutout: '70%',
  };

  return (
    <div className="w-full h-[250px] flex items-center justify-center">
      <Pie data={chartData} options={options} />
    </div>
  );
};


interface TopicBarChartProps {
  data: { topic: string; count: number; percentage: number }[];
}

export const TopicBarChart = ({ data }: TopicBarChartProps) => {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
    
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return <div className="h-[250px] w-full flex items-center justify-center text-ink-tertiary">Đang khởi tạo biểu đồ...</div>;
  }

  if (!data?.length) {
    return <div className="h-[250px] w-full flex items-center justify-center text-ink-tertiary">Không có dữ liệu hiển thị</div>;
  }

  const brandColor = isDark ? '#818cf8' : '#6366f1';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9';
  const textColor = isDark ? '#8a8f98' : '#94a3b8';
  const tooltipBg = isDark ? '#141516' : '#ffffff';
  const tooltipBorder = isDark ? '#23252a' : '#e2e8f0';
  const tooltipText = isDark ? '#f7f8f8' : '#0d253d';
  const tooltipSubtext = isDark ? '#8a8f98' : '#475569';

  const chartData = {
    labels: data.map(item => item.topic),
    datasets: [
      {
        label: 'Số lượt hỏi',
        data: data.map(item => item.count),
        backgroundColor: brandColor,
        borderRadius: 8,
        borderWidth: 0,
        barThickness: 16,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipSubtext,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: true,
          drawBorder: false,
          color: gridColor,
        },
        ticks: {
          color: textColor,
          font: { size: 10, family: 'var(--font-be-vietnam)' },
          precision: 0,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: { size: 10, family: 'var(--font-be-vietnam)', weight: 'bold' as const },
        },
      },
    },
  };

  return (
    <div className="w-full h-[250px]">
      <Bar data={chartData} options={options} />
    </div>
  );
};

