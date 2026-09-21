import React, { useState } from 'react';
import { 
  MessageSquare, 
  Compass, 
  Cpu, 
  Settings, 
  Plus, 
  Pin, 
  Trash2, 
  Pen, 
  Check, 
  X, 
  Search, 
  LogOut 
} from 'lucide-react';
import OzlindLogo from './OzlindLogo';

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  model_mode: string;
  created_at?: string;
  updated_at?: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  activeTab: 'chat' | 'research' | 'capabilities' | 'settings';
  onSelectTab: (tab: 'chat' | 'research' | 'capabilities' | 'settings') => void;
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

export default function Sidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  user,
  onLogout
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filtered = conversations.filter(c =>
    (c.title || 'Untitled').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pinnedConvs = filtered.filter(c => c.pinned);
  const unpinnedConvs = filtered.filter(c => !c.pinned);

  const handleStartRename = (e: React.MouseEvent, c: Conversation) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title || 'Untitled');
  };

  const handleSaveRename = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#0C0E17] border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Banner */}
        <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OzlindLogo className="w-8 h-8" glow={true} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white tracking-wide text-base">OZLIND</span>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  AI
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Created by Athul
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Conversation CTA */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onSelectTab('chat');
            }}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 transition-all duration-200 group active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Primary View Navigation */}
        <div className="px-3 py-2 space-y-1 border-b border-slate-800/60">
          <button
            onClick={() => onSelectTab('chat')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-slate-800/80 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Workspace</span>
          </button>

          <button
            onClick={() => onSelectTab('research')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'research'
                ? 'bg-slate-800/80 text-purple-400 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Deep Research</span>
          </button>

          <button
            onClick={() => onSelectTab('capabilities')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'capabilities'
                ? 'bg-slate-800/80 text-amber-400 border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <div className="flex items-center justify-between w-full">
              <span>Capabilities Hub</span>
              <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                Suite
              </span>
            </div>
          </button>
        </div>

        {/* Search Conversations */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#131622] border border-slate-800/80 text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {/* Pinned Section */}
          {pinnedConvs.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5 flex items-center gap-1">
                <Pin className="w-3 h-3 text-cyan-400" />
                <span>Pinned Conversations</span>
              </div>
              <div className="space-y-1">
                {pinnedConvs.map(c => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={activeConversationId === c.id}
                    isEditing={editingId === c.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSelect={() => {
                      onSelectConversation(c.id);
                      onSelectTab('chat');
                    }}
                    onStartRename={e => handleStartRename(e, c)}
                    onSaveRename={e => handleSaveRename(e, c.id)}
                    onCancelRename={handleCancelRename}
                    onTogglePin={e => {
                      e.stopPropagation();
                      onTogglePin(c.id, !c.pinned);
                    }}
                    onDelete={e => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-2 mb-1.5">
              Recent Activity
            </div>
            {unpinnedConvs.length === 0 ? (
              <div className="text-center py-6 px-2 text-xs text-slate-600">
                {searchTerm ? 'No matching chats found' : 'No conversations yet'}
              </div>
            ) : (
              <div className="space-y-1">
                {unpinnedConvs.map(c => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={activeConversationId === c.id}
                    isEditing={editingId === c.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSelect={() => {
                      onSelectConversation(c.id);
                      onSelectTab('chat');
                    }}
                    onStartRename={e => handleStartRename(e, c)}
                    onSaveRename={e => handleSaveRename(e, c.id)}
                    onCancelRename={handleCancelRename}
                    onTogglePin={e => {
                      e.stopPropagation();
                      onTogglePin(c.id, !c.pinned);
                    }}
                    onDelete={e => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Settings & User Bar */}
        <div className="p-3 border-t border-slate-800/60 bg-[#0A0C14] space-y-1">
          <button
            onClick={() => onSelectTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-800/80 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings & Memory</span>
          </button>

          <div className="pt-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-200 truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Athul'}
                </p>
                <p className="text-[10px] text-cyan-400 font-semibold">
                  OZLIND Pro Tier
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: (e: React.MouseEvent | React.KeyboardEvent) => void;
  onCancelRename: (e: React.MouseEvent | React.KeyboardEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ConversationItem({
  conv,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onTogglePin,
  onDelete
}: ConversationItemProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          className="flex-1 bg-transparent text-xs text-white px-2 py-1 outline-none"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') onSaveRename(e);
            if (e.key === 'Escape') onCancelRename(e);
          }}
        />
        <button
          onClick={onSaveRename}
          className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCancelRename}
          className="p-1 text-slate-400 hover:bg-slate-700 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
        isActive
          ? 'bg-slate-800/90 text-white font-semibold border border-slate-700/60 shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
      }`}
    >
      <div className="flex items-center gap-2.5 truncate pr-12">
        <MessageSquare
          className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}
        />
        <span className="truncate">{conv.title || 'Untitled Chat'}</span>
      </div>

      <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0C0E17]/95 px-1 py-0.5 rounded-md">
        <button
          onClick={onTogglePin}
          title={conv.pinned ? 'Unpin' : 'Pin'}
          className={`p-1 rounded hover:bg-slate-700/80 cursor-pointer ${
            conv.pinned ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Pin className="w-3 h-3" />
        </button>
        <button
          onClick={onStartRename}
          title="Rename"
          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700/80 rounded cursor-pointer"
        >
          <Pen className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 rounded cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
