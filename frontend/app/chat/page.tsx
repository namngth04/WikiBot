'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { chatAPI, ResponseStyle, usersAPI } from '@/app/lib/api';
import { ChatResponse, Conversation, Message } from '@/app/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, Settings, LogOut, MessageSquare,
  ChevronLeft, ChevronRight, Shield, Edit, Check, X,
  ThumbsUp, ThumbsDown, Search, Sparkles,
  User, Mail, Phone, Building2, Lock, Save, 
  ShieldCheck, AlertCircle, Camera, CheckCircle2, ArrowLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ChatMessage = Message & {
  citations?: ChatResponse['citations'];
  feedback?: 'up' | 'down' | null;
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
  const [currentView, setCurrentView] = useState<'chat' | 'settings'>('chat');
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

  const handleFeedback = (messageIndex: number, type: 'up' | 'down') => {
    setMessages(prev => prev.map((msg, idx) => 
      idx === messageIndex ? { ...msg, feedback: msg.feedback === type ? null : type } : msg
    ));
  };

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
        animate={{ width: sidebarOpen ? 320 : 80 }}
        className={cn(
          "bg-white border-r border-slate-200 flex flex-col relative z-20 shadow-soft overflow-hidden",
          !sidebarOpen && "border-none"
        )}
      >
        <div className="p-4 flex flex-col h-full min-w-[80px]">
          {/* Sidebar Header */}
          <div className={cn(
            "flex items-center gap-3 mb-6 px-2 transition-all duration-300",
            !sidebarOpen && "justify-center px-0"
          )}>
            <div className="bg-primary-600 p-2 rounded-xl shadow-primary-200 shadow-lg shrink-0">
              <Sparkles className="text-white" size={20} />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.h1 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xl font-be-vietnam font-bold text-slate-900 tracking-tight whitespace-nowrap"
                >
                  WikiBot
                </motion.h1>
              )}
            </AnimatePresence>
            {sidebarOpen && (
              <button
                onClick={handleNewConversation}
                className="ml-auto p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all active:scale-90"
                title="Cuộc hội thoại mới"
              >
                <Plus size={22} />
              </button>
            )}
          </div>

          {/* Search */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="px-2 mb-4"
              >
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto space-y-1 px-2 custom-scrollbar">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "w-full flex items-center transition-all duration-300 group rounded-xl p-3",
                  sidebarOpen ? "gap-3" : "justify-center",
                  currentConversation?.id === conv.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-50"
                )}
                title={!sidebarOpen ? conv.title : ""}
              >
                <MessageSquare size={18} className={cn("shrink-0", currentConversation?.id === conv.id ? "text-primary-600" : "text-slate-400 group-hover:scale-110 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex-1 truncate text-sm font-medium"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
                {sidebarOpen && (
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
                )}
              </div>
            ))}
          </div>

          {/* User Section */}
          <div className="mt-auto pt-4 border-t border-slate-100 px-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className={cn(
                  "w-full flex items-center text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-all mb-1 group rounded-xl",
                  sidebarOpen ? "gap-3 p-3" : "justify-center p-3 px-0"
                )}
                title={!sidebarOpen ? "Quản trị hệ thống" : ""}
              >
                <Shield size={18} className={cn("shrink-0 group-hover:scale-110 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      Quản trị hệ thống
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
            <button
              onClick={() => setCurrentView('settings')}
              className={cn(
                "w-full flex items-center transition-all mb-1 group rounded-xl",
                sidebarOpen ? "gap-3 p-3" : "justify-center p-3 px-0",
                currentView === 'settings'
                  ? "text-primary-600 bg-primary-50"
                  : "text-slate-600 hover:text-primary-600 hover:bg-primary-50"
              )}
              title={!sidebarOpen ? "Cài đặt" : ""}
            >
              <Settings size={18} className={cn("shrink-0 group-hover:scale-110 transition-transform")} />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    Cài đặt
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <div className={cn(
              "flex items-center p-3 bg-slate-50 rounded-2xl transition-all duration-300",
              sidebarOpen ? "justify-between" : "justify-center"
            )}>
              <div className={cn(
                "flex items-center gap-3 min-w-0",
                !sidebarOpen && "hidden"
              )}>
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-soft">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="truncate"
                    >
                      <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.username}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">User</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={handleLogout}
                className={cn(
                  "p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all",
                  !sidebarOpen && "hidden"
                )}
                title="Đăng xuất"
              >
                <LogOut size={18} />
              </button>
              {!sidebarOpen && (
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Đăng xuất"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-white overflow-hidden shadow-2xl z-10">
        {currentView === 'chat' ? (
          <>
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
                        <div className="flex items-center gap-1 mt-1">
                          <button 
                            onClick={() => handleFeedback(index, 'up')}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              msg.feedback === 'up' ? "bg-primary-100 text-primary-600" : "text-slate-400 hover:text-primary-600 hover:bg-slate-100"
                            )}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button 
                            onClick={() => handleFeedback(index, 'down')}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              msg.feedback === 'down' ? "bg-rose-100 text-rose-600" : "text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                            )}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-white border-t border-slate-100">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Nhập câu hỏi của bạn..."
                    className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                    disabled={loading}
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
          </>
        ) : (
          <SettingsView onBack={() => setCurrentView('chat')} user={user} />
        )}
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

// Settings View Component
function SettingsView({ onBack, user }: { onBack: () => void; user: any }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
    new_password: '',
    confirm_password: '',
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await usersAPI.updateMe({
        username: profileForm.username,
        full_name: profileForm.full_name,
        email: profileForm.email,
        phone: profileForm.phone,
        department: profileForm.department,
      });
      const updatedUser = response.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess('Cập nhật thông tin thành công!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Cập nhật thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.new_password !== profileForm.confirm_password) {
      setError('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (profileForm.new_password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await usersAPI.updateMe({ password: profileForm.new_password });
      setProfileForm(prev => ({ ...prev, new_password: '', confirm_password: '' }));
      setSuccess('Đổi mật khẩu thành công!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white z-20 border-b border-slate-100">
        <div className="flex items-center gap-4 p-4">
          <button 
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-be-vietnam font-bold text-slate-900">Cài đặt tài khoản</h1>
            <p className="text-sm text-slate-500">Quản lý thông tin cá nhân</p>
          </div>
        </div>
      </div>

      {/* Status Messages - Non-sticky */}
      {(success || error) && (
        <div className="px-6 py-3 bg-white border-b border-slate-100 space-y-2">
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Left - Avatar card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary-600 to-violet-600 opacity-10 group-hover:opacity-20 transition-opacity" />
              
              <div className="relative z-10">
                <div className="relative inline-block mb-6">
                  <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center mx-auto ring-4 ring-primary-50">
                    <User size={64} className="text-slate-300" />
                  </div>
                  <button className="absolute bottom-0 right-0 p-2.5 bg-white rounded-full shadow-md text-primary-600 hover:text-primary-700 hover:scale-110 transition-all border border-slate-100">
                    <Camera size={18} />
                  </button>
                </div>
                
                <h2 className="text-2xl font-be-vietnam font-bold text-slate-900 mb-1">{user?.full_name || user?.username}</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">Người dùng</p>
                
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-primary-50 text-primary-600 text-[10px] font-bold rounded-full uppercase tracking-wider border border-primary-100">
                    Active
                  </span>
                  <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider border border-slate-100">
                    ID: {user?.id}
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-50 text-left space-y-4">
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail size={16} className="text-slate-400" />
                  <span className="text-sm font-medium truncate">{user?.email || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Building2 size={16} className="text-slate-400" />
                  <span className="text-sm font-medium">{user?.department || 'WikiBot Team'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
              <ShieldCheck className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5" />
              <h3 className="text-lg font-be-vietnam font-bold mb-4 flex items-center gap-2">
                <Lock size={20} className="text-primary-400" />
                Bảo mật tài khoản
              </h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Mật khẩu của bạn được mã hóa an toàn. Chúng tôi khuyên bạn nên đổi mật khẩu định kỳ 3 tháng một lần.
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-primary-400">
                <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                Hệ thống đã được bảo vệ
              </div>
            </div>
          </div>
          
          {/* Right - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile form */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft">
              <h3 className="text-xl font-be-vietnam font-bold text-slate-900 mb-6 flex items-center gap-3">
                <User className="text-primary-600" size={24} />
                Cập nhật thông tin
              </h3>
              
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tên đăng nhập</label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={profileForm.username} 
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                        required 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Họ tên</label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={profileForm.full_name} 
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="email" 
                        value={profileForm.email} 
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Số điện thoại</label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={profileForm.phone} 
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phòng ban</label>
                    <div className="relative">
                      <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={profileForm.department} 
                        onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all text-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <Save size={18} />
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </div>

            {/* Password form */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft">
              <h3 className="text-xl font-be-vietnam font-bold text-slate-900 mb-6 flex items-center gap-3">
                <Lock className="text-amber-500" size={24} />
                Đổi mật khẩu
              </h3>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mật khẩu mới</label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="password" 
                        value={profileForm.new_password} 
                        onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm" 
                        required 
                        minLength={6} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="password" 
                        value={profileForm.confirm_password} 
                        onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all text-sm" 
                        required 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <ShieldCheck size={18} />
                    {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
