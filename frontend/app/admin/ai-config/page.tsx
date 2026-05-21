'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Server, Key, Brain, Layers, Shield,
  CheckCircle, AlertCircle, Save, TestTube, Eye, MessageCircle
} from 'lucide-react';
import { adminAIAPI } from '@/app/lib/ai-config-api';

export default function AdminAIConfigPage() {
  const [activeTab, setActiveTab] = useState<'safety' | 'chat' | 'embedding' | 'overview'>('safety');
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Default base URLs for providers
  const DEFAULT_BASE_URLS = {
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: 'http://localhost:11434',
    openai: 'https://api.openai.com/v1'
  };

  // Safety Config
  const [safetyConfig, setSafetyConfig] = useState({
    max_temperature_limit: 1.0,
    max_context_length: 8192,
    max_tokens_limit: 2048,
    default_temperature: 0.2,
    default_response_style: 'concise'
  });

  // Provider Configs
  const [chatConfig, setChatConfig] = useState({
    provider: 'local',
    local_model_path: './llm_models/qwen2.5-3b-instruct-q4_k_m.gguf',
    local_context_length: 4096,
    api_base_url: '',
    api_key: '',
    api_model: '',
    use_custom_model: false,
    custom_api_model: '',
    default_temperature: 0.3,
    default_max_tokens: 512,
    timeout: 30
  });

  const [embeddingConfig, setEmbeddingConfig] = useState({
    provider: 'local',
    embedding_model_name: 'paraphrase-multilingual-MiniLM-L12-v2',
    api_base_url: '',
    api_key: '',
    api_model: '',
    timeout: 30
  });


  const [availableModels, setAvailableModels] = useState<any[]>([]);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const safety = await adminAIAPI.getSafetyConfig();
      setSafetyConfig(safety.data);

      const providers = await adminAIAPI.getAllProviderConfigs();
      providers.data.forEach((p: any) => {
        if (p.ai_type === 'chat' || p.ai_type === 'rag') setChatConfig(p);
        if (p.ai_type === 'embedding') setEmbeddingConfig(p);
      });
    } catch (err) {
      console.error('Failed to load configs:', err);
    }
  };

  const handleSaveSafety = async () => {
    setLoading(true);
    try {
      await adminAIAPI.updateSafetyConfig(safetyConfig);
      showMessage('success', 'Đã lưu cấu hình an toàn');
    } catch (err) {
      showMessage('error', 'Lỗi khi lưu cấu hình');
    }
    setLoading(false);
  };

  const handleSaveProvider = async (aiType: string, config: any) => {
    setLoading(true);
    try {
      await adminAIAPI.updateProviderConfig(aiType, config);
      showMessage('success', `Đã lưu cấu hình ${aiType.toUpperCase()}`);
    } catch (err) {
      showMessage('error', 'Lỗi khi lưu cấu hình');
    }
    setLoading(false);
  };

  const handleTestConnection = async (aiType: string, config: any) => {
    console.log('Testing connection for:', aiType, config);
    setTestingConnection(true);
    try {
      // Prepare test config with correct model field
      const testConfig = { ...config };
      
      // For API providers, ensure we send the correct model field
      if (config.provider !== 'local') {
        // If using custom model, use custom_api_model as api_model
        if (config.use_custom_model && config.custom_api_model) {
          testConfig.api_model = config.custom_api_model;
        }
        // If not using custom model but api_model is empty, set it to custom_api_model as fallback
        else if (!config.api_model && config.custom_api_model) {
          testConfig.api_model = config.custom_api_model;
        }
        // Special handling for FAQ - if use_rag_provider is true, don't need model
        else if (config.use_rag_provider) {
          // Model will be taken from RAG config
        }
      }
      
      console.log('Final test config:', testConfig);
      const result = await adminAIAPI.testConnection(aiType, testConfig);
      console.log('Test result:', result);
      if (result.data.success) {
        showMessage('success', `Kết nối thành công! ${result.data.latency_ms?.toFixed(0)}ms`);
      } else {
        showMessage('error', result.data.message);
      }
    } catch (err: any) {
      console.error('Test connection error:', err);
      showMessage('error', err.response?.data?.detail || 'Lỗi kết nối');
    }
    setTestingConnection(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadModels = async (provider: string, modelType?: string) => {
    const url = modelType ? `/admin/ai-config/models/${provider}?model_type=${modelType}` : `/admin/ai-config/models/${provider}`;
    const result = await adminAIAPI.getAvailableModels(provider, modelType);
    setAvailableModels(result.data.models || []);
  };

  // Overview Tab Component
  const OverviewTab = () => {
    const getConfigDisplay = (config: any, aiType: string) => {
      if (!config) return { status: 'Chưa cấu hình', provider: '-', model: '-' };
      
      let providerDisplay = config.provider;
      let modelDisplay = '-';
      
      if (config.provider === 'local') {
        modelDisplay = config.local_model_path?.split('/').pop() || '-';
      } else {
        modelDisplay = config.use_custom_model ? config.custom_api_model : config.api_model;
      }
      
      return {
        status: config.api_key || config.has_api_key || config.local_model_path ? 'Đã cấu hình' : 'Chưa cấu hình',
        provider: providerDisplay,
        model: modelDisplay
      };
    };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* RAG Config Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Brain className="w-6 h-6 text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold">Chat AI</h3>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500">Provider:</span>
              <p className="font-medium">{getConfigDisplay(chatConfig, 'chat').provider}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Model:</span>
              <p className="font-medium">{getConfigDisplay(chatConfig, 'chat').model}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Trạng thái:</span>
              <p className={`font-medium ${
                getConfigDisplay(chatConfig, 'chat').status === 'Đã cấu hình' 
                  ? 'text-green-600' 
                  : 'text-orange-600'
              }`}>
                {getConfigDisplay(chatConfig, 'chat').status}
              </p>
            </div>
          </div>
        </div>
        
        {/* Embedding Config Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Layers className="w-6 h-6 text-green-500 mr-2" />
            <h3 className="text-lg font-semibold">Embedding</h3>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500">Provider:</span>
              <p className="font-medium">{getConfigDisplay(embeddingConfig, 'embedding').provider}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Model:</span>
              <p className="font-medium">
                {embeddingConfig.provider === 'local' 
                  ? embeddingConfig.embedding_model_name || '-'
                  : getConfigDisplay(embeddingConfig, 'embedding').model
                }
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Trạng thái:</span>
              <p className={`font-medium ${
                getConfigDisplay(embeddingConfig, 'embedding').status === 'Đã cấu hình' 
                  ? 'text-green-600' 
                  : 'text-orange-600'
              }`}>
                {getConfigDisplay(embeddingConfig, 'embedding').status}
              </p>
            </div>
          </div>
        </div>
        
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cấu hình AI Hệ thống</h1>
          <p className="text-slate-500">Quản lý model, provider và giới hạn cho Chat, Embedding</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Tổng quan', icon: Eye },
          { id: 'safety', label: 'Giới hạn an toàn', icon: Shield },
          { id: 'chat', label: 'Chat AI', icon: Brain },
          { id: 'embedding', label: 'Embedding AI', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${activeTab === tab.id
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <OverviewTab />
        </motion.div>
      )}

      {/* Safety Tab */}
      {activeTab === 'safety' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Shield className="text-primary-600" />
            Giới hạn an toàn toàn hệ thống
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Max Temperature Limit</label>
              <input
                type="number"
                step="0.1"
                value={safetyConfig.max_temperature_limit || 1.0}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, max_temperature_limit: parseFloat(e.target.value) || 1.0 })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-slate-400">Giới hạn trên cho temperature (0.1 - 2.0)</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Max Context Length</label>
              <input
                type="number"
                step="1024"
                value={safetyConfig.max_context_length || 8192}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, max_context_length: parseInt(e.target.value) || 8192 })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Max Tokens Limit</label>
              <input
                type="number"
                value={safetyConfig.max_tokens_limit || 2048}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, max_tokens_limit: parseInt(e.target.value) || 2048 })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Default Response Style</label>
              <select
                value={safetyConfig.default_response_style}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, default_response_style: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="concise">Ngắn gọn</option>
                <option value="normal">Bình thường</option>
                <option value="detailed">Chi tiết</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveSafety}
              disabled={loading}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Brain className="text-primary-600" />
            Cấu hình Chat AI
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Provider</label>
              <div className="flex gap-2">
                {['local', 'openrouter', 'ollama'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      // Auto-fill base URL when switching providers
                      const newBaseUrl = DEFAULT_BASE_URLS[p as keyof typeof DEFAULT_BASE_URLS];
                      const shouldAutoFill = !chatConfig.api_base_url || 
                        chatConfig.api_base_url === DEFAULT_BASE_URLS[chatConfig.provider as keyof typeof DEFAULT_BASE_URLS];
                      
                      setChatConfig({ 
                        ...chatConfig, 
                        provider: p,
                        ...(shouldAutoFill && newBaseUrl ? { api_base_url: newBaseUrl } : {})
                      });
                      if (p !== 'local') {
                        loadModels(p);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${chatConfig.provider === p
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {p === 'local' ? 'Local GGUF' : p}
                  </button>
                ))}
              </div>
            </div>

            {chatConfig.provider === 'local' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Model Path</label>
                  <input
                    type="text"
                    value={chatConfig.local_model_path}
                    onChange={(e) => setChatConfig({ ...chatConfig, local_model_path: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="./llm_models/model.gguf"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Context Length</label>
                  <select
                    value={chatConfig.local_context_length || 4096}
                    onChange={(e) => setChatConfig({ ...chatConfig, local_context_length: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value={2048}>2048</option>
                    <option value={4096}>4096</option>
                    <option value={8192}>8192</option>
                    <option value={16384}>16384</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Base URL</label>
                  <input
                    type="text"
                    value={chatConfig.api_base_url || ''}
                    onChange={(e) => setChatConfig({ ...chatConfig, api_base_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">API Key</label>
                  <input
                    type="password"
                    value={chatConfig.api_key || ''}
                    onChange={(e) => setChatConfig({ ...chatConfig, api_key: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="sk-..."
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-600">Model Selection</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chatModelType"
                        checked={!chatConfig.use_custom_model}
                        onChange={() => setChatConfig({ ...chatConfig, use_custom_model: false })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Chọn từ danh sách</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chatModelType"
                        checked={chatConfig.use_custom_model}
                        onChange={() => setChatConfig({ ...chatConfig, use_custom_model: true })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Nhập model ID tùy chỉnh</span>
                    </label>
                  </div>

                  {!chatConfig.use_custom_model ? (
                    <select
                      value={chatConfig.api_model || ''}
                      onChange={(e) => setChatConfig({ ...chatConfig, api_model: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Chọn model...</option>
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={chatConfig.custom_api_model || ''}
                      onChange={(e) => setChatConfig({ ...chatConfig, custom_api_model: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Nhập model ID (vd: google/gemini-1.5-flash, anthropic/claude-3-haiku-20240307)"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => handleTestConnection('chat', chatConfig)}
              disabled={testingConnection}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              <TestTube size={18} />
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={() => handleSaveProvider('chat', chatConfig)}
              disabled={loading}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Embedding Tab */}
      {activeTab === 'embedding' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Layers className="text-primary-600" />
            Cấu hình Embedding AI
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Provider</label>
              <div className="flex gap-2">
                {['local', 'openrouter', 'openai'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      // Auto-fill base URL when switching providers
                      const newBaseUrl = DEFAULT_BASE_URLS[p as keyof typeof DEFAULT_BASE_URLS];
                      const shouldAutoFill = !embeddingConfig.api_base_url || 
                        embeddingConfig.api_base_url === DEFAULT_BASE_URLS[embeddingConfig.provider as keyof typeof DEFAULT_BASE_URLS];
                      
                      setEmbeddingConfig({ 
                        ...embeddingConfig, 
                        provider: p,
                        ...(shouldAutoFill && newBaseUrl ? { api_base_url: newBaseUrl } : {})
                      });
                      if (p !== 'local') {
                        loadModels(p, 'embedding');
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${embeddingConfig.provider === p
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {p === 'local' ? 'SentenceTransformer' : p === 'openrouter' ? 'OpenRouter' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            {embeddingConfig.provider === 'local' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Model Name</label>
                <input
                  type="text"
                  value={embeddingConfig.embedding_model_name || ''}
                  onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, embedding_model_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-slate-400">Mặc định: paraphrase-multilingual-MiniLM-L12-v2</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Base URL</label>
                  <input
                    type="text"
                    value={embeddingConfig.api_base_url || ''}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, api_base_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">API Key</label>
                  <input
                    type="password"
                    value={embeddingConfig.api_key || ''}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, api_key: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Embedding Model</label>
                  <input
                    type="text"
                    value={embeddingConfig.api_model || ''}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, api_model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="text-embedding-3-small"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => handleTestConnection('embedding', embeddingConfig)}
              disabled={testingConnection}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              <TestTube size={18} />
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={() => handleSaveProvider('embedding', embeddingConfig)}
              disabled={loading}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </motion.div>
      )}


      {/* Toast Message - Fixed at bottom, always visible */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 px-6 py-3 rounded-lg shadow-lg border ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium">{message.text}</span>
        </motion.div>
      )}
    </div>
  );
}
