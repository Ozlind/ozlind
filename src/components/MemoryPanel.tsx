import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Memory {
  id: number;
  content: string;
  enabled: boolean;
  created_at: string;
}

export default function MemoryPanel() {
  const { session } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMemories = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/memories', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMemories(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const addMemory = async () => {
    if (!newMemory.trim() || !session?.access_token) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: newMemory.trim() }),
      });
      if (res.ok) {
        setNewMemory('');
        fetchMemories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMemory = async (id: number, enabled: boolean) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      if (res.ok) fetchMemories();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMemory = async (id: number) => {
    if (!session?.access_token) return;
    if (!confirm('Delete this memory?')) return;
    try {
      const res = await fetch(`/api/memories?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) fetchMemories();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="text-xs text-ozlind-muted">
        Memories are injected into every conversation to personalize responses. Only enabled memories are used.
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newMemory}
          onChange={e => setNewMemory(e.target.value)}
          placeholder="Add a memory..."
          onKeyDown={e => e.key === 'Enter' && addMemory()}
          className="flex-1 px-3 py-2 rounded-lg bg-ozlind-dark border border-ozlind-border text-xs focus:border-ozlind-cyan focus:outline-none"
        />
        <button
          onClick={addMemory}
          disabled={!newMemory.trim()}
          className="px-3 py-2 rounded-lg bg-ozlind-cyan/10 border border-ozlind-cyan/30 text-ozlind-cyan hover:bg-ozlind-cyan/20 transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ozlind-cyan" />
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-6 text-ozlind-muted text-xs">No memories yet</div>
      ) : (
        <div className="space-y-2">
          {memories.map(m => (
            <div
              key={m.id}
              className={`p-3 rounded-lg border text-xs transition-colors ${m.enabled ? 'bg-ozlind-dark border-ozlind-border' : 'bg-ozlind-dark/50 border-ozlind-border/50 opacity-60'}`}
            >
              <p className="mb-2 leading-relaxed">{m.content}</p>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleMemory(m.id, m.enabled)}
                  className="flex items-center gap-1 text-ozlind-muted hover:text-ozlind-cyan transition-colors"
                  title={m.enabled ? 'Disable' : 'Enable'}
                >
                  {m.enabled ? <ToggleRight size={14} className="text-ozlind-cyan" /> : <ToggleLeft size={14} />}
                  {m.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => deleteMemory(m.id)}
                  className="p-1 rounded text-ozlind-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
