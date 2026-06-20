'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Key, Globe, Server, Cpu } from 'lucide-react';
import { ChatModelData } from '@/app/lib/ai-config-api';

interface ModelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ChatModelData) => Promise<void>;
  model: ChatModelData | null;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'ollama', name: 'Ollama (Local)' }
];

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: '',
  ollama: 'http://172.17.0.1:11434'
};

export default function ModelFormModal({ isOpen, onClose, onSave, model }: ModelFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ChatModelData>({
    name: '',
    provider: 'openai',
    api_base_url: 'https://api.openai.com/v1',
    api_key: '',
    api_model: '',
    is_active: false
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (model) {
      setFormData({
        name: model.name || '',
        provider: model.provider || 'openai',
        api_base_url: model.api_base_url || '',
        api_key: '', // Do not populate API Key for security, but allow modification if typed
        api_model: model.api_model || '',
        is_active: model.is_active ?? false
      });
    } else {
      setFormData({
        name: '',
        provider: 'openai',
        api_base_url: 'https://api.openai.com/v1',
        api_key: '',
        api_model: '',
        is_active: false
      });
    }
    setError(null);
  }, [model, isOpen]);

  if (!isOpen) return null;

  const handleProviderChange = (provider: string) => {
    setFormData(prev => ({
      ...prev,
      provider,
      api_base_url: DEFAULT_BASE_URLS[provider] || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên hiển thị của mô hình');
      return;
    }
    if (!formData.api_model.trim()) {
      setError('Vui lòng nhập Model ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Prepare payload: omit api_key if it's empty string during update
      const payload: ChatModelData = { ...formData };
      if (model && !formData.api_key?.trim()) {
        delete payload.api_key;
      }
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Đã xảy ra lỗi khi lưu cấu hình mô hình LLM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-1 dark:bg-zinc-900 border border-hairline w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <h3 className="text-lg font-bold text-ink flex items-center gap-2">
            <Cpu className="text-brand-lavender w-5 h-5" />
            {model ? 'Cập nhật cấu hình Mô hình' : 'Đăng ký Mô hình LLM mới'}
          </h3>
          <button 
            onClick={onClose} 
            className="text-ink-muted hover:text-ink hover:bg-surface-2 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Model Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink-muted flex items-center gap-1.5">
              Tên hiển thị mô hình <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ví dụ: OpenAI GPT-4o, Ollama Llama 3 Local..."
              className="linear-input bg-surface-2 w-full font-medium"
            />
          </div>

          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink-muted flex items-center gap-1.5">
              Nhà cung cấp (Provider) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-3 py-2.5 rounded-xl border font-medium text-sm transition-all text-left flex items-center justify-between ${
                    formData.provider === p.id
                      ? 'border-brand-lavender bg-brand-lavender/5 text-brand-lavender shadow-sm'
                      : 'border-hairline bg-surface-2 text-ink-muted hover:bg-surface-3'
                  }`}
                >
                  {p.name}
                  {formData.provider === p.id && (
                    <span className="w-2 h-2 rounded-full bg-brand-lavender"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* API Base URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink-muted flex items-center gap-1.5">
              <Globe size={14} className="text-ink-subtle" />
              {formData.provider === 'gemini' ? 'GCP Project ID (API Base URL)' : 'Base URL'}
            </label>
            <input
              type="text"
              value={formData.api_base_url || ''}
              onChange={e => setFormData({ ...formData, api_base_url: e.target.value })}
              placeholder={formData.provider === 'gemini' ? 'Nhập Project ID GCP (vd: my-gcp-project-123)' : 'https://api.openai.com/v1'}
              className="linear-input bg-surface-2 w-full font-mono text-sm"
            />
            {formData.provider === 'gemini' && (
              <p className="text-xs text-brand-lavender font-medium mt-1">
                Đối với Vertex AI, vui lòng nhập GCP Project ID vào đây.
              </p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink-muted flex items-center gap-1.5">
              <Key size={14} className="text-ink-subtle" />
              {formData.provider === 'gemini' ? 'JSON Key Service Account (API Key)' : 'API Key'}
            </label>
            <input
              type="password"
              value={formData.api_key || ''}
              onChange={e => setFormData({ ...formData, api_key: e.target.value })}
              placeholder={
                model && model.has_api_key 
                  ? '•••••••••••••••• (Nhập nếu muốn đổi khóa mới)' 
                  : (formData.provider === 'gemini' ? 'Dán toàn bộ nội dung file JSON Service Account' : 'sk-...')
              }
              className="linear-input bg-surface-2 w-full font-mono text-sm"
            />
          </div>

          {/* Model ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink-muted flex items-center gap-1.5">
              <Server size={14} className="text-ink-subtle" />
              Model ID gốc trên Provider <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.api_model}
              onChange={e => setFormData({ ...formData, api_model: e.target.value })}
              placeholder="Ví dụ: gpt-4o, qwen2.5:3b, gemini-1.5-flash"
              className="linear-input bg-surface-2 w-full font-mono text-sm"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-hairline bg-surface-2 dark:bg-zinc-950 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2 px-4 border border-hairline text-sm"
            disabled={loading}
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 bg-brand-lavender text-white px-5 py-2 rounded-xl hover:bg-brand-lavender-hover disabled:opacity-50 transition-all font-bold text-sm shadow-md"
          >
            <Save size={16} />
            {loading ? 'Đang xử lý...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>
  );
}
