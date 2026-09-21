import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X, LogIn, LogOut, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import type { ConversationMeta } from '../lib/types';
import { useAuth } from '../contexts/useAuth';

interface Props {
  conversations: ConversationMeta[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
}

export default function Sidebar({ conversations, activeId, open, onClose, onSelect, onNew, onRename, onDelete, onOpenSettings, onOpenAuth }: Props) {
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim().slice(0, 120));
    setEditingId(null);
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed z-40 flex h-[100dvh] w-[280px] flex-col border-r border-white/10 bg-[#0c0c16] transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-black">OZ</div>
            <span className="font-display text-lg font-semibold tracking-tight text-white">OZLIND</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={onNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-transform active:scale-[0.98]"
          >
            <Plus size={16} /> New chat
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
            <Search size={14} className="text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search conversations"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" aria-label="Conversation history">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-white/30">{query ? 'No matching chats.' : 'No conversations yet.'}</p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${activeId === c.id ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
            >
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                />
              ) : (
                <button onClick={() => onSelect(c.id)} className="flex-1 truncate text-left">
                  {c.title || 'New chat'}
                </button>
              )}
              {editingId !== c.id && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => startRename(c.id, c.title)} aria-label="Rename" className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmId(c.id)} aria-label="Delete" className="rounded p-1 text-white/40 hover:bg-red-500/20 hover:text-red-300">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
              {confirmId === c.id && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#161622] p-2 text-xs shadow-xl">
                  <p className="mb-2 text-white/70">Delete this chat permanently?</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConfirmId(null)} className="rounded px-2 py-1 text-white/50 hover:bg-white/10">Cancel</button>
                    <button
                      onClick={() => { onDelete(c.id); setConfirmId(null); }}
                      className="rounded bg-red-500/80 px-2 py-1 font-medium text-white hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button onClick={onOpenSettings} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <SettingsIcon size={16} /> Settings
          </button>
          {user ? (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg px-2.5 py-2">
              <div className="flex items-center gap-2 truncate">
                <Sparkles size={14} className="text-violet-300" />
                <span className="truncate text-xs text-white/60">{user.email}</span>
              </div>
              <button onClick={() => signOut()} aria-label="Sign out" className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
              <LogIn size={16} /> Sign in
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
