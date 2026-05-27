'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Layers, Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { adminAIAPI } from '@/app/lib/ai-config-api';

interface ModelStatus {
  type: 'chat' | 'embedding';
  name: string;
  status: 'testing' | 'success' | 'error' | 'not_configured';
  latency?: number;
  error?: string;
  lastTest?: Date;
}

interface ModelStatusCardProps {
  className?: string;
}

// Helper function to format error messages
const formatErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    // Handle error objects with msg property
    if (error.msg) {
      return error.msg;
    }
    
    // Handle error objects with message property  
    if (error.message) {
      return error.message;
    }
    
    // Handle error objects with detail property
    if (error.detail) {
      return error.detail;
    }
    
    // Handle validation errors
    if (error.type && error.loc) {
      return `Lỗi: ${error.type || 'Unknown'}`;
    }
  }
  
  return 'Lỗi không xác định';
};

// Helper function to build test payload for different providers
const buildTestPayload = (config: any) => {
  if (config.provider === 'local') {
    return {
      provider: config.provider,
      local_model_path: config.local_model_path,
      timeout: config.timeout
    };
  } else {
    // API providers - handle use_custom_model like chat logic
    const apiModel = config.use_custom_model ? config.custom_api_model : config.api_model;
    return {
      provider: config.provider,
      api_base_url: config.api_base_url,
      api_key: config.api_key,
      api_model: apiModel,  // Same logic as chat
      timeout: config.timeout
    };
  }
};

// Caching logic với localStorage
const CACHE_KEY = 'ai_model_status_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 ngày

const getCachedStatus = (): ModelStatus[] | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        // Convert string dates back to Date objects
        return data.map((item: any) => ({
          ...item,
          lastTest: item.lastTest ? new Date(item.lastTest) : undefined
        }));
      }
    }
  } catch (error) {
    console.warn('Error reading cached status:', error);
  }
  return null;
};

const setCachedStatus = (data: ModelStatus[]) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (error) {
    console.warn('Error setting cached status:', error);
  }
};

export default function ModelStatusCard({ className = '' }: ModelStatusCardProps) {
  const [models, setModels] = useState<ModelStatus[]>([
    { type: 'chat', name: 'Chat AI', status: 'not_configured' },
    { type: 'embedding', name: 'Embedding AI', status: 'not_configured' }
  ]);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    // Try to load from cache first
    const cached = getCachedStatus();
    if (cached) {
      setModels(cached);
    } else {
      // If no cache, test immediately
      testAllModels();
    }
  }, []);

  const testAllModels = async (forceTest = false) => {
    setIsTesting(true);
    const updatedModels = [...models];

    // Test Chat model
    try {
      updatedModels[0] = { ...updatedModels[0], status: 'testing' };
      setModels([...updatedModels]);

      // Backend will load config from database, use new endpoint
      const chatResult = await adminAIAPI.testConnectionAuto('chat');
      updatedModels[0] = {
        ...updatedModels[0],
        status: chatResult.data.success ? 'success' : 'error',
        latency: chatResult.data.latency_ms,
        error: chatResult.data.success ? undefined : chatResult.data.message,
        lastTest: new Date()
      };
    } catch (error: any) {
      updatedModels[0] = {
        ...updatedModels[0],
        status: 'error',
        error: error.response?.data?.detail || 'Lỗi kết nối',
        lastTest: new Date()
      };
    }

    // Test Embedding model
    try {
      updatedModels[1] = { ...updatedModels[1], status: 'testing' };
      setModels([...updatedModels]);

      // Backend will load config from database, use new endpoint
      const embeddingResult = await adminAIAPI.testConnectionAuto('embedding');
      updatedModels[1] = {
        ...updatedModels[1],
        status: embeddingResult.data.success ? 'success' : 'error',
        latency: embeddingResult.data.latency_ms,
        error: embeddingResult.data.success ? undefined : embeddingResult.data.message,
        lastTest: new Date()
      };
    } catch (error: any) {
      updatedModels[1] = {
        ...updatedModels[1],
        status: 'error',
        error: error.response?.data?.detail || 'Lỗi kết nối',
        lastTest: new Date()
      };
    }

    setModels(updatedModels);
    
    // Always cache after test
    setCachedStatus(updatedModels);
    setIsTesting(false);
  };

  const getStatusIcon = (status: ModelStatus['status']) => {
    switch (status) {
      case 'testing':
        return <Activity className="w-4 h-4 animate-pulse" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'not_configured':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusText = (status: ModelStatus['status']) => {
    switch (status) {
      case 'testing':
        return 'Đang test...';
      case 'success':
        return 'Hoạt động';
      case 'error':
        return 'Lỗi';
      case 'not_configured':
        return 'Chưa cấu hình';
    }
  };

  const getStatusColor = (status: ModelStatus['status']) => {
    switch (status) {
      case 'testing':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'not_configured':
        return 'text-yellow-400';
    }
  };

  const getProgressWidth = (status: ModelStatus['status'], latency?: number) => {
    switch (status) {
      case 'testing':
        return 'w-[50%] animate-pulse';
      case 'success':
        return 'w-full';  // Always full width when successful
      case 'error':
        return 'w-[20%]';
      case 'not_configured':
        return 'w-[10%]';
    }
  };

  // Check if cache is still valid
  const isCacheValid = () => {
    const cached = getCachedStatus();
    if (!cached || cached.length === 0) return false;
    
    const lastTest = cached[0]?.lastTest;
    if (!lastTest) return false;
    
    const hoursSinceTest = (Date.now() - lastTest.getTime()) / (1000 * 60 * 60);
    return hoursSinceTest < 24;
  };

  return (
    <motion.div 
      className={`bg-brand-lavender rounded-[2rem] p-8 text-white relative overflow-hidden group ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-be-vietnam font-bold">Trạng thái Model</h3>
            <p className="text-white/70 text-sm mt-1">
              {isCacheValid() ? 'Kiểm tra lần cuối: < 24h' : 'Chưa kiểm tra hôm nay'}
            </p>
          </div>
          <button
            onClick={() => testAllModels(true)}
            disabled={isTesting}
            className="bg-white/20 hover:bg-white/30 disabled:bg-white/10 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
          >
            {isTesting ? 'Testing...' : 'Test lại'}
          </button>
        </div>

        <div className="space-y-4">
          {models.map((model, index) => (
            <div key={model.type} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {model.type === 'chat' ? (
                    <Brain className="w-4 h-4" />
                  ) : (
                    <Layers className="w-4 h-4" />
                  )}
                  <span className="font-medium">{model.name}</span>
                  {getStatusIcon(model.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${getStatusColor(model.status)}`}>
                    {getStatusText(model.status)}
                  </span>
                  {model.latency && (
                    <span className="text-xs text-white/60 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {model.latency.toFixed(0)}ms
                    </span>
                  )}
                </div>
              </div>
              
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-700 ${getProgressWidth(model.status, model.latency)}`}
                />
              </div>

              {model.error && (
                <div className="text-xs text-red-300 mt-1">
                  {formatErrorMessage(model.error)}
                </div>
              )}

              {model.lastTest && (
                <div className="text-xs text-white/50 mt-1">
                  Test cuối: {model.lastTest.toLocaleTimeString('vi-VN')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -right-8 -bottom-8 text-white/5 w-64 h-64 group-hover:text-primary-500/10 transition-colors duration-700">
        <Brain className="w-full h-full" />
      </div>
    </motion.div>
  );
}
