import { useState } from 'react';
import { X, Sun, Moon, Monitor, LogOut } from 'lucide-react';
import type { Settings } from '../lib/types';
import { useAuth } from '../contexts/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onOpenAuth: () => void;
}

type Tab = 'appearance' | 'behavior' | 'response' | 'account' | 'shortcuts';

const TABS: { id: Tab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'response', label: 'Response' },
  { id: 'account', label: 'Account' },
  { id: 'shortcuts', label: 'Shortcuts' },
];

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-white text-black' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export default function SettingsDialog({ open, onClose, settings, onChange, onOpenAuth }: Props) {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('appearance');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#12121c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {tab === 'appearance' && (
            <div className="space-y-3">
              <p className="font-medium text-white">Theme</p>
              <div className="flex gap-1 rounded-xl bg-white/5 p-1">
                <SegButton active={settings.theme === 'light'} onClick={() => onChange({ theme: 'light' })}><span className="flex items-center justify-center gap-1.5"><Sun size={14} />Light</span></SegButton>
                <SegButton active={settings.theme === 'dark'} onClick={() => onChange({ theme: 'dark' })}><span className="flex items-center justify-center gap-1.5"><Moon size={14} />Dark</span></SegButton>
                <SegButton active={settings.theme === 'system'} onClick={() => onChange({ theme: 'system' })}><span className="flex items-center justify-center gap-1.5"><Monitor size={14} />System</span></SegButton>
              </div>
            </div>
          )}

          {tab === 'behavior' && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 font-medium text-white">Preferred mode</p>
                <div className="flex flex-wrap gap-1 rounded-xl bg-white/5 p-1">
                  {(['auto', 'fast', 'pro', 'vision', 'research'] as const).map((m) => (
                    <SegButton key={m} active={settings.preferredMode === m} onClick={() => onChange({ preferredMode: m })}>
                      {m[0].toUpperCase() + m.slice(1)}
                    </SegButton>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-3">
                <span>
                  <span className="block font-medium text-white">Memory</span>
                  <span className="block text-xs text-white/40">Send earlier messages as context</span>
                </span>
                <input type="checkbox" checked={settings.memoryEnabled} onChange={(e) => onChange({ memoryEnabled: e.target.checked })} className="h-5 w-5 accent-violet-500" />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-3">
                <span>
                  <span className="block font-medium text-white">Prefer research by default</span>
                  <span className="block text-xs text-white/40">Auto mode leans toward web research</span>
                </span>
                <input type="checkbox" checked={settings.researchEnabled} onChange={(e) => onChange({ researchEnabled: e.target.checked })} className="h-5 w-5 accent-violet-500" />
              </label>
            </div>
          )}

          {tab === 'response' && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 font-medium text-white">Response style</p>
                <div className="flex gap-1 rounded-xl bg-white/5 p-1">
                  {(['concise', 'balanced', 'detailed'] as const).map((s) => (
                    <SegButton key={s} active={settings.responseStyle === s} onClick={() => onChange({ responseStyle: s })}>{s[0].toUpperCase() + s.slice(1)}</SegButton>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium text-white">Response length</p>
                <div className="flex gap-1 rounded-xl bg-white/5 p-1">
                  {(['short', 'medium', 'long'] as const).map((l) => (
                    <SegButton key={l} active={settings.responseLength === l} onClick={() => onChange({ responseLength: l })}>{l[0].toUpperCase() + l.slice(1)}</SegButton>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium text-white">Custom instructions</p>
                <textarea
                  value={settings.customInstructions}
                  onChange={(e) => onChange({ customInstructions: e.target.value.slice(0, 2000) })}
                  placeholder="e.g. Always answer in a friendly, informal tone and prefer bullet points."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className="space-y-3">
              {user ? (
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs text-white/40">Signed in as</p>
                  <p className="mb-3 font-medium text-white">{user.email}</p>
                  <button onClick={() => signOut()} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="mb-3 text-white/60">You're browsing as a guest. Your chats are saved on this device only.</p>
                  <button onClick={onOpenAuth} className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white">Sign in to sync</button>
                </div>
              )}
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="space-y-2">
              {[
                ['New chat', 'Ctrl/Cmd + Shift + O'],
                ['Focus composer', 'Ctrl/Cmd + /'],
                ['Stop generating', 'Esc'],
                ['Send message', 'Enter'],
                ['New line', 'Shift + Enter'],
              ].map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <span className="text-white/70">{label}</span>
                  <kbd className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">{keys}</kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
