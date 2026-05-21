'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, MessageSquare,
  ChevronLeft, ChevronRight, Shield, Edit, Check, X,
  ThumbsUp, ThumbsDown, Search, Sparkles,
  User, LogOut
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useChat } from '@/app/hooks/useChat';
import { useAuth } from '@/app/context/auth-context';
import { useRouter } from 'next/navigation';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { UserSettings } from '@/app/components/UserSettings';
import AppLogo from './AppLogo';

interface ChatContainerProps {
  className?: string;
}

export default function ChatContainer({ className }: ChatContainerProps) {
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [currentView, setCurrentView] = useState<'chat' | 'settings'>('chat');
  const [inputMessage, setInputMessage] = useState('');

  const {
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
    loadConversations,
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
  } = useChat({
    onNewConversation: (conv) => {
      // Auto-select new conversation
      selectConversation(conv);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    // Handle suggested questions from MessageList
    const handleSuggestedQuestion = (e: CustomEvent) => {
      setInputMessage(e.detail);
    };

    window.addEventListener('suggestedQuestion', handleSuggestedQuestion as EventListener);
    return () => {
      window.removeEventListener('suggestedQuestion', handleSuggestedQuestion as EventListener);
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');

    try {
      await sendMessage(messageToSend);
    } catch (error) {
      // Error is handled by useChat hook
      setInputMessage(messageToSend); // Restore message on error
    }
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
    } catch (error) {
      // Error is handled by useChat hook
    }
  };

  const handleUpdateTitle = async (id: number, newTitle: string) => {
    try {
      await updateConversationTitle(id, newTitle);
      setEditingId(null);
      setEditTitle('');
    } catch (error) {
      // Error is handled by useChat hook
    }
  };

  const startEditing = (id: number, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className={cn("h-screen bg-slate-50 flex overflow-hidden font-be-vietnam", className)}>
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
            <AppLogo size="md" />
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
                onClick={createNewConversation}
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
                onClick={() => selectConversation(conv)}
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
            {!isAdmin && (
              <button
                onClick={() => setCurrentView('settings')}
                className={cn(
                  "w-full flex items-center transition-all mb-1 group rounded-xl",
                  sidebarOpen ? "gap-3 p-3" : "justify-center p-3 px-0",
                  currentView === 'settings'
                    ? "text-primary-600 bg-primary-50"
                    : "text-slate-600 hover:text-primary-600 hover:bg-primary-50"
                )}
                title={!sidebarOpen ? "Cá nhân" : ""}
              >
                <User size={18} className={cn("shrink-0 group-hover:scale-110 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      Cá nhân
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
            <div className={cn(
              "flex items-center p-3 bg-slate-50 rounded-2xl transition-all duration-300",
              sidebarOpen ? "justify-between" : "justify-center"
            )}>
              <div className={cn(
                "flex items-center gap-3 min-w-0",
                !sidebarOpen && "hidden"
              )}>
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-soft">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="truncate"
                    >
                      <p className="text-sm font-bold text-slate-900 truncate">{user?.full_name || user?.username}</p>
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
                <h2 className="text-sm font-bold text-slate-900">
                  {currentConversation?.title || 'Cuộc hội thoại mới'}
                </h2>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <select
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value as any)}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-transparent outline-none cursor-pointer hover:text-primary-600 transition-colors"
                  >
                    <option value="concise">Ngắn gọn</option>
                    <option value="normal">Bình thường</option>
                    <option value="detailed">Chi tiết</option>
                  </select>
                </div>
              </div>
            </header>

            {/* Messages */}
            <MessageList
              messages={messages}
              loading={loading}
              showSources={showSources}
              onRetryMessage={retryMessage}
              onRateMessage={rateMessage}
              onSetFeedback={setFeedback}
              messagesEndRef={messagesEndRef}
              ratingMessageId={ratingMessageId}
            />

            {/* Input */}
            <ChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSubmit={handleSendMessage}
              loading={loading}
            />
          </>
        ) : (
          currentView === 'settings' && !isAdmin && (
            <UserSettings 
              onBack={() => setCurrentView('chat')} 
              user={user} 
            />
          )
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
