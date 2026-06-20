'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Settings, Server, Key, Brain, Layers, Shield,
  CheckCircle, AlertCircle, Save, TestTube, Eye, MessageCircle, Cpu
} from 'lucide-react';
import { adminAIAPI, tenantAIAPI } from '@/app/lib/ai-config-api';
import { useAuth } from '@/app/context/auth-context';
import ModelManagementTab from '@/components/admin/ModelManagementTab';

export default function AdminAIConfigPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isCompanyAdmin = user?.role?.level === 1;

  useEffect(() => {
    if (isCompanyAdmin) {
      router.replace('/admin/dashboard');
    }
  }, [isCompanyAdmin, router]);
  
  const [activeTab, setActiveTab] = useState<'safety' | 'chat' | 'embedding' | 'overview' | 'models'>('overview');
  const [activeCompanyTab, setActiveCompanyTab] = useState<'settings' | 'models'>('settings');
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tenant AI Settings (for Company Admin)
  const [tenantSettings, setTenantSettings] = useState({
    temperature: 0.2,
    response_style: 'concise',
    show_sources: true,
    preferred_max_tokens: 512,
    ollama_endpoint: 'http://localhost:11434',
  });

  const DEFAULT_BASE_URLS = {
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: 'http://localhost:11434',
    openai: 'https://api.openai.com/v1',
    gemini: ''
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
    if (isCompanyAdmin) {
      loadTenantSettings();
    } else {
      loadConfigs();
    }
  }, [isCompanyAdmin]);

  const loadTenantSettings = async () => {
    setLoading(true);
    try {
      const response = await tenantAIAPI.getSettings();
      setTenantSettings(response.data);
    } catch (err) {
      console.error('Failed to load tenant settings:', err);
    }
    setLoading(false);
  };

  const handleSaveTenantSettings = async () => {
    setLoading(true);
    try {
      await tenantAIAPI.updateSettings(tenantSettings);
      showMessage('success', 'Đã lưu cấu hình cá nhân hóa trợ lý của Doanh nghiệp thành công!');
    } catch (err: any) {
      showMessage('error', err.response?.data?.detail || 'Lỗi khi lưu cấu hình');
    }
    setLoading(false);
  };


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

  if (isCompanyAdmin) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-ink flex items-center gap-3">
            <Brain className="text-brand-lavender w-8 h-8" />
            Cá nhân hóa trợ lý Doanh nghiệp
          </h1>
          <p className="text-ink-subtle">Cấu hình các tham số cá nhân hóa và mô hình AI mặc định dùng chung cho toàn bộ nhân viên trong công ty.</p>
        </div>

        <div className="bg-surface-1 rounded-2xl p-8 border border-hairline shadow-sm space-y-6">
          <h2 className="text-xl font-semibold text-ink flex items-center gap-2 border-b border-hairline pb-4">
            <Settings className="text-brand-lavender" />
            Tham số AI & Trợ lý RAG
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-ink-muted">Độ sáng tạo (Temperature)</label>
                <span className="text-xs font-mono font-bold text-brand-lavender bg-brand-lavender/10 border border-brand-lavender/25 px-2 py-0.5 rounded">{tenantSettings.temperature}</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="1.5" 
                step="0.1"
                value={tenantSettings.temperature} 
                onChange={(e) => setTenantSettings({ ...tenantSettings, temperature: parseFloat(e.target.value) })} 
                className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-brand-lavender" 
              />
              <p className="text-xs text-ink-subtle">Giá trị càng thấp, câu trả lời RAG càng chính xác và nhất quán. Giá trị cao giúp bot đa dạng hóa câu trả lời.</p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Độ dài câu trả lời mặc định (Max Tokens)</label>
              <select
                value={tenantSettings.preferred_max_tokens}
                onChange={(e) => setTenantSettings({ ...tenantSettings, preferred_max_tokens: parseInt(e.target.value) })}
                className="linear-input bg-surface-2 w-full"
              >
                <option value="256">Ngắn gọn (256 tokens)</option>
                <option value="512">Trung bình (512 tokens)</option>
                <option value="1024">Dài (1024 tokens)</option>
                <option value="2048">Rất dài (2048 tokens)</option>
              </select>
            </div>

            {/* Response Style */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Phong cách phản hồi mặc định</label>
              <select
                value={tenantSettings.response_style}
                onChange={(e) => setTenantSettings({ ...tenantSettings, response_style: e.target.value })}
                className="linear-input bg-surface-2 w-full"
              >
                <option value="concise">Tóm tắt ngắn gọn</option>
                <option value="normal">Bình thường đầy đủ</option>
                <option value="detailed">Chi tiết từng bước</option>
              </select>
            </div>

            {/* Show Sources */}
            <div className="space-y-2 flex flex-col justify-center">
              <div className="flex items-center justify-between p-3.5 bg-surface-2 border border-hairline rounded-xl">
                <div>
                  <span className="text-sm font-medium text-ink block">Hiển thị nguồn trích dẫn</span>
                  <span className="text-xs text-ink-subtle">Trích dẫn tài liệu nội bộ gốc dưới mỗi câu trả lời</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={tenantSettings.show_sources} 
                  onChange={(e) => setTenantSettings({ ...tenantSettings, show_sources: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-lavender focus:ring-brand-lavender cursor-pointer"
                />
              </div>
            </div>

            {/* Ollama Endpoint */}
            <div className="space-y-2 col-span-1 md:col-span-2 border-t border-hairline pt-4">
              <label className="text-sm font-medium text-ink-muted block">Máy chủ Ollama Local của Công ty (Company Ollama Server)</label>
              <input 
                type="text" 
                value={tenantSettings.ollama_endpoint} 
                onChange={(e) => setTenantSettings({ ...tenantSettings, ollama_endpoint: e.target.value })} 
                className="linear-input bg-surface-2 w-full font-mono"
                placeholder="http://192.168.1.100:11434"
              />
              <p className="text-xs text-ink-subtle">Cấu hình địa chỉ IP máy chủ Ollama chạy cục bộ trong mạng nội bộ của công ty để đảm bảo dữ liệu không rời khỏi hạ tầng doanh nghiệp.</p>
            </div>

          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveTenantSettings}
              disabled={loading}
              className="flex items-center gap-2 bg-brand-lavender text-white px-6 py-2.5 rounded-xl hover:bg-brand-lavender-hover disabled:opacity-50 transition-all font-bold shadow-md shadow-brand-lavender/10"
            >
              <Save size={18} />
              {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>

        {/* Toast Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Cá nhân hóa trợ lý Hệ thống</h1>
          <p className="text-ink-subtle">Quản lý model, provider và giới hạn cho Chat, Embedding</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-hairline">
        {[
          { id: 'overview', label: 'Tổng quan', icon: Eye },
          { id: 'models', label: 'Mô hình LLM', icon: Cpu },
          { id: 'safety', label: 'Giới hạn an toàn', icon: Shield },
          { id: 'chat', label: 'Chat AI', icon: Brain },
          { id: 'embedding', label: 'Embedding AI', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${activeTab === tab.id
              ? 'text-brand-lavender border-b-2 border-brand-lavender'
              : 'text-ink-subtle hover:text-ink'
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

      {/* Models Tab */}
      {activeTab === 'models' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <ModelManagementTab />
        </motion.div>
      )}

      {/* Safety Tab */}
      {activeTab === 'safety' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-1 rounded-2xl p-6 border border-hairline shadow-sm"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-ink">
            <Shield className="text-brand-lavender" />
            Giới hạn an toàn toàn hệ thống
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Max Temperature Limit</label>
              <input
                type="number"
                step="0.1"
                value={safetyConfig.max_temperature_limit || 1.0}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, max_temperature_limit: parseFloat(e.target.value) || 1.0 })}
                className="linear-input bg-surface-2 w-full"
              />
              <p className="text-xs text-ink-subtle">Giới hạn trên cho temperature (0.1 - 2.0)</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Max Context Length</label>
              <input
                type="number"
                step="1024"
                value={safetyConfig.max_context_length || 8192}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, max_context_length: parseInt(e.target.value) || 8192 })}
                className="linear-input bg-surface-2 w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Max Tokens Limit</label>
              <input
                type="number"
                value={safetyConfig.max_tokens_limit || 2048}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, max_tokens_limit: parseInt(e.target.value) || 2048 })}
                className="linear-input bg-surface-2 w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Default Response Style</label>
              <select
                value={safetyConfig.default_response_style}
                onChange={(e) => setSafetyConfig({ ...safetyConfig, default_response_style: e.target.value })}
                className="linear-input bg-surface-2 w-full"
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
              className="btn-primary bg-brand-lavender hover:bg-brand-lavender-hover"
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
          className="bg-surface-1 rounded-2xl p-6 border border-hairline shadow-sm"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-ink">
            <Brain className="text-brand-lavender" />
            Cấu hình Chat AI
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Provider</label>
              <div className="flex gap-2">
                {['openrouter', 'openai', 'ollama', 'gemini'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      const newBaseUrl = DEFAULT_BASE_URLS[p as keyof typeof DEFAULT_BASE_URLS] || '';
                      setChatConfig({ 
                        ...chatConfig, 
                        provider: p,
                        api_base_url: newBaseUrl
                      });
                      loadModels(p);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${chatConfig.provider === p
                      ? 'bg-brand-lavender text-white'
                      : 'bg-surface-2 text-ink-muted border border-hairline hover:bg-surface-3'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-muted">
                  {chatConfig.provider === 'gemini' ? 'GCP Project ID (Base URL)' : 'Base URL'}
                </label>
                <input
                  type="text"
                  value={chatConfig.api_base_url || ''}
                  onChange={(e) => setChatConfig({ ...chatConfig, api_base_url: e.target.value })}
                  className="linear-input bg-surface-2 w-full"
                  placeholder={chatConfig.provider === 'gemini' ? 'Nhập Project ID GCP của bạn (vd: my-gcp-project-123)' : 'https://openrouter.ai/api/v1'}
                />
                {chatConfig.provider === 'gemini' && (
                  <p className="text-xs text-brand-lavender font-medium">
                    Đối với Vertex AI, vui lòng nhập GCP Project ID vào ô Base URL này.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-muted">
                  {chatConfig.provider === 'gemini' ? 'JSON Key Service Account (API Key)' : 'API Key'}
                </label>
                <input
                  type="password"
                  value={chatConfig.api_key || ''}
                  onChange={(e) => setChatConfig({ ...chatConfig, api_key: e.target.value })}
                  className="linear-input bg-surface-2 w-full font-mono text-xs"
                  placeholder={chatConfig.provider === 'gemini' ? 'Dán toàn bộ nội dung file JSON Service Account Key tại đây' : 'sk-...'}
                />
                {chatConfig.provider === 'gemini' && (
                  <p className="text-xs text-brand-lavender font-medium">
                    Dán toàn bộ nội dung của tệp tin JSON Service Account được cấp quyền Vertex AI User.
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-ink-muted">Model Selection</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-ink-muted">
                    <input
                      type="radio"
                      name="chatModelType"
                      checked={!chatConfig.use_custom_model}
                      onChange={() => setChatConfig({ ...chatConfig, use_custom_model: false })}
                      className="w-4 h-4 text-brand-lavender focus:ring-brand-lavender"
                    />
                    <span className="text-sm">Chọn từ danh sách</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-ink-muted">
                    <input
                      type="radio"
                      name="chatModelType"
                      checked={chatConfig.use_custom_model}
                      onChange={() => setChatConfig({ ...chatConfig, use_custom_model: true })}
                      className="w-4 h-4 text-brand-lavender focus:ring-brand-lavender"
                    />
                    <span className="text-sm">Nhập model ID tùy chỉnh</span>
                  </label>
                </div>

                {!chatConfig.use_custom_model ? (
                  <select
                    value={chatConfig.api_model || ''}
                    onChange={(e) => setChatConfig({ ...chatConfig, api_model: e.target.value })}
                    className="linear-input bg-surface-2 w-full"
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
                    className="linear-input bg-surface-2 w-full font-mono"
                    placeholder="Nhập model ID (vd: google/gemini-1.5-flash, anthropic/claude-3-haiku-20240307)"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => handleTestConnection('chat', chatConfig)}
              disabled={testingConnection}
              className="btn-secondary py-2 px-6"
            >
              <TestTube size={18} />
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={() => handleSaveProvider('chat', chatConfig)}
              disabled={loading}
              className="btn-primary bg-brand-lavender hover:bg-brand-lavender-hover px-6"
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
          className="bg-surface-1 rounded-2xl p-6 border border-hairline shadow-sm"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-ink">
            <Layers className="text-brand-lavender" />
            Cấu hình Embedding AI
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Provider</label>
              <div className="flex gap-2">
                {['local', 'openrouter', 'openai', 'gemini', 'ollama'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      const newBaseUrl = DEFAULT_BASE_URLS[p as keyof typeof DEFAULT_BASE_URLS] || '';
                      setEmbeddingConfig({ 
                        ...embeddingConfig, 
                        provider: p,
                        api_base_url: newBaseUrl
                      });
                      if (p !== 'local') {
                        loadModels(p, 'embedding');
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${embeddingConfig.provider === p
                      ? 'bg-brand-lavender text-white'
                      : 'bg-surface-2 text-ink-muted border border-hairline hover:bg-surface-3'
                      }`}
                  >
                    {p === 'local' ? 'SentenceTransformer' : p === 'openrouter' ? 'OpenRouter' : p === 'openai' ? 'OpenAI' : p === 'gemini' ? 'Gemini' : 'Ollama'}
                  </button>
                ))}
              </div>
            </div>

            {embeddingConfig.provider === 'local' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink-muted">Model Name</label>
                <input
                  type="text"
                  value={embeddingConfig.embedding_model_name || ''}
                  onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, embedding_model_name: e.target.value })}
                  className="linear-input bg-surface-2 w-full"
                />
                <p className="text-xs text-ink-subtle">Mặc định: paraphrase-multilingual-MiniLM-L12-v2</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink-muted">
                    {embeddingConfig.provider === 'gemini' ? 'GCP Project ID (Base URL)' : 'Base URL'}
                  </label>
                  <input
                    type="text"
                    value={embeddingConfig.api_base_url || ''}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, api_base_url: e.target.value })}
                    className="linear-input bg-surface-2 w-full"
                    placeholder={embeddingConfig.provider === 'gemini' ? 'Nhập Project ID GCP của bạn (vd: my-gcp-project-123)' : 'https://api.openai.com/v1'}
                  />
                  {embeddingConfig.provider === 'gemini' && (
                    <p className="text-xs text-brand-lavender font-medium">
                      Đối với Vertex AI, vui lòng nhập GCP Project ID vào ô Base URL này.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink-muted">
                    {embeddingConfig.provider === 'gemini' ? 'JSON Key Service Account (API Key)' : 'API Key'}
                  </label>
                  <input
                    type="password"
                    value={embeddingConfig.api_key || ''}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, api_key: e.target.value })}
                    className="linear-input bg-surface-2 w-full font-mono text-xs"
                    placeholder={embeddingConfig.provider === 'gemini' ? 'Dán toàn bộ nội dung file JSON Service Account Key tại đây' : 'sk-...'}
                  />
                  {embeddingConfig.provider === 'gemini' && (
                    <p className="text-xs text-brand-lavender font-medium">
                      Dán toàn bộ nội dung của tệp tin JSON Service Account được cấp quyền Vertex AI User.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink-muted">Embedding Model</label>
                  <input
                    type="text"
                    value={embeddingConfig.api_model || ''}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, api_model: e.target.value })}
                    className="linear-input bg-surface-2 w-full"
                    placeholder={embeddingConfig.provider === 'gemini' ? 'multimodalembedding@001' : 'text-embedding-3-small'}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => handleTestConnection('embedding', embeddingConfig)}
              disabled={testingConnection}
              className="btn-secondary py-2 px-6"
            >
              <TestTube size={18} />
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={() => handleSaveProvider('embedding', embeddingConfig)}
              disabled={loading}
              className="btn-primary bg-brand-lavender hover:bg-brand-lavender-hover px-6"
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
