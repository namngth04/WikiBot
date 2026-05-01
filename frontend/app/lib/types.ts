export interface Role {
  id: number;
  name: string;
  description: string | null;
  level: number;
  parent_role_id: number | null;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  role_id: number | null;
  is_active: boolean;
  created_at: string;
  role?: Role;
}

export interface Document {
  id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  role_id: number | null;
  uploaded_by: number;
  uploaded_at: string;
  chunk_count: number;
  is_active: boolean;
  role?: Role;
  uploaded_by_user?: User;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  rating?: number | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  messages?: Message[];
}

export interface ChatResponse {
  response: string;
  answer: string;
  conversation_id: number;
  sources: Array<{
    source: string;
    chunk_index: number;
    distance: number;
  }>;
  citations: Array<{
    source: string;
    chunk_index: number;
    distance: number;
  }>;
  user_message_id?: number;
  assistant_message_id?: number;
}
