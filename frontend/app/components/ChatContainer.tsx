'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, MessageSquare,
  ChevronLeft, ChevronRight, Shield, Edit, Check, X,
  ThumbsUp, ThumbsDown, Search, Sparkles,
  User, LogOut, Download, FileText, FileCode, FileEdit, ChevronDown
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useChat } from '@/app/hooks/useChat';
import { useAuth } from '@/app/context/auth-context';
import { useRouter } from 'next/navigation';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { UserSettings } from '@/app/components/UserSettings';
import AppLogo from './AppLogo';
import ThemeToggle from './ThemeToggle';

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
  const [quota, setQuota] = useState<any>(null);

  const fetchQuota = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/upgrade/quota', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setQuota(data);
      }
    } catch (error) {
      console.error('Error fetching quota in chat:', error);
    }
  };
  
  // Export states
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
      fetchQuota();
    }
  }, [user, messages]);

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

  // Export functionality
  const handleExport = async (format: 'docx' | 'md' | 'txt') => {
    if (!currentConversation) return;
    setExporting(true);
    setExportWarning(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/chat/conversations/${currentConversation.id}/export/${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Check for locked file warning header
      const isNewFile = response.headers.get('X-Export-New-File') === 'true';
      if (isNewFile) {
        setExportWarning("Tệp tin đang được mở trong MS Word. Bản báo cáo đã được tự động lưu sang tệp mới có hậu tố '_new.docx'.");
        // Auto-clear warning after 8 seconds
        setTimeout(() => setExportWarning(null), 8000);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from headers
      const disposition = response.headers.get('content-disposition');
      let filename = `${currentConversation.title.replace(/\s+/g, '_')}.${format}`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting conversation:', error);
      alert('Không thể xuất cuộc hội thoại. Vui lòng thử lại sau.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={cn("h-screen bg-canvas flex overflow-hidden font-be-vietnam text-ink", className)}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 80 }}
        className={cn(
          "bg-surface-1 border-r border-hairline flex flex-col relative z-20 overflow-hidden transition-all duration-300",
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
                  className="text-xl font-be-vietnam font-bold text-ink tracking-tight whitespace-nowrap"
                >
                  WikiBot
                </motion.h1>
              )}
            </AnimatePresence>
            {sidebarOpen && (
              <button
                onClick={createNewConversation}
                className="ml-auto p-1.5 border border-hairline text-ink-subtle hover:text-brand-lavender hover:bg-surface-2 rounded-md transition-all active:scale-90"
                title="Cuộc hội thoại mới"
              >
                <Plus size={18} />
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle group-focus-within:text-brand-lavender transition-colors" size={16} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm hội thoại..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-hairline rounded-md text-xs focus:border-hairline-strong focus:ring-1 focus:ring-brand-lavender/30 transition-all outline-none"
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
                  "w-full flex items-center transition-all duration-200 group rounded-md p-2.5 cursor-pointer",
                  sidebarOpen ? "gap-3" : "justify-center",
                  currentConversation?.id === conv.id
                    ? "bg-surface-2 border border-hairline text-ink"
                    : "text-ink-muted hover:bg-surface-1/50 hover:text-ink"
                )}
                title={!sidebarOpen ? conv.title : ""}
              >
                <MessageSquare size={16} className={cn("shrink-0", currentConversation?.id === conv.id ? "text-brand-lavender" : "text-ink-subtle group-hover:scale-105 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex-1 truncate text-xs font-medium"
                    >
                      {editingId === conv.id ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleUpdateTitle(conv.id, editTitle)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(conv.id, editTitle)}
                          className="bg-surface-3 border border-brand-lavender/50 rounded px-1.5 py-0.5 w-full outline-none text-ink"
                        />
                      ) : (
                        conv.title
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {sidebarOpen && (
                  <div className="hidden group-hover:flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditing(conv.id, conv.title); }}
                      className="p-1 text-ink-subtle hover:text-brand-lavender rounded transition-colors"
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 text-ink-subtle hover:text-red-400 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quota Widget for Free User */}
          {sidebarOpen && quota && quota.subscription_tier === 'free' && (
            <div className="mb-4 mx-2 p-3 bg-surface-2 border border-hairline rounded-lg text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink flex items-center gap-1">
                  <Sparkles size={12} className="text-brand-lavender" /> Gói miễn phí
                </span>
                <span className="text-[10px] text-ink-subtle">Hạn ngạch</span>
              </div>
              
              {/* Question progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-ink-muted">
                  <span>Câu hỏi: {quota.questions_used}/{quota.questions_limit}</span>
                  <span>{Math.round((quota.questions_used / quota.questions_limit) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-lavender rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((quota.questions_used / quota.questions_limit) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Document progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-ink-muted">
                  <span>Tài liệu: {quota.documents_used}/{quota.documents_limit}</span>
                  <span>{Math.round((quota.documents_used / quota.documents_limit) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((quota.documents_used / quota.documents_limit) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => router.push('/pricing')}
                className="w-full py-1.5 mt-1 bg-brand-lavender hover:bg-brand-lavender/90 text-white rounded text-[10px] font-bold transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1"
              >
                Nâng cấp Pro ⚡
              </button>
            </div>
          )}

          {!sidebarOpen && quota && quota.subscription_tier === 'free' && (
            <div 
              onClick={() => router.push('/pricing')}
              className="mb-4 mx-auto w-8 h-8 rounded-full bg-brand-lavender/10 border border-brand-lavender/30 flex items-center justify-center text-brand-lavender cursor-pointer hover:bg-brand-lavender hover:text-white transition-all active:scale-90"
              title={`Hạn ngạch câu hỏi: ${quota.questions_used}/${quota.questions_limit}`}
            >
              <Sparkles size={14} className="animate-pulse" />
            </div>
          )}

          {/* User Section */}
          <div className="mt-auto pt-4 border-t border-hairline px-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/dashboard')}
                className={cn(
                  "w-full flex items-center border border-hairline text-ink-muted hover:text-brand-lavender hover:bg-surface-2 transition-all mb-1 group rounded-md",
                  sidebarOpen ? "gap-3 p-2.5" : "justify-center p-2.5 px-0"
                )}
                title={!sidebarOpen ? "Quản trị hệ thống" : ""}
              >
                <Shield size={16} className={cn("shrink-0 group-hover:scale-105 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-xs font-medium whitespace-nowrap"
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
                  "w-full flex items-center border border-hairline transition-all mb-1 group rounded-md",
                  sidebarOpen ? "gap-3 p-2.5" : "justify-center p-2.5 px-0",
                  currentView === 'settings'
                    ? "text-brand-lavender bg-surface-2"
                    : "text-ink-muted hover:text-brand-lavender hover:bg-surface-2"
                )}
                title={!sidebarOpen ? "Cá nhân" : ""}
              >
                <User size={16} className={cn("shrink-0 group-hover:scale-105 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-xs font-medium whitespace-nowrap"
                    >
                      Cá nhân
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
            <div className={cn(
              "flex items-center p-2.5 bg-surface-2 border border-hairline rounded-lg transition-all duration-300",
              sidebarOpen ? "justify-between" : "justify-center"
            )}>
              <div className={cn(
                "flex items-center gap-2.5 min-w-0",
                !sidebarOpen && "hidden"
              )}>
                <div className="w-7 h-7 rounded bg-brand-lavender flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
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
                      <p className="text-xs font-bold text-ink truncate">{user?.full_name || user?.username}</p>
                      <p className="text-[9px] text-ink-subtle uppercase tracking-wider font-semibold">
                        {quota?.subscription_tier === 'pro' ? (
                          <span className="text-brand-lavender font-bold flex items-center gap-0.5">⚡ PRO TIER</span>
                        ) : quota?.subscription_tier === 'enterprise' ? (
                          <span className="text-purple-400 font-bold flex items-center gap-0.5">🛡️ ENTERPRISE</span>
                        ) : (
                          'User'
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={handleLogout}
                className={cn(
                  "p-1.5 text-ink-subtle hover:text-red-400 hover:bg-red-950/20 rounded transition-all",
                  !sidebarOpen && "hidden"
                )}
                title="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
              {!sidebarOpen && (
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-ink-subtle hover:text-red-400 hover:bg-red-950/20 rounded transition-all"
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-canvas overflow-hidden border-l border-hairline">
        
        {/* Warning Alert Banner for locked files */}
        <AnimatePresence>
          {exportWarning && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-18 left-6 right-6 z-30 bg-semantic-warning/20 border border-semantic-warning/40 rounded-lg p-3 text-xs text-semantic-warning flex items-center justify-between backdrop-blur-md"
            >
              <div className="flex items-center gap-2 font-medium">
                <span>⚠️ {exportWarning}</span>
              </div>
              <button onClick={() => setExportWarning(null)} className="text-ink-subtle hover:text-ink transition-colors ml-2">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {currentView === 'chat' ? (
          <>
            {/* Toggle Sidebar Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute left-4 top-4 z-30 p-2 bg-surface-1/80 backdrop-blur-md border border-hairline rounded-md text-ink-muted hover:text-brand-lavender transition-all active:scale-90"
            >
              {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Chat Header */}
            <header className="h-16 flex items-center justify-center border-b border-hairline px-6 relative">
              <div className="text-center">
                <h2 className="text-sm font-bold text-ink tracking-tight">
                  {currentConversation?.title || 'Cuộc hội thoại mới'}
                </h2>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <select
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value as any)}
                    className="text-[9px] font-bold uppercase tracking-widest text-ink-subtle bg-canvas border border-hairline rounded-md px-1.5 py-0.5 outline-none cursor-pointer hover:text-brand-lavender transition-colors"
                  >
                    <option value="concise">Ngắn gọn</option>
                    <option value="normal">Bình thường</option>
                    <option value="detailed">Chi tiết</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons on the right side of the Header */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <ThemeToggle />
                
                {currentConversation && messages.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                      disabled={exporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-hairline hover:bg-surface-3 hover:text-ink text-ink-muted rounded-md text-xs font-medium transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      title="Xuất lịch sử hội thoại"
                    >
                      <Download size={13} className={cn(exporting && "animate-bounce")} />
                      <span>{exporting ? 'Đang xuất...' : 'Xuất'}</span>
                      <ChevronDown size={11} className={cn("transition-transform duration-200", exportDropdownOpen && "rotate-180")} />
                    </button>
                    
                    <AnimatePresence>
                      {exportDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setExportDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.95 }}
                            className="absolute right-0 mt-1.5 w-48 bg-surface-3 border border-hairline rounded-md shadow-lg z-50 py-1 overflow-hidden"
                          >
                            <button
                              onClick={() => { handleExport('docx'); setExportDropdownOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-muted hover:text-ink hover:bg-surface-2 text-left transition-colors"
                            >
                              <FileEdit size={13} className="text-blue-400" />
                              <span>Microsoft Word (.docx)</span>
                            </button>
                            <button
                              onClick={() => { handleExport('md'); setExportDropdownOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-muted hover:text-ink hover:bg-surface-2 text-left transition-colors"
                            >
                              <FileCode size={13} className="text-emerald-400" />
                              <span>Markdown (.md)</span>
                            </button>
                            <button
                              onClick={() => { handleExport('txt'); setExportDropdownOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-muted hover:text-ink hover:bg-surface-2 text-left transition-colors"
                            >
                              <FileText size={13} className="text-amber-400" />
                              <span>Văn bản thường (.txt)</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
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
          background: #23252a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #34343a;
        }
      `}</style>
    </div>
  );
}
