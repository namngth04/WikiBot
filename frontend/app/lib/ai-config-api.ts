import { api } from './api';

export interface AISafetyConfig {
  max_temperature_limit: number;
  max_context_length: number;
  max_tokens_limit: number;
  default_temperature: number;
  default_response_style: string;
}

export interface AIProviderConfig {
  ai_type: 'chat' | 'embedding' | 'faq';
  provider: 'local' | 'openrouter' | 'ollama';
  local_model_path?: string;
  local_context_length?: number;
  api_base_url?: string;
  api_key?: string;
  api_model?: string;
  embedding_model_name?: string;
  use_rag_provider?: boolean;
  default_temperature: number;
  default_max_tokens: number;
  timeout?: number;
}

export interface UserAISettings {
  temperature: number;
  response_style: 'concise' | 'normal' | 'detailed';
  show_sources: boolean;
  preferred_max_tokens: number;
}

// Admin APIs
export const adminAIAPI = {
  getSafetyConfig: () => api.get('/admin/ai-config/safety'),
  updateSafetyConfig: (data: AISafetyConfig) => api.put('/admin/ai-config/safety', data),
  getAllProviderConfigs: () => api.get('/admin/ai-config'),
  getProviderConfig: (aiType: string) => api.get(`/admin/ai-config/${aiType}`),
  updateProviderConfig: (aiType: string, data: AIProviderConfig) => 
    api.put(`/admin/ai-config/${aiType}`, data),
  testConnection: (aiType: string, data: any) => 
    api.post(`/admin/ai-config/${aiType}/test`, data),
  testConnectionAuto: (aiType: string) => 
    api.get(`/admin/ai-config/${aiType}/test-connection`),
  getAvailableModels: (provider: string, modelType?: string) => 
    api.get(`/admin/ai-config/models/${provider}${modelType ? `?model_type=${modelType}` : ''}`),
};

// Tenant AI APIs
export const tenantAIAPI = {
  getSettings: () => api.get('/admin/tenant/ai-settings'),
  updateSettings: (data: any) => api.put('/admin/tenant/ai-settings', data),
};


// User APIs
export const userAIAPI = {
  getSettings: () => api.get('/users/me/ai-settings'),
  updateSettings: (data: UserAISettings) => api.put('/users/me/ai-settings', data),
  getLimits: () => api.get('/users/me/ai-limits'),
};
