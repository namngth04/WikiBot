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


export interface DashboardStats {
  total_users: number;
  total_messages: number;
  total_documents: number;
  satisfaction_rate: number;
  rating_details: {
    likes: number;
    dislikes: number;
    total_rated: number;
  };
  feedback_ratio: {
    like: number;
    dislike: number;
    none: number;
  };
  // Trend fields (so với ngày hôm qua)
  user_trend?: number | null;
  message_trend?: number | null;
  document_trend?: number | null;
  rating_trend?: number | null;
}

export interface UsageStats {
  date: string;
  count: number;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string | null;
  hits: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SuggestedFAQ {
  question: string;
  occurrence: number;
  suggested_answer?: string;
}

// Filter System Types
export interface FilterState {
  search: string;
  selectedRoles: string[];
  selectedStatus: string[];
  selectedLevels: string[];
  selectedAccess: string[];
  selectedFormats: string[];
  selectedSizes: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterSection {
  title: string;
  type: 'checkbox' | 'radio' | 'date' | 'select';
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  key: string;
}

export interface SortOption {
  value: string;
  label: string;
}
