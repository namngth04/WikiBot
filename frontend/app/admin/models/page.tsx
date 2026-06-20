'use client';

import { useState, useEffect } from 'react';
import { Cpu, Plus, RefreshCw, CheckCircle2, AlertCircle, Globe, Edit2, Trash2 } from 'lucide-react';
import { chatModelsAPI } from '@/app/lib/ai-config-api';
import ModelFormModal from '@/components/admin/ModelFormModal';
import { motion } from 'framer-motion';

export default function AdminModelsPage() {
  const [systemModels, setSystemModels] = useState<any[]>([]);
  const [companyModels, setCompanyModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [modelTestResults, setModelTestResults] = useState<Record<number, { success: boolean; message: string; latency?: number }>>({});

  const fetchChatModels = async () => {
    setFetchingModels(true);
    try {
      const [activeRes, adminRes] = await Promise.all([
        chatModelsAPI.listActive(),
        chatModelsAPI.list()
      ]);
      const globals = (activeRes.data || []).filter((m: any) => m.is_global === true);
      setSystemModels(globals);
      setCompanyModels(adminRes.data || []);
    } catch (err) {
      console.error('Failed to load chat models:', err);
    } finally {
      setFetchingModels(false);
    }
  };

  useEffect(() => {
    fetchChatModels();
  }, []);

  const handleOpenAddModelModal = () => {
    setSelectedModel(null);
    setIsModelModalOpen(true);
  };

  const handleOpenEditModelModal = (model: any) => {
    setSelectedModel(model);
    setIsModelModalOpen(true);
  };

  const handleSaveModel = async (formData: any) => {
    try {
      if (selectedModel?.id) {
        await chatModelsAPI.update(selectedModel.id, formData);
        setSuccess('Cập nhật cấu hình mô hình AI thành công!');
      } else {
        await chatModelsAPI.create(formData);
        setSuccess('Đăng ký mô hình AI doanh nghiệp mới thành công!');
      }
      fetchChatModels();
      setIsModelModalOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lưu cấu hình mô hình thất bại');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteModel = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mô hình AI "${name}"?`)) {
      return;
    }
    setLoading(true);
    try {
      await chatModelsAPI.delete(id);
      setSuccess(`Đã xóa mô hình "${name}" thành công!`);
      fetchChatModels();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Xóa mô hình thất bại');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleTestModelConnection = async (id: number) => {
    setTestingModelId(id);
    try {
      const response = await chatModelsAPI.testConnection(id);
      if (response.data.success) {
        setModelTestResults(prev => ({
          ...prev,
          [id]: {
            success: true,
            message: response.data.message || 'Kết nối thành công!',
            latency: response.data.latency_ms
          }
        }));
        setSuccess('Kết nối thử nghiệm thành công!');
        fetchChatModels();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setModelTestResults(prev => ({
          ...prev,
          [id]: {
            success: false,
            message: response.data.message || 'Kết nối thất bại'
          }
        }));
      }
    } catch (err: any) {
      console.error(err);
      setModelTestResults(prev => ({
        ...prev,
        [id]: {
          success: false,
          message: err.response?.data?.detail || 'Lỗi kiểm tra kết nối'
        }
      }));
    } finally {
      setTestingModelId(null);
    }
  };

  const handleToggleModelActive = async (model: any) => {
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
      fetchChatModels();
    } catch (err) {
      console.error('Failed to toggle model active status:', err);
    }
  };

  const getProviderBadge = (provider: string) => {
    const styles: Record<string, string> = {
      openai: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      openrouter: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      gemini: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      ollama: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${styles[provider] || 'bg-surface-2 text-ink-subtle border-hairline'}`}>
        {provider === 'gemini' ? 'Gemini' : provider}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast Messages */}
      {(success || error) && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500 border border-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 size={16} />
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-500 border border-rose-600 text-white px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-lg"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </div>
      )}

      {/* Header Banner and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface-1 border border-hairline p-6 rounded-[2rem] shadow-sm gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-be-vietnam font-bold text-ink flex items-center gap-2">
            <Cpu className="text-brand-lavender w-6 h-6" />
            Cấu hình mô hình AI Doanh nghiệp
          </h3>
          <p className="text-xs text-ink-subtle">
            Quản lý kết nối mô hình LLM từ OpenAI, Gemini, hoặc Ollama phục vụ cho toàn bộ nhân viên doanh nghiệp.
          </p>
        </div>
        <button
          onClick={handleOpenAddModelModal}
          className="flex items-center gap-2 bg-brand-lavender text-white px-4 py-2.5 rounded-2xl hover:bg-brand-lavender-hover transition-all font-bold text-xs shadow-sm active:scale-95 whitespace-nowrap"
        >
          <Plus size={14} />
          Đăng ký Mô hình
        </button>
      </div>

      {/* Loading state */}
      {fetchingModels ? (
        <div className="text-center py-10 border border-hairline rounded-[2rem] text-ink-tertiary text-xs bg-surface-1">
          <RefreshCw className="animate-spin text-brand-lavender w-6 h-6 mx-auto mb-2" />
          Đang tải danh sách mô hình...
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: SYSTEM MODELS (READ ONLY) */}
          {systemModels.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-ink-subtle uppercase tracking-wider pl-1 flex items-center gap-1.5">
                🛡️ Mô hình hệ thống
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemModels.map((model) => (
                  <div 
                    key={model.id}
                    className="bg-surface-1/40 border border-hairline rounded-2xl p-5 shadow-sm space-y-3 opacity-80"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <h5 className="text-xs font-bold text-ink-muted line-clamp-1">{model.name}</h5>
                        <p className="text-[10px] text-ink-subtle font-mono line-clamp-1">{model.api_model}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getProviderBadge(model.provider)}
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 uppercase tracking-wider">
                          Hệ thống
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-ink-muted bg-surface-2/60 p-2 rounded-lg font-mono truncate">
                      <span className="font-bold">Base URL:</span> {model.api_base_url || '(Sử dụng của hệ thống)'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: COMPANY MODELS (CRUD) */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-ink-subtle uppercase tracking-wider pl-1 flex items-center gap-1.5">
              🏢 Mô hình doanh nghiệp tự thêm ({companyModels.length})
            </h4>
            {companyModels.length === 0 ? (
              <div className="text-center py-10 border border-hairline border-dashed rounded-[2rem] text-ink-tertiary text-xs bg-surface-2/10">
                Doanh nghiệp chưa tự thêm mô hình LLM riêng nào. Hãy kết nối thêm mô hình OpenAI hoặc Ollama của công ty!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companyModels.map((model) => {
                  const result = model.id ? modelTestResults[model.id] : null;
                  return (
                    <div 
                      key={model.id}
                      className={`bg-surface-1 border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4 hover:border-brand-lavender/30 ${
                        model.is_active 
                          ? 'border-brand-lavender/20 bg-brand-lavender/[0.01]' 
                          : 'border-hairline'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-ink line-clamp-1">{model.name}</h5>
                            <p className="text-[10px] text-ink-subtle font-mono line-clamp-1">{model.api_model}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {getProviderBadge(model.provider)}
                            <button
                              onClick={() => handleToggleModelActive(model)}
                              className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider transition-all ${
                                model.is_active 
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                                  : 'bg-surface-2 text-ink-subtle border-hairline hover:bg-surface-3'
                              }`}
                              title={model.is_active ? "Nhấn để tạm tắt mô hình" : "Nhấn để kích hoạt mô hình"}
                            >
                              {model.is_active ? 'Bật' : 'Tắt'}
                            </button>
                          </div>
                        </div>

                        {/* URL Path */}
                        <div className="text-[10px] text-ink-muted bg-surface-2 p-2 rounded-lg font-mono truncate">
                          <span className="font-bold">Base URL:</span> {model.api_base_url || '(Mặc định)'}
                        </div>

                        {/* Key Status */}
                        <div className="flex items-center gap-1.5 text-[10px] text-ink-subtle">
                          <span className={`w-1.5 h-1.5 rounded-full ${model.has_api_key ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          <span>{model.has_api_key ? 'Đã cấu hình API Key' : 'Không dùng API Key (Ollama / Local)'}</span>
                        </div>
                      </div>

                      {/* Connection test result */}
                      {result && (
                        <div className={`p-2.5 rounded-xl border text-[11px] font-medium space-y-1 ${
                          result.success 
                            ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/15' 
                            : 'bg-rose-500/5 text-rose-500 border-rose-500/15'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              {result.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                              {result.success ? 'Kết nối OK!' : 'Kết nối lỗi'}
                            </span>
                            {result.latency && (
                              <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] text-emerald-500">
                                {result.latency.toFixed(0)} ms
                              </span>
                            )}
                          </div>
                          <p className="opacity-90 font-normal line-clamp-2 leading-relaxed">{result.message}</p>
                        </div>
                      )}

                      {/* Card Actions */}
                      <div className="border-t border-hairline pt-3 flex justify-between items-center">
                        <button
                          onClick={() => model.id && handleTestModelConnection(model.id)}
                          disabled={testingModelId === model.id}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            testingModelId === model.id 
                              ? 'bg-surface-3 text-ink-muted border-hairline cursor-not-allowed'
                              : 'bg-surface-2 hover:bg-surface-3 text-ink-muted border-hairline hover:text-ink'
                          }`}
                        >
                          {testingModelId === model.id ? (
                            <RefreshCw size={10} className="animate-spin text-brand-lavender" />
                          ) : (
                            <Globe size={10} className="text-brand-lavender" />
                          )}
                          {testingModelId === model.id ? 'Đang kiểm tra...' : 'Test Connection'}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModelModal(model)}
                            className="p-1.5 text-ink-subtle hover:text-brand-lavender hover:bg-brand-lavender/5 border border-transparent hover:border-brand-lavender/25 rounded-lg transition-all"
                            title="Sửa cấu hình"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => model.id && handleDeleteModel(model.id, model.name)}
                            className="p-1.5 text-ink-subtle hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 rounded-lg transition-all"
                            title="Xóa mô hình"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Creation & Update Modal */}
      <ModelFormModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onSave={handleSaveModel}
        model={selectedModel}
      />
    </div>
  );
}
