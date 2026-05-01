'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { chatAPI, ResponseStyle } from '@/app/lib/api';
import { ChatResponse, Conversation, Message } from '@/app/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, Settings, LogOut, MessageSquare,
  ChevronLeft, ChevronRight, Shield, Edit, Check, X,
  ThumbsUp, ThumbsDown, Search, Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

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

      setMessages(prev => prev.map(msg =>
        msg.role === 'user' && msg.conversation_id === (currentConversation?.id || conversation_id)
          ? { ...msg, id: user_message_id || msg.id }
          : msg
      ));

      const assistantMessage: Message = {
        id: assistant_message_id || Date.now() + 1,
        conversation_id,
        role: 'assistant',
        content: answer || assistantResponse,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, { ...assistantMessage, citations }]);

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
      const response = await chatAPI.rateMessage(messageId, rating);
      const updatedMessage = response.data;
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

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-slate-500 font-medium animate-pulse">Đang tải WikiBot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-be-vietnam">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 0 }}
        className={cn(
          "bg-white border-r border-slate-200 flex flex-col relative z-20 shadow-soft",
          !sidebarOpen && "border-none"
        )}
      >
        <div className="p-4 flex flex-col h-full w-80">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary-600 p-2 rounded-xl shadow-primary-200 shadow-lg">
                <Sparkles className="text-white" size={20} />
              </div>
              <h1 className="text-xl font-be-vietnam font-bold text-slate-900 tracking-tight">WikiBot</h1>
            </div>
            <button
              onClick={handleNewConversation}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all active:scale-90"
              title="Cuộc hội thoại mới"
            >
              <Plus size={22} />
            </button>
          </div>

          {/* Search */}
          <div className="px-2 mb-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Tìm kiếm hội thoại..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto space-y-1 px-2 custom-scrollbar">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "group relative p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3",
                  currentConversation?.id === conv.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <MessageSquare size={18} className={cn(currentConversation?.id === conv.id ? "text-primary-600" : "text-slate-400")} />
                <div className="flex-1 truncate text-sm font-medium">
                  {editingId === conv.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleUpdateTitle(conv.id, editTitle)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(conv.id, editTitle)}
                      className="bg-white border border-primary-300 rounded px-1 w-full outline-none"
                    />
                  ) : (
                    conv.title
                  )}
                </div>
                
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(conv.id, conv.title); }}
                    className="p-1 text-slate-400 hover:text-primary-600 rounded transition-colors"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* User Section */}
          <div className="mt-auto pt-4 border-t border-slate-100 px-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="w-full flex items-center gap-3 p-3 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all mb-1 group"
              >
                <Shield size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Quản trị hệ thống</span>
              </button>
            )}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-soft">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.username}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{user.role_name}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Đăng xuất"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-white overflow-hidden shadow-2xl z-10">
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-4 top-4 z-30 p-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl shadow-soft text-slate-500 hover:text-primary-600 transition-all active:scale-90"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>

        {/* Chat Header */}
        <header className="h-16 flex items-center justify-center border-b border-slate-100 px-6 relative">
          <div className="text-center">
            <h2 className="text-sm font-bold text-slate-900">{currentConversation?.title || 'Cuộc hội thoại mới'}</h2>
            <div className="flex items-center justify-center gap-4 mt-1">
              <select
                value={responseStyle}
                onChange={(e) => setResponseStyle(e.target.value as ResponseStyle)}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-transparent outline-none cursor-pointer hover:text-primary-600 transition-colors"
              >
                <option value="concise">Ngắn gọn</option>
                <option value="detailed">Chi tiết</option>
                <option value="creative">Sáng tạo</option>
              </select>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce shadow-soft">
                <Sparkles size={32} />
              </div>
              <h3 className="text-2xl font-be-vietnam font-bold text-slate-900 mb-2">Chào {user.full_name || user.username}!</h3>
              <p className="text-slate-500 max-w-md">Tôi là WikiBot, trợ lý thông minh của bạn. Hãy đặt câu hỏi về quy trình, tài liệu hoặc bất cứ điều gì bạn cần hỗ trợ.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
                {['Quy định nghỉ phép năm nay?', 'Làm thế nào để đổi mật khẩu?', 'Quy trình tạm ứng lương?', 'Liên hệ hỗ trợ kỹ thuật?'].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputMessage(q); }}
                    className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left text-sm text-slate-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-all group"
                  >
                    <span className="font-medium">{q}</span>
                    <ChevronRight size={14} className="inline ml-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id || index}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex flex-col",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[85%] md:max-w-[75%] p-4 shadow-soft transition-all",
                    msg.role === 'user' 
                      ? "bg-primary-600 text-white rounded-2xl rounded-tr-none" 
                      : "bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-tl-none"
                  )}>
                    <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    
                    {msg.citations && msg.citations.length > 0 && showSources && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Nguồn trích dẫn:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cite, i) => (
                            <div key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="font-bold">[{i+1}]</span> {cite.source}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-3 mt-2 px-1">
                      <button 
                        onClick={() => handleRateMessage(msg.id!, 1)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all active:scale-90",
                          msg.rating === 1 ? "bg-green-100 text-green-600" : "text-slate-300 hover:text-green-500 hover:bg-green-50"
                        )}
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button 
                        onClick={() => handleRateMessage(msg.id!, -1)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all active:scale-90",
                          msg.rating === -1 ? "bg-red-100 text-red-600" : "text-slate-300 hover:text-red-500 hover:bg-red-50"
                        )}
                      >
                        <ThumbsDown size={14} />
                      </button>
                      <span className="text-[10px] text-slate-300 font-medium">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {loading && (
            <div className="flex flex-col items-start">
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-soft">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Input Area */}
        <div className="p-4 md:p-6 bg-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto w-full pointer-events-auto">
            <form 
              onSubmit={handleSendMessage}
              className="glass-card p-2 rounded-2xl flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all shadow-soft-xl"
            >
              <textarea
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Nhập câu hỏi của bạn tại đây..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 py-3 px-4 resize-none max-h-40 font-medium"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className={cn(
                  "p-3 rounded-xl transition-all active:scale-90 shrink-0",
                  inputMessage.trim() && !loading
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <Send size={20} className={cn(loading && "animate-pulse")} />
              </button>
            </form>
            <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
              WikiBot có thể cung cấp thông tin không chính xác. Hãy kiểm tra các nguồn trích dẫn quan trọng.
            </p>
          </div>
        </div>
      </main>

      {/* Styles for scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
