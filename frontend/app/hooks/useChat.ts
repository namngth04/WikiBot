'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatAPI, ResponseStyle, API_BASE_URL } from '@/app/lib/api';
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
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  
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

    // Create temp empty assistant message with generating status
    const tempAssistantId = generateTempId();
    const tempAssistantMessage: ChatMessage = {
      id: tempAssistantId,
      conversation_id: conversationId || currentConversation?.id || 0,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, tempUserMessage, tempAssistantMessage]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/chat/send-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageText,
          conversation_id: conversationId || currentConversation?.id,
          response_style: responseStyle,
          show_sources: showSources,
          model_id: selectedModelId,
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        if (response.status === 403) {
          setQuotaReached(true);
          throw new Error('Bạn đã sử dụng hết hạn ngạch 10 câu hỏi/ngày của gói Free. Vui lòng nâng cấp lên gói Pro để tiếp tục trò chuyện không giới hạn.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Lỗi kết nối máy chủ (HTTP ${response.status})`);
      }

      if (!response.body) {
        throw new Error('Trình duyệt của bạn không hỗ trợ Streaming phản hồi.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let assistantContent = '';
      let citations: any[] = [];
      let confidence: any = null;
      let suggestedQuestions: string[] = [];
      let finalConversationId = currentConversation?.id;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n\n');
        
        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            try {
              const rawJson = line.replace('data:', '').trim();
              const event = JSON.parse(rawJson);
              
              if (event.type === 'token') {
                assistantContent += event.content;
                setMessages(prev => prev.map(msg =>
                  msg.id === tempAssistantId
                    ? { ...msg, content: assistantContent }
                    : msg
                ));
              } else if (event.type === 'metadata') {
                citations = event.citations || [];
                confidence = event.confidence;
                suggestedQuestions = event.suggested_questions || [];
                
                setMessages(prev => prev.map(msg =>
                  msg.id === tempAssistantId
                    ? { 
                        ...msg, 
                        citations,
                        confidence,
                        suggested_questions: suggestedQuestions
                      }
                    : msg
                ));
              } else if (event.type === 'final_success') {
                const { user_message_id, assistant_message_id, conversation_id: newConvId } = event;
                finalConversationId = newConvId;

                // Sync message IDs from database
                setMessages(prev => prev.map(msg => {
                  if (msg.id === tempUserMessage.id) {
                    return { ...msg, id: user_message_id, status: 'sent' };
                  }
                  if (msg.id === tempAssistantId) {
                    return { ...msg, id: assistant_message_id, status: 'sent' };
                  }
                  return msg;
                }));

                // Handle sidebar list updates
                if (!currentConversation && newConvId) {
                  const newConv: Conversation = {
                    id: newConvId,
                    user_id: 0,
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
              } else if (event.type === 'error') {
                throw new Error(event.content);
              }
            } catch (jsonErr) {
              console.warn('Failed to parse SSE JSON:', line, jsonErr);
            }
          }
        }
      }

      return { success: true };

    } catch (error: any) {
      if (error.name === 'AbortError' || (error.message && error.message.includes('aborted'))) {
        console.log('Stream stopped by user');
        // Đổi trạng thái tin nhắn thành sent, không hiển thị lỗi
        setMessages(prev => prev.map(msg => 
          (msg.id === tempUserMessage.id || msg.id === tempAssistantId)
            ? { ...msg, status: 'sent' as const }
            : msg
        ));
        return;
      }

      console.error('Failed to send streaming message:', error);
      
      const is403 = (error as any)?.response?.status === 403 || 
                    (error as any)?.message?.includes('403') || 
                    String(error).includes('403');
      
      if (is403) {
        setQuotaReached(true);
      }

      let errorContent = 'Xin lỗi, đã xảy ra lỗi khi kết nối máy chủ để nhận câu trả lời. Vui lòng thử lại.';
      if (error instanceof Error) {
        errorContent = error.message;
      }

      // Cleanup temp empty assistant message and turn user message to failed
      setMessages(prev => {
        const cleaned = prev.filter(msg => msg.id !== tempAssistantId);
        return cleaned.map(msg =>
          msg.id === tempUserMessage.id
            ? { 
                ...msg, 
                status: 'failed' as const,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                retryable: true
              }
            : msg
        );
      });

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
        const response = await fetch(`${API_BASE_URL}/api/chat/messages/${messageId}/feedback`, {
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

  // Stop generating response
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

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
    selectedModelId,
    
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
    setSelectedModelId,
    stopGenerating,
  };
};
