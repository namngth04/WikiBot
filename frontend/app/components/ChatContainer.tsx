'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, MessageSquare,
  ChevronLeft, ChevronRight, Shield, Edit, Check, X,
  ThumbsUp, ThumbsDown, Search, Sparkles,
  User, LogOut, Download, FileText, FileCode, FileEdit, ChevronDown, BarChart3, Cpu
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useChat } from '@/app/hooks/useChat';
import { chatModelsAPI, ChatModelData } from '@/app/lib/ai-config-api';
import { useAuth } from '@/app/context/auth-context';
import { useRouter } from 'next/navigation';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { UserSettings } from '@/app/components/UserSettings';
import AppLogo from './AppLogo';
import ThemeToggle from './ThemeToggle';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatContainerProps {
  className?: string;
}

export default function ChatContainer({ className }: ChatContainerProps) {
  const router = useRouter();
  const { user, isAdmin, isCompanyAdmin, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [currentView, setCurrentView] = useState<'chat' | 'settings'>('chat');
  const [inputMessage, setInputMessage] = useState('');
  const [quota, setQuota] = useState<any>(null);
  const [activeModels, setActiveModels] = useState<ChatModelData[]>([]);
  
  // Citation Modal states
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [citationData, setCitationData] = useState<any>(null);
  const [citationLoading, setCitationLoading] = useState(false);

  const handleShowSource = async (docId: number, pageNum: number) => {
    setCitationLoading(true);
    setCitationModalOpen(true);
    setCitationData(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/documents/${docId}/pages/${pageNum}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCitationData(data);
      } else {
        console.error('Failed to fetch page content');
      }
    } catch (error) {
      console.error('Error fetching page content:', error);
    } finally {
      setCitationLoading(false);
    }
  };
  
  // Feedback states
  const [feedbackMessageId, setFeedbackMessageId] = useState<number | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

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
    quotaReached,
    setQuotaReached,
    selectedModelId,
    setSelectedModelId,
    stopGenerating,
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
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      fetchQuota();
    }
  }, [loading, user]);

  useEffect(() => {
    const fetchActiveModels = async () => {
      try {
        const response = await chatModelsAPI.listActive();
        const activeList = response.data || [];
        setActiveModels(activeList);
        
        // Auto-select first active model if not already set
        if (activeList.length > 0 && !selectedModelId) {
          setSelectedModelId(activeList[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch active models for chat dropdown:', err);
      }
    };
    if (user) {
      fetchActiveModels();
    }
  }, [user, setSelectedModelId, selectedModelId]);

  useEffect(() => {
    // Handle suggested questions from MessageList and MessageItem
    const handleSuggestedQuestion = async (e: CustomEvent) => {
      const question = e.detail;
      setInputMessage('');
      try {
        await sendMessage(question);
      } catch (error) {
        console.error('Failed to send suggested question:', error);
      }
    };

    window.addEventListener('suggestedQuestion', handleSuggestedQuestion as EventListener);
    return () => {
      window.removeEventListener('suggestedQuestion', handleSuggestedQuestion as EventListener);
    };
  }, [sendMessage]);

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

  const handleRateMessage = (messageId: number, rating: number) => {
    if (rating === -1) {
      setFeedbackMessageId(messageId);
      setFeedbackCategory('');
      setFeedbackText('');
      setShowFeedbackModal(true);
    } else {
      rateMessage(messageId, rating);
    }
  };

  const handleSubmitFeedback = async () => {
    if (feedbackMessageId === null) return;
    try {
      await rateMessage(feedbackMessageId, -1, feedbackText, feedbackCategory);
      setShowFeedbackModal(false);
      setFeedbackMessageId(null);
      setFeedbackCategory('');
      setFeedbackText('');
    } catch (err) {
      console.error('Failed to submit feedback text:', err);
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
            {(isAdmin || isCompanyAdmin) && (
              <button
                onClick={() => {
                  if (isAdmin && (user?.tenant_id === null || user?.tenant_id === undefined)) {
                    router.push('/superadmin');
                  } else {
                    router.push('/admin/dashboard');
                  }
                }}
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
            {!isAdmin && !isCompanyAdmin && (
              <button
                onClick={() => router.push('/dashboard')}
                className={cn(
                  "w-full flex items-center border border-hairline text-ink-muted hover:text-brand-lavender hover:bg-surface-2 transition-all mb-1 group rounded-md",
                  sidebarOpen ? "gap-3 p-2.5" : "justify-center p-2.5 px-0"
                )}
                title={!sidebarOpen ? "Dashboard cá nhân" : ""}
              >
                <BarChart3 size={16} className={cn("shrink-0 group-hover:scale-105 transition-transform")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-xs font-medium whitespace-nowrap"
                    >
                      📊 Dashboard
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
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
                <div className="flex items-center justify-center gap-3 mt-1">
                  {/* Model Selector Dropdown */}
                  {activeModels.length > 0 && (
                    <div className="flex items-center gap-1 bg-surface-2 border border-hairline rounded-md px-2 py-0.5 hover:border-brand-lavender/50 transition-all">
                      <Cpu size={10} className="text-brand-lavender shrink-0" />
                      <select
                        value={selectedModelId || ''}
                        onChange={(e) => setSelectedModelId(e.target.value ? parseInt(e.target.value) : null)}
                        className="text-[9px] font-bold uppercase tracking-widest text-ink-subtle bg-transparent outline-none cursor-pointer hover:text-brand-lavender transition-colors max-w-[150px] truncate"
                      >
                        {activeModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-surface-3 text-ink text-[10px]">
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Response Style Selector */}
                  <select
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value as any)}
                    className="text-[9px] font-bold uppercase tracking-widest text-ink-subtle bg-surface-2 border border-hairline rounded-md px-2 py-0.5 outline-none cursor-pointer hover:text-brand-lavender transition-colors"
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
              onRateMessage={handleRateMessage}
              onSetFeedback={setFeedback}
              onShowSource={handleShowSource}
              messagesEndRef={messagesEndRef}
              ratingMessageId={ratingMessageId}
            />

            {/* Input */}
            <ChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSubmit={handleSendMessage}
              onStop={stopGenerating}
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

      {/* Premium Quota Modal */}
      <AnimatePresence>
        {quotaReached && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white rounded-[2.5rem] p-8 border border-white/10 shadow-2xl max-w-md w-full relative overflow-hidden text-center"
            >
              {/* Decorative backgrounds */}
              <div className="absolute -right-16 -top-16 w-36 h-36 bg-brand-lavender/20 rounded-full blur-3xl" />
              <div className="absolute -left-16 -bottom-16 w-36 h-36 bg-cyan-500/20 rounded-full blur-3xl" />

              <button
                onClick={() => setQuotaReached(false)}
                className="absolute right-6 top-6 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={18} />
              </button>

              <div className="w-16 h-16 bg-gradient-to-tr from-brand-lavender to-violet-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/30 ring-4 ring-white/10 animate-bounce">
                <Sparkles size={32} className="text-white animate-pulse" />
              </div>

              <h3 className="text-2xl font-be-vietnam font-bold mb-3 bg-gradient-to-r from-white via-indigo-200 to-brand-lavender bg-clip-text text-transparent">
                Hạn ngạch giới hạn
              </h3>
              
              <p className="text-slate-300 text-sm leading-relaxed mb-8 px-2">
                Bạn đã sử dụng hết hạn ngạch 10 câu hỏi/ngày của gói Free. Vui lòng nâng cấp lên gói Pro để tiếp tục trò chuyện không giới hạn và mở khóa các tính năng AI nâng cao!
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setQuotaReached(false);
                    router.push('/pricing');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-brand-lavender to-violet-600 hover:from-brand-lavender/90 hover:to-violet-600/90 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 text-sm tracking-wide"
                >
                  <span>Nâng cấp PRO ngay ⚡</span>
                </button>
                
                <button
                  onClick={() => setQuotaReached(false)}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold rounded-2xl transition-all text-xs"
                >
                  Xem lại lịch sử chat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-slate-900/90 text-white rounded-3xl p-6 border border-white/10 shadow-2xl max-w-md w-full relative overflow-hidden backdrop-blur-xl"
            >
              {/* Radial gradient background decoration */}
              <div className="absolute -right-20 -top-20 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-44 h-44 bg-brand-lavender/10 rounded-full blur-3xl pointer-events-none" />

              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackMessageId(null);
                  setFeedbackCategory('');
                }}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center justify-center text-rose-400 shrink-0">
                  <ThumbsDown size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-be-vietnam font-bold text-white">Góp ý câu trả lời lỗi</h3>
                  <p className="text-xs text-slate-400">Giúp chúng tôi cải thiện chất lượng tri thức hệ thống</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Error Classification / Category */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">1. Phân loại lỗi (Bắt buộc)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Thông tin sai lệch",
                      "Thiếu thông tin quan trọng",
                      "Nguồn trích dẫn sai",
                      "Dịch thuật / Từ ngữ",
                      "Lặp lại / Lan man",
                      "Lý do khác"
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFeedbackCategory(cat)}
                        className={cn(
                          "text-left text-[11px] px-3 py-2 border rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-between",
                          feedbackCategory === cat
                            ? "bg-brand-lavender/20 border-brand-lavender text-brand-lavender font-semibold"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10"
                        )}
                      >
                        <span>{cat}</span>
                        {feedbackCategory === cat && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description Textarea */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">2. Mô tả chi tiết lỗi</label>
                  <textarea
                    rows={4}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Nhập chi tiết lỗi (ví dụ: thông tin bị sai ở dòng nào, hoặc câu trả lời đúng nên là gì...)"
                    className="w-full bg-slate-950/50 border border-white/10 hover:border-white/20 focus:border-brand-lavender rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-brand-lavender/30 placeholder-slate-500 transition-all resize-none custom-scrollbar"
                  />
                </div>

                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFeedbackModal(false);
                      setFeedbackMessageId(null);
                      setFeedbackCategory('');
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-150 text-center"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={!feedbackCategory}
                    onClick={handleSubmitFeedback}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] text-center",
                      feedbackCategory 
                        ? "bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-500/90 hover:to-rose-600/90 text-white shadow-lg shadow-rose-500/10 cursor-pointer"
                        : "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                    )}
                  >
                    Gửi góp ý
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multi-modal Citation Source Viewer Modal */}
      <AnimatePresence>
        {citationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-slate-900/90 text-white rounded-[2rem] p-6 md:p-8 border border-white/10 shadow-2xl max-w-5xl w-full h-[85vh] flex flex-col relative overflow-hidden backdrop-blur-xl"
            >
              {/* Decorative backgrounds */}
              <div className="absolute -right-20 -top-20 w-48 h-48 bg-brand-lavender/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 shrink-0 z-10">
                <div>
                  <h3 className="text-lg md:text-xl font-be-vietnam font-bold text-white flex items-center gap-2">
                    <FileText size={20} className="text-brand-lavender" /> 
                    Nguồn trích dẫn: {citationData?.original_name || 'Đang tải...'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Trang số: <span className="font-bold text-brand-lavender text-sm">{citationData?.page_number || '...'}</span> của tài liệu gốc
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCitationModalOpen(false);
                    setCitationData(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto min-h-0 z-10 custom-scrollbar">
                {citationLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-brand-lavender border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-400 font-medium">Đang trích xuất nội dung trang PDF gốc...</p>
                  </div>
                ) : citationData ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
                    
                    {/* Cột 1: Nội dung văn bản Markdown gốc (8/12) */}
                    <div className="lg:col-span-8 bg-slate-950/40 border border-white/5 rounded-2xl p-6 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-white/5 shrink-0">
                        <Sparkles size={12} className="text-brand-lavender" /> Văn bản trích xuất ({citationData.chunks.length} đoạn)
                      </h4>
                      <div className="flex-1 space-y-6 text-sm text-slate-300 leading-relaxed font-medium">
                        {citationData.chunks.length > 0 ? (
                          citationData.chunks.map((chunk: any, i: number) => (
                            <div key={chunk.id || i} className="pb-4 border-b border-white/5 last:border-none">
                              <span className="text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10 px-2 py-0.5 rounded mr-2 uppercase tracking-widest">
                                Chunk #{i+1} - {chunk.element_type || 'narrative'}
                              </span>
                              <div className="mt-3 text-slate-200">
                                <MarkdownRenderer content={chunk.content} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500 italic text-center py-10">Không tìm thấy nội dung văn bản cho trang này.</p>
                        )}
                      </div>
                    </div>

                    {/* Cột 2: Hình ảnh trích xuất của trang PDF (4/12) */}
                    <div className="lg:col-span-4 bg-slate-950/40 border border-white/5 rounded-2xl p-6 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-white/5 shrink-0">
                        📸 Hình ảnh trích xuất ({citationData.images.length})
                      </h4>
                      <div className="flex-1 space-y-4">
                        {citationData.images.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4">
                            {citationData.images.map((imgUrl: string, idx: number) => (
                              <div key={idx} className="group relative bg-slate-900 border border-white/5 rounded-xl overflow-hidden shadow-md hover:border-brand-lavender/40 transition-all duration-300">
                                <img 
                                  src={`http://localhost:8000${imgUrl}`} 
                                  alt={`Hình ảnh trang ${citationData.page_number}`}
                                  className="w-full object-contain max-h-[220px] mx-auto p-2 group-hover:scale-[1.02] transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                                  <span className="text-[10px] font-bold uppercase text-white bg-brand-lavender px-2 py-1 rounded shadow">
                                    Click để mở tab xem kích thước gốc
                                  </span>
                                </div>
                                <a 
                                  href={`http://localhost:8000${imgUrl}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="absolute inset-0"
                                  title="Xem ảnh kích thước đầy đủ"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-2 text-slate-500">
                            <span className="text-3xl mb-2">📷</span>
                            <p className="text-xs italic">Trang này không phát hiện hoặc trích xuất thấy hình ảnh/sơ đồ nào.</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <p className="text-slate-500 italic text-center py-10">Không có dữ liệu.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
