import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Trash2, Pin, Search, Settings, Brain, Image, Mic, FileCode, PenTool, X } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import MemoryPanel from './MemoryPanel';

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
}

export default function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { user, session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'settings' | 'memory'>('chats');
  const [activeConv, setActiveConv] = useState<number | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const deleteConv = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    if (!confirm('Delete this conversation?')) return;
    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePin = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    const conv = conversations.find(c => c.id === id);
    try {
      const res = await fetch('/api/conversations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, pinned: !conv?.pinned }),
      });
      if (res.ok) fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const comingSoonFeatures = [
    { icon: Image, label: 'Image Studio' },
    { icon: Mic, label: 'Voice' },
    { icon: FileCode, label: 'Code Assistant' },
    { icon: PenTool, label: 'Photo Editor' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-ozlind-border">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-2 text-xs font-medium ${activeTab === 'chats' ? 'text-ozlind-cyan border-b-2 border-ozlind-cyan' : 'text-ozlind-muted hover:text-ozlind-text'}`}
        >
          Chats
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex-1 py-2 text-xs font-medium ${activeTab === 'memory' ? 'text-ozlind-cyan border-b-2 border-ozlind-cyan' : 'text-ozlind-muted hover:text-ozlind-text'}`}
        >
          <Brain size={12} className="inline mr-1" />
          Memory
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 text-xs font-medium ${activeTab === 'settings' ? 'text-ozlind-cyan border-b-2 border-ozlind-cyan' : 'text-ozlind-muted hover:text-ozlind-text'}`}
        >
          <Settings size={12} className="inline mr-1" />
        </button>
      </div>

      {activeTab === 'chats' && (
        <>
          <div className="p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ozlind-muted" />
              <input
                type="text"
                placeholder="Search chats..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-ozlind-dark border border-ozlind-border text-xs focus:border-ozlind-cyan focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ozlind-muted">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ozlind-cyan" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-ozlind-muted text-xs">
                {search ? 'No chats found' : 'No chats yet'}
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConv(conv.id);
                    window.dispatchEvent(new CustomEvent('load-conversation', { detail: conv.id }));
                    onNavigate();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 group transition-colors ${activeConv === conv.id ? 'bg-ozlind-cyan/10 border border-ozlind-cyan/20' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={14} className="mt-0.5 text-ozlind-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{conv.title}</p>
                      <p className="text-[10px] text-ozlind-muted mt-0.5">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => togglePin(conv.id, e)}
                        className={`p-1 rounded ${conv.pinned ? 'text-ozlind-cyan' : 'text-ozlind-muted hover:text-ozlind-text'}`}
                        title={conv.pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin size={12} />
                      </button>
                      <button
                        onClick={(e) => deleteConv(conv.id, e)}
                        className="p-1 rounded text-ozlind-muted hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </button>
              ))
            )}

            {/* Coming soon tools */}
            <div className="mt-4 pt-4 border-t border-ozlind-border">
              <p className="text-[10px] uppercase tracking-wider text-ozlind-muted mb-2 px-1">Coming Soon</p>
              {comingSoonFeatures.map(f => (
                <div key={f.label} className="flex items-center gap-2 px-3 py-2 text-xs text-ozlind-muted opacity-60">
                  <f.icon size={14} />
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'memory' && <MemoryPanel />}
      {activeTab === 'settings' && <SettingsPanel />}
    </div>
  );
}
