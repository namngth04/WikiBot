import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
};

// Users API
export const usersAPI = {
  list: () => api.get('/users/'),
  create: (data: any) => api.post('/users/', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  updateMe: (data: any) => api.put('/users/me', data),
};

// Roles API
export const rolesAPI = {
  list: () => api.get('/roles/'),
  create: (data: any) => api.post('/roles/', data),
  update: (id: number, data: any) => api.put(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
};

// Documents API
export const documentsAPI = {
  list: () => api.get('/documents/'),
  upload: (file: File, roleId?: number | null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (roleId !== undefined && roleId !== null) {
      formData.append('role_id', roleId.toString());
    }
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateDocument: (id: number, data: { role_id?: number | null; original_name?: string }) =>
    api.put(`/documents/${id}`, data),
  delete: (id: number) => api.delete(`/documents/${id}`),
};

// Chat API
export type ResponseStyle = 'concise' | 'normal' | 'detailed';

export const chatAPI = {
  listConversations: () => api.get('/chat/conversations'),
  createConversation: () => api.post('/chat/conversations', { title: 'Cuộc trò chuyện mới' }),
  deleteConversation: (id: number) => api.delete(`/chat/conversations/${id}`),
  updateConversation: (id: number, title: string) =>
    api.put(`/chat/conversations/${id}`, { title }),
  getConversation: (id: number) => api.get(`/chat/conversations/${id}`),
  rateMessage: (messageId: number, rating: number) =>
    api.put(`/chat/messages/${messageId}/rating`, { rating }),
  sendMessage: (
    message: string,
    conversationId?: number,
    options?: {
      responseStyle?: ResponseStyle;
      maxTokens?: number;
      showSources?: boolean;
    }
  ) =>
    api.post('/chat/send', {
      message,
      conversation_id: conversationId,
      response_style: options?.responseStyle ?? 'concise',
      max_tokens: options?.maxTokens,
      show_sources: options?.showSources ?? true,
    }),
};

// Admin API
export const adminAPI = {
  getOverview: () => api.get('/admin/stats/overview'),
  getUsage: (days: number = 7) => api.get(`/admin/stats/usage?days=${days}`),
  
  // FAQ Management
  listFAQs: (search?: string, skip: number = 0, limit: number = 100) =>
    api.get('/admin/faqs', { params: { search, skip, limit } }),
  createFAQ: (data: any) => api.post('/admin/faqs', data),
  updateFAQ: (id: number, data: any) => api.put(`/admin/faqs/${id}`, data),
  deleteFAQ: (id: number) => api.delete(`/admin/faqs/${id}`),
  
  // Suggested FAQs
  getSuggestedFAQs: () => api.get('/admin/faqs/suggested'),
  refreshSuggestedFAQs: () => api.post('/admin/faqs/suggested/refresh'),
  generateDraft: (question: string) => api.post(`/admin/faqs/generate-draft?question=${encodeURIComponent(question)}`),
};
