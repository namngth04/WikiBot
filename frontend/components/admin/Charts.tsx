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


interface UserRegistrationTrendChartProps {
  data: { date: string; personal: number; corporate: number }[];
}

export const UserRegistrationTrendChart = ({ data }: UserRegistrationTrendChartProps) => {
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

  const personalColor = '#3b82f6';
  const corporateColor = '#f59e0b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9';
  const textColor = isDark ? '#8a8f98' : '#94a3b8';
  const tooltipBg = isDark ? '#141516' : '#ffffff';
  const tooltipBorder = isDark ? '#23252a' : '#e2e8f0';

  const chartData = {
    labels: data.map(item => item.date.substring(5)), // MM-DD
    datasets: [
      {
        label: 'Cá nhân',
        data: data.map(item => item.personal),
        borderColor: personalColor,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: 'Doanh nghiệp',
        data: data.map(item => item.corporate),
        borderColor: corporateColor,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
          font: { size: 10, family: 'var(--font-be-vietnam)' }
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: gridColor,
        },
        ticks: {
          color: textColor,
          font: { size: 9 },
          precision: 0,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: { size: 9 },
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


interface LLMCallDistributionChartProps {
  data: { model_name: string; count: number }[];
}

export const LLMCallDistributionChart = ({ data }: LLMCallDistributionChartProps) => {
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

  const colors = ['#5e6ad2', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const tooltipBg = isDark ? '#141516' : '#ffffff';
  const tooltipBorder = isDark ? '#23252a' : '#e2e8f0';
  const textColor = isDark ? '#8a8f98' : '#94a3b8';

  const chartData = {
    labels: data.map(item => item.model_name),
    datasets: [
      {
        data: data.map(item => item.count),
        backgroundColor: colors.slice(0, data.length),
        borderColor: isDark ? '#0f1011' : '#fff',
        borderWidth: 1.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          color: textColor,
          font: { size: 9, family: 'var(--font-be-vietnam)' },
          boxWidth: 10,
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 10,
      },
    },
    cutout: '60%',
  };

  return (
    <div className="w-full h-[220px] flex items-center justify-center">
      <Pie data={chartData} options={options} />
    </div>
  );
};


interface RevenueTrendChartProps {
  data: { month: string; revenue: number }[];
}

export const RevenueTrendChart = ({ data }: RevenueTrendChartProps) => {
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

  const brandColor = '#10b981';
  const brandBg = 'rgba(16, 185, 129, 0.1)';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9';
  const textColor = isDark ? '#8a8f98' : '#94a3b8';
  const tooltipBg = isDark ? '#141516' : '#ffffff';
  const tooltipBorder = isDark ? '#23252a' : '#e2e8f0';

  const chartData = {
    labels: data.map(item => item.month),
    datasets: [
      {
        label: 'Doanh thu (VNĐ)',
        data: data.map(item => item.revenue),
        fill: true,
        backgroundColor: brandBg,
        borderColor: brandColor,
        borderWidth: 2,
        tension: 0.35,
        pointBackgroundColor: brandColor,
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
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: gridColor,
        },
        ticks: {
          color: textColor,
          font: { size: 9 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: { size: 9 },
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


interface RevenueComparisonChartProps {
  data: { category: string; revenue: number }[];
}

export const RevenueComparisonChart = ({ data }: RevenueComparisonChartProps) => {
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

  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9';
  const textColor = isDark ? '#8a8f98' : '#94a3b8';
  const colors = ['#5e6ad2', '#8b5cf6'];

  const chartData = {
    labels: data.map(item => item.category),
    datasets: [
      {
        label: 'Doanh thu (VNĐ)',
        data: data.map(item => item.revenue),
        backgroundColor: colors,
        borderRadius: 6,
        barThickness: 28,
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
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: gridColor,
        },
        ticks: {
          color: textColor,
          font: { size: 9 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: textColor,
          font: { size: 9 },
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



