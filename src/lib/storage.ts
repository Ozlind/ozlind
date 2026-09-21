import type { Conversation, Settings } from './types';

const HISTORY_KEY = 'ozlind_history_v2';
const SETTINGS_KEY = 'ozlind_settings_v2';

export const DEFAULT_SETTINGS: Settings = {
  preferredMode: 'auto',
  researchEnabled: false,
  memoryEnabled: true,
  responseStyle: 'balanced',
  responseLength: 'medium',
  customInstructions: '',
  theme: 'system',
};

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadLocalHistory(): Conversation[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveLocalHistory(conversations: Conversation[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
  } catch {
    /* storage full or unavailable - ignore */
  }
}

export function loadLocalSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLocalSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function autoTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, ' ');
  if (clean.length <= 48) return clean || 'New chat';
  return `${clean.slice(0, 48).trim()}\u2026`;
}

export function exportConversationMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title || 'OZLIND conversation'}`, ''];
  for (const m of conversation.messages) {
    lines.push(`### ${m.role === 'user' ? 'You' : 'OZLIND'}`, '');
    lines.push(m.content, '');
    if (m.sources && m.sources.length > 0) {
      lines.push('**Sources:**', '');
      m.sources.forEach((s, i) => lines.push(`${i + 1}. [${s.title}](${s.url}) — ${s.domain}`));
      lines.push('');
    }
    lines.push('---', '');
  }
  return lines.join('\n');
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
