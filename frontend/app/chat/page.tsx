'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { chatAPI, ResponseStyle } from '@/app/lib/api';
import { ChatResponse, Conversation, Message } from '@/app/lib/types';
import {
  Send, Plus, Trash2, Settings, LogOut, MessageSquare,
  ChevronLeft, ChevronRight, Shield, Edit, Check, X,
  ThumbsUp, ThumbsDown
} from 'lucide-react';

type ChatMessage = Message & {
  citations?: ChatResponse['citations'];
};

export default function ChatPage() {
  const router = useRouter();
  const { user, isAdmin, logout, loading: authLoading } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('concise');
  const [showSources, setShowSources] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load conversations
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const response = await chatAPI.listConversations();
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const response = await chatAPI.getConversation(conversationId);
      setMessages((response.data.messages || []) as ChatMessage[]);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const response = await chatAPI.createConversation();
      const newConversation = response.data;
      setConversations([newConversation, ...conversations]);
      setCurrentConversation(newConversation);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    loadMessages(conversation.id);
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc muốn xóa cuộc trò chuyện này?')) return;
    
    try {
      await chatAPI.deleteConversation(id);
      setConversations(conversations.filter(c => c.id !== id));
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    // Add user message to UI immediately
    const userMessage: Message = {
      id: Date.now(),
      conversation_id: currentConversation?.id || 0,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await chatAPI.sendMessage(
        messageText,
        currentConversation?.id,
        {
          responseStyle,
          showSources: showSources,
        }
      );
      
      const { answer, response: assistantResponse, conversation_id, citations, user_message_id, assistant_message_id } = response.data as ChatResponse;

      // Update user message with real database ID
      setMessages(prev => prev.map(msg =>
        msg.role === 'user' && msg.conversation_id === (currentConversation?.id || conversation_id)
          ? { ...msg, id: user_message_id || msg.id }
          : msg
      ));

      // Add assistant message with real database ID
      const assistantMessage: Message = {
        id: assistant_message_id || Date.now() + 1,
        conversation_id,
        role: 'assistant',
        content: answer || assistantResponse,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, { ...assistantMessage, citations }]);

      // Update current conversation if new
      if (!currentConversation) {
        const newConv: Conversation = {
          id: conversation_id,
          user_id: user?.id || 0,
          title: messageText.slice(0, 50) + (messageText.length > 50 ? '...' : ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCurrentConversation(newConv);
        setConversations(prev => [newConv, ...prev]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error message
      const errorMessage: Message = {
        id: Date.now() + 1,
        conversation_id: currentConversation?.id || 0,
        role: 'assistant',
        content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleUpdateTitle = async (id: number, newTitle: string) => {
    try {
      await chatAPI.updateConversation(id, newTitle);
      setConversations(conversations.map(c => c.id === id ? { ...c, title: newTitle } : c));
      if (currentConversation?.id === id) {
        setCurrentConversation({ ...currentConversation, title: newTitle });
      }
      setEditingId(null);
      setEditTitle('');
    } catch (error) {
      console.error('Lỗi khi đổi tên:', error);
    }
  };

  const handleRateMessage = async (messageId: number, rating: number) => {
    try {
      // If user clicks the same rating, we could potentially unset it (0), 
      // but for now let's just update to the new rating
      const response = await chatAPI.rateMessage(messageId, rating);
      const updatedMessage = response.data;

      // Update messages state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, rating: updatedMessage.rating } : msg
      ));
    } catch (error) {
      console.error('Lỗi khi đánh giá tin nhắn:', error);
    }
  };

  const startEditing = (id: number, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">WikiBot</h1>
            <button
              onClick={handleNewConversation}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Cuộc trò chuyện mới"
            >
              <Plus size={20} />
            </button>
          </div>
          
          {/* User Info */}
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
              {user.full_name?.[0] || user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user.full_name || user.username}</p>
              <p className="text-xs text-gray-500">{user.role?.name || 'Không có chức vụ'}</p>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Input */}
          <div className="px-4 py-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Tìm kiếm hội thoại..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-sm">{searchQuery ? 'Không tìm thấy hội thoại nào' : 'Chưa có cuộc trò chuyện nào'}</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => editingId !== conv.id && handleSelectConversation(conv)}
                className={`w-full p-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-3 cursor-pointer ${
                  currentConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <MessageSquare size={18} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingId === conv.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className="font-medium text-sm truncate">{conv.title}</p>
                      <p className="text-xs text-gray-500">{conv.message_count || 0} tin nhắn</p>
                    </>
                  )}
                </div>
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateTitle(conv.id, editTitle);
                      }}
                      className="p-1 text-green-600 hover:text-green-700 transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditing();
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(conv.id, conv.title);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full flex items-center gap-2 p-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Shield size={18} />
              <span>Quay về Admin Panel</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 p-2 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
          <h2 className="font-semibold text-gray-800">
            {currentConversation?.title || 'Cuộc trò chuyện mới'}
          </h2>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Settings size={16} className="text-gray-500" />
              <select
                value={responseStyle}
                onChange={(e) => setResponseStyle(e.target.value as ResponseStyle)}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              >
                <option value="concise">Ngắn gọn</option>
                <option value="normal">Bình thường</option>
                <option value="detailed">Chi tiết</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showSources}
                onChange={(e) => setShowSources(e.target.checked)}
                className="rounded border-gray-300"
              />
              Hiện nguồn
            </label>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                <p>Bắt đầu cuộc trò chuyện mới</p>
                <p className="text-sm mt-2">Tôi có thể trả lời các câu hỏi dựa trên tài liệu nội bộ</p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && showSources && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                      <p className="font-medium text-gray-600">Nguồn:</p>
                      {msg.citations.slice(0, 3).map((citation, citationIdx) => (
                        <p key={`${msg.id}-citation-${citationIdx}`}>
                          {citationIdx + 1}. {citation.source} (Đoạn {citation.chunk_index})
                        </p>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3">
                      <button
                        onClick={() => handleRateMessage(msg.id, 1)}
                        className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                          msg.rating === 1 ? 'text-blue-600' : 'text-gray-400'
                        }`}
                        title="Hữu ích"
                      >
                        <ThumbsUp size={16} fill={msg.rating === 1 ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => handleRateMessage(msg.id, -1)}
                        className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                          msg.rating === -1 ? 'text-red-600' : 'text-gray-400'
                        }`}
                        title="Không hữu ích"
                      >
                        <ThumbsDown size={16} fill={msg.rating === -1 ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 p-3 rounded-lg rounded-bl-none">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send size={18} />
              Gửi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
