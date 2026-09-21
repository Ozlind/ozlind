import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Compass, 
  ShieldCheck, 
  Eye, 
  CheckCircle2, 
  ArrowRight,
  Clock
} from 'lucide-react';
import Sidebar, { Conversation } from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import ChatMessage, { Message, Attachment } from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import ResearchView from './ResearchView';
import CapabilitiesHub from './CapabilitiesHub';
import SettingsView from './SettingsView';
import OzlindLogo from '../components/OzlindLogo';
import { useAuth } from '../contexts/AuthContext';

export default function Workspace() {
  const { user, isDemo, logout, session } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'research' | 'capabilities' | 'settings'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState('smart');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const token = session?.access_token || 'demo-token';

  // 1. Fetch conversations on load
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
        if (data && data.length > 0 && !activeConversationId) {
          setActiveConversationId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    }
  };

  // 2. Fetch messages for active conversation
  const fetchMessages = async (conversationId: string) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/messages?conversation_id=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [token]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, token]);

  // Handle new conversation
  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'New Conversation',
          model_mode: mode
        })
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Delete conversation error:', err);
    }
  };

  // Handle rename conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, title: newTitle })
      });
      if (res.ok) {
        const updated = await res.json();
        setConversations(prev => prev.map(c => (c.id === id ? updated : c)));
      }
    } catch (err) {
      console.error('Rename conversation error:', err);
    }
  };

  // Handle pin toggle
  const handleTogglePin = async (id: string, pinned: boolean) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, pinned })
      });
      if (res.ok) {
        fetchConversations();
      }
    } catch (err) {
      console.error('Pin conversation error:', err);
    }
  };

  // Handle user send message
  const handleSendMessage = async ({
    content,
    attachments
  }: {
    content: string;
    attachments: Attachment[];
  }) => {
    let convId = activeConversationId;

    // Create a new conversation if none active
    if (!convId) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: content.substring(0, 30) || 'New Chat',
            model_mode: mode
          })
        });
        if (res.ok) {
          const newConv = await res.json();
          convId = newConv.id;
          setActiveConversationId(newConv.id);
          setConversations(prev => [newConv, ...prev]);
        }
      } catch (err) {
        console.error('Auto create conversation failed:', err);
      }
    }

    const userMsg: Message = {
      conversation_id: convId || undefined,
      role: 'user',
      content,
      attachments
    };

    setMessages(prev => [...prev, { ...userMsg, created_at: new Date().toISOString() }]);

    // Persist user message to Supabase
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userMsg)
      });
    } catch (err) {
      console.error('Save user msg error:', err);
    }

    // Trigger AI response
    setIsGenerating(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content }],
          mode,
          attachments,
          webSearch: webSearchEnabled
        })
      });

      if (!res.ok) throw new Error('AI Router response failed');
      const aiData = await res.json();

      const assistantMsg: Message = {
        conversation_id: convId || undefined,
        role: 'assistant',
        content: aiData.content,
        sources: aiData.sources || []
      };

      setMessages(prev => [...prev, { ...assistantMsg, created_at: new Date().toISOString() }]);

      // Persist AI message to Supabase
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(assistantMsg)
      });

      // Update conversation title if provided
      if (aiData.autoTitle && convId) {
        handleRenameConversation(convId, aiData.autoTitle);
      }
    } catch (err) {
      console.error('AI Routing Error:', err);
      const fallbackMsg: Message = {
        role: 'assistant',
        content:
          'OZLIND AI encountered a network glitch, but your workspace context remains securely saved. Please try submitting your message again.'
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#090A0F] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={id => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activeTab={activeTab}
          isDemo={isDemo}
          user={user}
        />

        {/* Dynamic Views */}
        {activeTab === 'research' && (
          <ResearchView onStartResearch={() => {}} />
        )}

        {activeTab === 'capabilities' && (
          <CapabilitiesHub />
        )}

        {activeTab === 'settings' && (
          <SettingsView user={user} />
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {messages.length === 0 ? (
                <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="max-w-xl space-y-6">
                    <OzlindLogo className="w-16 h-16 mx-auto" glow={true} />
                    <div className="space-y-2">
                      <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        Welcome to OZLIND AI
                      </h1>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        Your unified AI workspace engineered for high-performance reasoning, autonomous deep web research, and multimodal intelligence. Owned and created by Athul.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                      <div className="p-4 rounded-2xl bg-[#0E101A] border border-slate-800 hover:border-cyan-500/40 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-xs text-cyan-400 mb-1">
                          <Sparkles className="w-4 h-4" />
                          <span>Intelligent Model Router</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Automatically switches reasoning depth and pipeline based on input complexity.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#0E101A] border border-slate-800 hover:border-purple-500/40 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-xs text-purple-400 mb-1">
                          <Compass className="w-4 h-4" />
                          <span>Autonomous Web Research</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Parses live web repositories with verified inline citation sources.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#0E101A] border border-slate-800 hover:border-emerald-500/40 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 mb-1">
                          <Eye className="w-4 h-4" />
                          <span>Multimodal File Vision</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Inspect images, diagrams, and documents with optical detail extraction.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#0E101A] border border-slate-800 hover:border-amber-500/40 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-400 mb-1">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Zero-Key Client Leakage</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Strict server-side isolation protects your private keys and data.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/30">
                  {messages.map((msg, idx) => (
                    <ChatMessage key={idx} message={msg} />
                  ))}

                  {isGenerating && (
                    <div className="py-5 px-4 md:px-6 bg-[#0E101A] border-y border-slate-800/40">
                      <div className="max-w-4xl mx-auto flex items-center gap-3">
                        <OzlindLogo className="w-6 h-6 animate-pulse" glow={false} />
                        <span className="text-xs font-semibold text-cyan-400 animate-pulse">
                          OZLIND Core is processing response...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ChatInput
              onSendMessage={handleSendMessage}
              isGenerating={isGenerating}
              onStopGeneration={() => setIsGenerating(false)}
              mode={mode}
              setMode={setMode}
              webSearchEnabled={webSearchEnabled}
              setWebSearchEnabled={setWebSearchEnabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}
