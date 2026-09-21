import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Save, Sun, Moon, Trash2, Download, AlertTriangle } from 'lucide-react';

interface Settings {
  mode: string;
  research_enabled: boolean;
  memory_enabled: boolean;
  style: string;
  length: string;
  instructions: string;
  theme: string;
}

const MODES = ['auto', 'fast', 'pro', 'vision', 'research'];
const STYLES = ['concise', 'balanced', 'detailed'];
const LENGTHS = ['short', 'medium', 'long'];

export default function SettingsPanel() {
  const { user, session } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    mode: 'auto',
    research_enabled: false,
    memory_enabled: false,
    style: 'balanced',
    length: 'medium',
    instructions: '',
    theme: 'dark',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.theme) {
          document.documentElement.classList.remove('dark', 'light');
          document.documentElement.classList.add(data.theme);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [session]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(settings.theme);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteAllData = async () => {
    if (!session?.access_token) return;
    if (!confirm('This will permanently delete all your conversations, messages, memories and settings. This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure?')) return;
    try {
      await fetch('/api/conversations', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // Refresh page
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const exportData = () => {
    const data = {
      settings,
      export_date: new Date().toISOString(),
      user: user?.email,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ozlind-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ozlind-muted mb-3">AI Mode</h3>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => setSettings(s => ({ ...s, mode: m }))}
              className={`px-3 py-2 rounded-lg text-xs capitalize border transition-colors ${settings.mode === m ? 'bg-ozlind-cyan/10 border-ozlind-cyan/30 text-ozlind-cyan' : 'border-ozlind-border hover:bg-white/5'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ozlind-muted mt-1.5">
          {settings.mode === 'auto' && 'Automatically selects the best model for each request'}
          {settings.mode === 'fast' && 'Always use the fastest model for quick responses'}
          {settings.mode === 'pro' && 'Use the most capable model for complex tasks'}
          {settings.mode === 'vision' && 'Optimized for images, PDFs, and files'}
          {settings.mode === 'research' && 'Search the web and synthesize current information'}
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ozlind-muted mb-3">Features</h3>
        <label className="flex items-center justify-between py-2 cursor-pointer">
          <span className="text-sm">Research mode</span>
          <input
            type="checkbox"
            checked={settings.research_enabled}
            onChange={e => setSettings(s => ({ ...s, research_enabled: e.target.checked }))}
            className="w-4 h-4 accent-ozlind-cyan"
          />
        </label>
        <label className="flex items-center justify-between py-2 cursor-pointer">
          <span className="text-sm">Memory</span>
          <input
            type="checkbox"
            checked={settings.memory_enabled}
            onChange={e => setSettings(s => ({ ...s, memory_enabled: e.target.checked }))}
            className="w-4 h-4 accent-ozlind-cyan"
          />
        </label>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ozlind-muted mb-3">Style</h3>
        <div className="flex gap-2">
          {STYLES.map(s => (
            <button
              key={s}
              onClick={() => setSettings(st => ({ ...st, style: s }))}
              className={`flex-1 px-3 py-2 rounded-lg text-xs capitalize border transition-colors ${settings.style === s ? 'bg-ozlind-cyan/10 border-ozlind-cyan/30 text-ozlind-cyan' : 'border-ozlind-border hover:bg-white/5'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ozlind-muted mb-3">Length</h3>
        <div className="flex gap-2">
          {LENGTHS.map(l => (
            <button
              key={l}
              onClick={() => setSettings(s => ({ ...s, length: l }))}
              className={`flex-1 px-3 py-2 rounded-lg text-xs capitalize border transition-colors ${settings.length === l ? 'bg-ozlind-cyan/10 border-ozlind-cyan/30 text-ozlind-cyan' : 'border-ozlind-border hover:bg-white/5'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ozlind-muted mb-3">Custom Instructions</h3>
        <textarea
          value={settings.instructions}
          onChange={e => setSettings(s => ({ ...s, instructions: e.target.value }))}
          placeholder="e.g., Always respond in bullet points..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-ozlind-dark border border-ozlind-border text-sm focus:border-ozlind-cyan focus:outline-none resize-none"
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ozlind-muted mb-3">Theme</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))}
            className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${settings.theme === 'dark' ? 'bg-ozlind-cyan/10 border-ozlind-cyan/30 text-ozlind-cyan' : 'border-ozlind-border hover:bg-white/5'}`}
          >
            <Moon size={14} /> Dark
          </button>
          <button
            onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}
            className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${settings.theme === 'light' ? 'bg-ozlind-cyan/10 border-ozlind-cyan/30 text-ozlind-cyan' : 'border-ozlind-border hover:bg-white/5'}`}
          >
            <Sun size={14} /> Light
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-ozlind-cyan/10 border border-ozlind-cyan/30 text-ozlind-cyan text-sm font-medium hover:bg-ozlind-cyan/20 transition-colors disabled:opacity-50"
      >
        {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ozlind-cyan" /> : <Save size={14} />}
        {saved ? 'Saved!' : 'Save settings'}
      </button>

      <div className="pt-4 border-t border-ozlind-border space-y-2">
        <button
          onClick={exportData}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-ozlind-border text-xs hover:bg-white/5 transition-colors"
        >
          <Download size={14} /> Export data
        </button>
        <button
          onClick={deleteAllData}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
        >
          <AlertTriangle size={14} /> Delete all data
        </button>
      </div>
    </div>
  );
}
