/**
 * Shared types for chat functionality
 * Single source of truth for all chat-related type definitions
 */

export interface ChatMessage {
  id: number | string;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  citations?: any[];
  confidence?: {
    overall: number;
    level: string;
    source_coverage?: number;
    semantic_similarity?: number;
    answer_completeness?: number;
    query_relevance?: number;
    source_quality?: number;
    language_confidence?: number;
    length_appropriateness?: number;
  };
  queryProcessing?: {
    original: string;
    corrected: string;
    expanded: string;
    was_corrected: boolean;
    was_expanded: boolean;
  };
  retrievalStats?: {
    query: string;
    vector_results: number;
    keyword_results: number;
    overlap: number;
    total_unique: number;
    overlap_percentage: number;
  };
  rating?: number | null;
  feedback?: 'up' | 'down' | null;
  status?: 'sending' | 'sent' | 'failed';
  error?: string;
  retryable?: boolean;
}

export interface ChatResponse {
  success: boolean;
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
  confidence: {
    overall: number;
    level: string;
    source_coverage?: number;
    semantic_similarity?: number;
    answer_completeness?: number;
    query_relevance?: number;
    source_quality?: number;
    language_confidence?: number;
    length_appropriateness?: number;
    [key: string]: any;
  };
  query_processing: {
    original: string;
    corrected: string;
    expanded: string;
    was_corrected: boolean;
    was_expanded: boolean;
  };
  retrieval_stats: {
    query: string;
    vector_results: number;
    keyword_results: number;
    overlap: number;
    total_unique: number;
    overlap_percentage: number;
  };
  user_message_id?: number;
  assistant_message_id?: number;
}

export type ResponseStyle = 'concise' | 'normal' | 'detailed' | 'creative';

export interface MessageRatingUpdate {
  rating: number;
}
