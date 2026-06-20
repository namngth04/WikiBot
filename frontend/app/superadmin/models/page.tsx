'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import ModelManagementTab from '@/components/admin/ModelManagementTab';
import { Loader2 } from 'lucide-react';

interface AIProviderConfigData {
  ai_type: string;
  provider: string;
  local_model_path: string | null;
  api_base_url: string | null;
  api_key: string | null;
  api_model: string | null;
  use_custom_model: boolean;
  custom_api_model: string | null;
  default_temperature: number;
  default_max_tokens: number;
  embedding_model_name: string | null;
  timeout?: number | null;
  use_rag_provider?: boolean | null;
}

interface AISafetyConfigData {
  max_temperature_limit: number;
  max_context_length: number;
  max_tokens_limit: number;
  default_temperature: number;
  default_response_style: string;
}

export default function ModelsPage() {
  const [aiConfigs, setAiConfigs] = useState<AIProviderConfigData[]>([]);
  const [safetyConfig, setSafetyConfig] = useState<AISafetyConfigData | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, {success: boolean; message: string; latency_ms?: number} | null>>({});
  const [savingAI, setSavingAI] = useState<string | null>(null);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, Partial<AIProviderConfigData>>>({});
  const [savingSafety, setSavingSafety] = useState(false);
  const [editingSafety, setEditingSafety] = useState<AISafetyConfigData | null>(null);

  const fetchAIConfigs = async () => {
    setLoadingAI(true);
    try {
      const [configsRes, safetyRes] = await Promise.all([
        api.get('/admin/ai-config'),
        api.get('/admin/ai-config/safety')
      ]);
      setAiConfigs(configsRes.data);
      setSafetyConfig(safetyRes.data);
      setEditingSafety(safetyRes.data);
      const initialEditing: Record<string, Partial<AIProviderConfigData>> = {};
      configsRes.data.forEach((c: AIProviderConfigData) => { initialEditing[c.ai_type] = {...c}; });
      setEditingConfigs(initialEditing);
    } catch (err) { 
      console.error('Error fetching AI configs:', err); 
    } finally { 
      setLoadingAI(false); 
    }
  };

  useEffect(() => {
    fetchAIConfigs();
  }, []);

  const handleSaveAIConfig = async (ai_type: string) => {
    setSavingAI(ai_type);
    try {
      await api.put(`/admin/ai-config/${ai_type}`, editingConfigs[ai_type]);
      await fetchAIConfigs();
      alert('Đã lưu cấu hình Embedding thành công!');
    } catch (err: any) {
      alert(`Lỗi khi lưu cấu hình AI: ${err?.response?.data?.detail || 'Vui lòng thử lại'}`);
    } finally { 
      setSavingAI(null); 
    }
  };

  const handleTestConnection = async (ai_type: string) => {
    setTestResults(prev => ({...prev, [ai_type]: null}));
    try {
      const cfg = editingConfigs[ai_type] || {};
      const payload = {
        provider: cfg.provider,
        api_base_url: cfg.api_base_url || null,
        api_key: cfg.api_key || null,
        api_model: cfg.api_model || null,
        local_model_path: cfg.local_model_path || null,
        use_custom_model: cfg.use_custom_model || false,
        custom_api_model: cfg.custom_api_model || null,
        timeout: cfg.timeout || 30
      };
      const res = await api.post(`/admin/ai-config/${ai_type}/test`, payload);
      setTestResults(prev => ({...prev, [ai_type]: res.data}));
    } catch (err: any) {
      setTestResults(prev => ({...prev, [ai_type]: {success: false, message: 'Không thể kết nối'}}));
    }
  };

  const handleSaveSafety = async () => {
    if (!editingSafety) return;
    setSavingSafety(true);
    try {
      await api.put('/admin/ai-config/safety', editingSafety);
      setSafetyConfig(editingSafety);
      alert('Đã lưu Safety Config thành công!');
    } catch (err) {
      alert('Lỗi khi lưu Safety Config');
    } finally {
      setSavingSafety(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-white">Quản lý Mô hình AI</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Đăng ký và giám sát danh sách mô hình LLMs hoạt động trên toàn hệ thống</p>
      </div>

      {/* Main Model Management Table */}
      <div className="bg-surface-1 border border-hairline rounded-3xl p-6">
        <ModelManagementTab />
      </div>

      {/* System/Embedding & Safety configurations */}
      <div className="border-t border-hairline pt-8 space-y-6">
        <div>
          <h4 className="text-sm font-bold text-white">⚙️ Cấu hình Hệ thống & Tham số An toàn (Phụ)</h4>
          <p className="text-xs text-ink-subtle mt-0.5">Các thiết lập nâng cao dành cho Vector Embedding và giới hạn an toàn toàn cục</p>
        </div>

        {loadingAI ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-brand-lavender" size={24} />
            <span className="text-xs text-ink-subtle">Đang tải cấu hình phụ...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Embedding Config Panel */}
            {(['embedding'] as const).map((ai_type) => {
              const cfg = editingConfigs[ai_type] || {};
              const testResult = testResults[ai_type];
              const providers = ['local', 'openrouter', 'openai', 'gemini', 'ollama'];
              return (
                <div key={ai_type} className="rounded-2xl border border-hairline bg-surface-1 p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-hairline">
                    <span className="text-xs font-bold text-white">📐 Mô hình Embedding (Số hóa tài liệu)</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-hairline bg-surface-2 text-ink-subtle">{ai_type.toUpperCase()}</span>
                  </div>

                  {/* Provider Selection */}
                  <div>
                    <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block mb-2">Provider</label>
                    <div className="flex flex-wrap gap-1.5">
                      {providers.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            const defaultUrls: Record<string, string> = {
                              openrouter: 'https://openrouter.ai/api/v1',
                              ollama: 'http://localhost:11434',
                              openai: 'https://api.openai.com/v1',
                              gemini: ''
                            };
                            setEditingConfigs(prev => ({
                              ...prev, 
                              [ai_type]: {
                                ...prev[ai_type], 
                                provider: p,
                                api_base_url: defaultUrls[p] || ''
                              }
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                            cfg.provider === p
                              ? 'bg-brand-lavender border-brand-lavender text-white'
                              : 'border-hairline text-ink-muted hover:border-brand-lavender/50 hover:text-ink'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API fields */}
                  {cfg.provider !== 'local' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block mb-1">
                          {cfg.provider === 'gemini' ? 'GCP Project ID' : 'API Base URL'}
                        </label>
                        <input
                          type="text"
                          value={cfg.api_base_url || ''}
                          onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], api_base_url: e.target.value}}))}
                          className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender"
                          placeholder={cfg.provider === 'gemini' ? 'gcp-project-123' : 'https://api.openai.com/v1'}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block mb-1">
                          {cfg.provider === 'gemini' ? 'Service Account Key (JSON)' : 'API Key'}
                        </label>
                        <input
                          type="password"
                          value={cfg.api_key || ''}
                          onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], api_key: e.target.value}}))}
                          className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender font-mono"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block mb-1">Model Name</label>
                        <input
                          type="text"
                          value={cfg.api_model || ''}
                          onChange={(e) => setEditingConfigs(prev => ({...prev, [ai_type]: {...prev[ai_type], api_model: e.target.value}}))}
                          className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender"
                          placeholder="text-embedding-3-small"
                        />
                      </div>
                    </div>
                  )}

                  {/* Test Results */}
                  {testResult !== undefined && testResult !== null && (
                    <div className={`p-2 rounded-lg border text-[11px] flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      <span>{testResult.success ? '✅' : '❌'}</span>
                      <span className="truncate">{testResult.message}</span>
                      {testResult.success && testResult.latency_ms && (
                        <span className="ml-auto font-mono text-[9px]">{testResult.latency_ms}ms</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleTestConnection(ai_type)}
                      className="px-3 py-1.5 border border-hairline hover:bg-surface-2 rounded-xl text-[10px] font-bold text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
                    >
                      🔌 Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveAIConfig(ai_type)}
                      disabled={savingAI === ai_type}
                      className="px-3 py-1.5 bg-brand-lavender hover:bg-brand-lavender/95 text-white rounded-xl text-[10px] font-bold transition-all disabled:opacity-50"
                    >
                      {savingAI === ai_type ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Safety Limits Panel */}
            {editingSafety && (
              <div className="rounded-2xl border border-hairline bg-surface-1 p-6 space-y-4">
                <div className="pb-3 border-b border-hairline">
                  <span className="text-xs font-bold text-white">⚠️ Safety Limits Toàn Hệ Thống</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Max Temperature</label>
                    <input
                      type="number" min={0.1} max={2} step={0.1}
                      value={editingSafety.max_temperature_limit}
                      onChange={(e) => setEditingSafety({...editingSafety, max_temperature_limit: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Max Tokens Limit</label>
                    <input
                      type="number" min={128} max={4096}
                      value={editingSafety.max_tokens_limit}
                      onChange={(e) => setEditingSafety({...editingSafety, max_tokens_limit: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Default Temperature</label>
                    <input
                      type="number" min={0} max={2} step={0.1}
                      value={editingSafety.default_temperature}
                      onChange={(e) => setEditingSafety({...editingSafety, default_temperature: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Default Style</label>
                    <select
                      value={editingSafety.default_response_style}
                      onChange={(e) => setEditingSafety({...editingSafety, default_response_style: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-xl outline-none text-xs text-ink focus:border-brand-lavender"
                    >
                      <option value="concise">Ngắn gọn</option>
                      <option value="detailed">Chi tiết</option>
                      <option value="technical">Kỹ thuật</option>
                    </select>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSafety}
                    disabled={savingSafety}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold transition-all disabled:opacity-50"
                  >
                    {savingSafety ? 'Đang lưu...' : '💾 Lưu Safety Config'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
