'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Play, Edit2, Trash2, ShieldAlert, Cpu, 
  Wifi, WifiOff, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { chatModelsAPI, ChatModelData } from '@/app/lib/ai-config-api';
import ModelFormModal from './ModelFormModal';

export default function ModelManagementTab() {
  const [models, setModels] = useState<ChatModelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string; latency?: number }>>({});
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ChatModelData | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await chatModelsAPI.list();
      setModels(response.data || []);
    } catch (err) {
      console.error('Failed to load chat models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleOpenAddModal = () => {
    setSelectedModel(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (model: ChatModelData) => {
    setSelectedModel(model);
    setIsModalOpen(true);
  };

  const handleSaveModel = async (formData: ChatModelData) => {
    if (selectedModel?.id) {
      // Update
      await chatModelsAPI.update(selectedModel.id, formData);
    } else {
      // Create
      await chatModelsAPI.create(formData);
    }
    fetchModels();
  };

  const handleDeleteModel = async (id: number, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa mô hình LLM "${name}"?`)) {
      try {
        await chatModelsAPI.delete(id);
        fetchModels();
      } catch (err) {
        console.error('Failed to delete model:', err);
      }
    }
  };

  const handleTestConnection = async (id: number) => {
    if (!id) return;
    setTestingId(id);
    try {
      const response = await chatModelsAPI.testConnection(id);
      if (response.data.success) {
        setTestResults(prev => ({
          ...prev,
          [id]: {
            success: true,
            message: response.data.message || 'Kết nối thành công!',
            latency: response.data.latency_ms
          }
        }));
        // Refresh to get new active status
        fetchModels();
      } else {
        setTestResults(prev => ({
          ...prev,
          [id]: {
            success: false,
            message: response.data.message || 'Kết nối thất bại'
          }
        }));
      }
    } catch (err: any) {
      console.error(err);
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: false,
          message: err.response?.data?.detail || 'Lỗi kiểm tra kết nối'
        }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (model: ChatModelData) => {
    if (!model.id) return;
    try {
      const updatedData = {
        name: model.name,
        provider: model.provider,
        api_base_url: model.api_base_url,
        api_model: model.api_model,
        is_active: !model.is_active
      };
      await chatModelsAPI.update(model.id, updatedData);
      fetchModels();
    } catch (err) {
      console.error('Failed to toggle model active status:', err);
    }
  };

  const getProviderBadge = (provider: string) => {
    const styles: Record<string, string> = {
      openai: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900',
      openrouter: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900',
      gemini: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900',
      ollama: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900'
    };
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${styles[provider] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        {provider === 'gemini' ? 'Gemini' : provider}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Add Button */}
      <div className="flex justify-between items-center bg-surface-1 dark:bg-zinc-900 p-6 border border-hairline rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="text-brand-lavender w-5 h-5" />
            Danh sách mô hình LLM đã đăng ký
          </h3>
          <p className="text-sm text-ink-subtle">
            Quản lý các kết nối mô hình LLM từ các nhà cung cấp khác nhau. Chạy thử kết nối để tự động kích hoạt sử dụng trong RAG Chatbot.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-brand-lavender text-white px-4 py-2.5 rounded-xl hover:bg-brand-lavender-hover transition-all font-bold text-sm shadow-md"
        >
          <Plus size={16} />
          Đăng ký Mô hình
        </button>
      </div>

      {/* Model Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-surface-1 rounded-2xl border border-hairline">
          <RefreshCw className="animate-spin text-brand-lavender w-8 h-8 mb-2" />
          <span className="text-sm font-medium text-ink-muted">Đang tải danh sách mô hình...</span>
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-surface-1 rounded-2xl border border-hairline text-center space-y-3">
          <div className="p-3 bg-brand-lavender/10 rounded-full">
            <Cpu className="text-brand-lavender w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-ink">Chưa có mô hình nào được đăng ký</h3>
            <p className="text-sm text-ink-subtle max-w-md">
              Đăng ký mô hình OpenAI, Gemini hoặc Ollama cục bộ để hệ thống có thể kết nối và trả lời tin nhắn của người dùng.
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="btn-primary bg-brand-lavender hover:bg-brand-lavender-hover text-sm py-2 px-4"
          >
            Đăng ký mô hình đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {models.map(model => {
            const result = model.id ? testResults[model.id] : null;
            return (
              <div 
                key={model.id}
                className={`bg-surface-1 dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm transition-all flex flex-col justify-between space-y-4 hover:shadow-md ${
                  model.is_active 
                    ? 'border-brand-lavender/30 bg-brand-lavender/[0.01]' 
                    : 'border-hairline'
                }`}
              >
                {/* Upper Card Info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-ink line-clamp-1">{model.name}</h4>
                      <p className="text-xs text-ink-subtle font-mono line-clamp-1">{model.api_model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getProviderBadge(model.provider)}
                      
                      {/* Active Status Toggle */}
                      <button
                        onClick={() => handleToggleActive(model)}
                        className={`text-xs font-bold px-2 py-0.5 rounded-md border transition-all ${
                          model.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' 
                            : 'bg-surface-3 text-ink-subtle border-hairline'
                        }`}
                        title={model.is_active ? "Nhấn để vô hiệu hóa" : "Nhấn để kích hoạt"}
                      >
                        {model.is_active ? 'Đang bật' : 'Đang tắt'}
                      </button>
                    </div>
                  </div>

                  {/* URL Path */}
                  <div className="text-xs text-ink-muted bg-surface-2 dark:bg-zinc-950 p-2.5 rounded-xl font-mono truncate">
                    <span className="font-semibold text-ink-subtle">Base URL:</span> {model.api_base_url || '(Mặc định)'}
                  </div>

                  {/* Key Status */}
                  <div className="flex items-center gap-1 text-xs text-ink-subtle">
                    <span className={`w-1.5 h-1.5 rounded-full ${model.has_api_key ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    <span>{model.has_api_key ? 'Đã cấu hình API Key' : 'Không có API Key (Ollama / Local)'}</span>
                  </div>
                </div>

                {/* Connection Test Response */}
                {result && (
                  <div className={`p-3 rounded-xl border text-xs font-medium space-y-1 ${
                    result.success 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400' 
                      : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/15 dark:text-rose-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        {result.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {result.success ? 'Kết nối thành công!' : 'Kết nối thất bại'}
                      </span>
                      {result.latency && (
                        <span className="font-mono bg-emerald-100 dark:bg-emerald-900/35 px-1.5 py-0.5 rounded text-[10px]">
                          {result.latency.toFixed(0)} ms
                        </span>
                      )}
                    </div>
                    <p className="opacity-90 leading-relaxed font-normal">{result.message}</p>
                  </div>
                )}

                {/* Lower Actions Block */}
                <div className="border-t border-hairline pt-4 flex justify-between items-center">
                  <button
                    onClick={() => model.id && handleTestConnection(model.id)}
                    disabled={testingId === model.id}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                      testingId === model.id 
                        ? 'bg-surface-3 text-ink-muted border-hairline cursor-not-allowed'
                        : 'bg-surface-2 hover:bg-surface-3 text-ink-muted border-hairline hover:text-ink'
                    }`}
                  >
                    {testingId === model.id ? (
                      <RefreshCw size={12} className="animate-spin text-brand-lavender" />
                    ) : (
                      <Wifi size={12} className="text-brand-lavender" />
                    )}
                    {testingId === model.id ? 'Đang thử...' : 'Test Connection'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(model)}
                      className="p-1.5 text-ink-subtle hover:text-brand-lavender hover:bg-brand-lavender/5 border border-hairline hover:border-brand-lavender/30 rounded-lg transition-colors"
                      title="Sửa cấu hình"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => model.id && handleDeleteModel(model.id, model.name)}
                      className="p-1.5 text-ink-subtle hover:text-rose-600 hover:bg-rose-50 border border-hairline hover:border-rose-200 rounded-lg transition-colors"
                      title="Xóa mô hình"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Model Creation & Update Modal */}
      <ModelFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModel}
        model={selectedModel}
      />
    </div>
  );
}
