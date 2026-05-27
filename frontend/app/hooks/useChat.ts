'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatAPI, ResponseStyle } from '@/app/lib/api';
import { Conversation, Message } from '@/app/lib/types';
import { ChatResponse } from '@/app/types/chat';
import { ChatMessage } from '@/app/types/chat';

// Utility function for generating unique temp IDs
const generateTempId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback cho old browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

interface UseChatOptions {
  onNewConversation?: (conversation: Conversation) => void;
  onError?: (error: Error) => void;
}

export const useChat = (options: UseChatOptions = {}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('concise');
  const [showSources, setShowSources] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingMessageId, setRatingMessageId] = useState<number | null>(null);
  const [quotaReached, setQuotaReached] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const response = await chatAPI.listConversations();
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      options.onError?.(error as Error);
    }
  }, []);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      const response = await chatAPI.getConversation(conversationId);
      setMessages((response.data.messages || []) as ChatMessage[]);
    } catch (error) {
      console.error('Failed to load messages:', error);
      options.onError?.(error as Error);
    }
  }, []);

  // Create new conversation
  const createNewConversation = useCallback(async () => {
    try {
      const response = await chatAPI.createConversation();
      const newConversation = response.data;
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setMessages([]);
      options.onNewConversation?.(newConversation);
      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }, []);

  // Select conversation
  const selectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
    loadMessages(conversation.id);
  }, [loadMessages]);

  // Delete conversation
  const deleteConversation = useCallback(async (id: number) => {
    try {
      await chatAPI.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }, [currentConversation]);

  // Update conversation title
  const updateConversationTitle = useCallback(async (id: number, newTitle: string) => {
    try {
      await chatAPI.updateConversation(id, newTitle);
      setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
      );
      if (currentConversation?.id === id) {
        setCurrentConversation(prev => prev ? { ...prev, title: newTitle } : null);
      }
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }, [currentConversation]);

  // Send message
  const sendMessage = useCallback(async (messageText: string, conversationId?: number) => {
    if (!messageText.trim() || loading) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);

    // Create temp user message
    const tempUserMessage: ChatMessage = {
      id: generateTempId(),
      conversation_id: conversationId || currentConversation?.id || 0,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
      status: 'sending'
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await chatAPI.sendMessage(
        messageText,
        conversationId || currentConversation?.id,
        {
          responseStyle,
          showSources,
        },
        abortControllerRef.current.signal
      );
      
      const {
        answer,
        response: assistantResponse,
        conversation_id: newConversationId,
        citations,
        confidence,
        query_processing: queryProcessing,
        retrieval_stats: retrievalStats,
        user_message_id,
        assistant_message_id,
        suggested_questions
      } = response.data as ChatResponse;

      // Validate response data
      if (!user_message_id || !assistant_message_id) {
        throw new Error('Missing message IDs from server response');
      }

      // Update user message with real ID
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { ...msg, id: user_message_id, status: 'sent' }
          : msg
      ));

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: assistant_message_id,
        conversation_id: newConversationId,
        role: 'assistant',
        content: answer || assistantResponse,
        created_at: new Date().toISOString(),
        status: 'sent',
        citations,
        confidence,
        queryProcessing,
        retrievalStats,
        suggested_questions
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Handle new conversation if created
      if (!currentConversation && newConversationId) {
        const newConv: Conversation = {
          id: newConversationId,
          user_id: 0, // Will be set by API
          title: messageText.slice(0, 50) + (messageText.length > 50 ? '...' : ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCurrentConversation(newConv);
        setConversations(prev => [newConv, ...prev]);
        options.onNewConversation?.(newConv);
      } else if (currentConversation && currentConversation.title === "Cuộc trò chuyện mới") {
        const updatedTitle = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');
        setConversations(prev =>
          prev.map(c => c.id === currentConversation.id ? { ...c, title: updatedTitle } : c)
        );
        setCurrentConversation(prev => prev ? { ...prev, title: updatedTitle } : null);
      }

      return response.data;

    } catch (error) {
      console.error('Failed to send message:', error);
      
      const is403 = (error as any)?.response?.status === 403 || 
                    (error as any)?.message?.includes('403') || 
                    String(error).includes('403');
      
      if (is403) {
        setQuotaReached(true);
      }

      let errorContent = 'Xin lỗi, đã xảy ra lỗi khi gửi tin nhắn. Vui lòng thử lại.';
      if (error && (error as any).response) {
        const responseData = (error as any).response.data;
        if (responseData && responseData.detail) {
          errorContent = typeof responseData.detail === 'string' 
            ? responseData.detail 
            : JSON.stringify(responseData.detail);
        } else if (responseData && responseData.error) {
          errorContent = responseData.error;
        } else if (is403) {
          errorContent = 'Bạn đã sử dụng hết hạn ngạch tin nhắn trong ngày. Vui lòng nâng cấp gói cước để tiếp tục.';
        }
      } else if (error instanceof Error) {
        errorContent = `Lỗi: ${error.message}`;
      }

      // Update user message to failed status
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { 
              ...msg, 
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              retryable: true
            }
          : msg
      ));

      // Create error message from assistant
      const errorMessage: ChatMessage = {
        id: generateTempId(),
        conversation_id: conversationId || currentConversation?.id || 0,
        role: 'assistant',
        content: errorContent,
        created_at: new Date().toISOString(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      setMessages(prev => [...prev, errorMessage]);

      options.onError?.(error as Error);
      throw error;

    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentConversation, loading, responseStyle, showSources, options]);

  // Retry failed message
  const retryMessage = useCallback(async (content: string) => {
    // Remove the failed user message and error message
    setMessages(prev => prev.filter(msg => 
      msg.status !== 'failed' || msg.role !== 'assistant'
    ));
    
    // Resend the message
    return sendMessage(content);
  }, [sendMessage]);

  // Rate message
  const rateMessage = useCallback(async (messageId: number, rating: number, feedbackText?: string, feedbackCategory?: string) => {
    // Set loading state
    setRatingMessageId(messageId);
    
    // Optimistic update - cập nhật UI ngay lập tức
    const previousMessages = messages;
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, rating, feedback_text: feedbackText, feedback_category: feedbackCategory } : msg
    ));

    try {
      let responseData;
      if (feedbackText !== undefined || feedbackCategory !== undefined) {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:8000/api/chat/messages/${messageId}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rating, feedback_text: feedbackText, feedback_category: feedbackCategory })
        });
        if (!response.ok) {
          throw new Error('Failed to submit feedback text');
        }
        responseData = await response.json();
      } else {
        const response = await chatAPI.rateMessage(messageId, rating);
        responseData = response.data;
      }
      
      // Xác nhận với server data - force re-render với new array reference
      setMessages(prev => {
        const newMessages = prev.map(msg => 
          msg.id === messageId ? { ...msg, rating: responseData.rating, feedback_text: responseData.feedback_text, feedback_category: responseData.feedback_category } : msg
        );
        return [...newMessages]; // Force new reference
      });
    } catch (error) {
      // Rollback khi có lỗi
      setMessages(previousMessages);
      console.error('Failed to rate message:', error);
      options.onError?.(error as Error);
      throw error;
    } finally {
      // Clear loading state
      setRatingMessageId(null);
    }
  }, [messages]);

  // Set feedback for message (local state)
  const setFeedback = useCallback((messageIndex: number, type: 'up' | 'down') => {
    setMessages(prev => prev.map((msg, idx) => 
      idx === messageIndex ? { ...msg, feedback: msg.feedback === type ? null : type } : msg
    ));
  }, []);

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    conversations,
    currentConversation,
    messages,
    loading,
    responseStyle,
    showSources,
    searchQuery,
    filteredConversations,
    messagesEndRef,
    ratingMessageId,
    quotaReached,
    
    // Actions
    loadConversations,
    loadMessages,
    createNewConversation,
    selectConversation,
    deleteConversation,
    updateConversationTitle,
    sendMessage,
    retryMessage,
    rateMessage,
    setFeedback,
    setResponseStyle,
    setShowSources,
    setSearchQuery,
    setCurrentConversation,
    setMessages,
    setQuotaReached,
  };
};
