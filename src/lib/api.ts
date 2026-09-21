import type { AttachmentDescriptor, ChatMessage, HealthServices, Mode, Settings, SourceCard } from './types';

export interface StreamChatArgs {
  message: string;
  mode: Mode;
  history: { role: 'user' | 'assistant'; content: string }[];
  attachments: AttachmentDescriptor[];
  settings: Settings;
  sources?: SourceCard[];
  signal: AbortSignal;
  onMode?: (mode: string) => void;
  onDelta: (text: string) => void;
  onDone: (info: { mode: string; sources: SourceCard[] }) => void;
  onError: (info: { error: string; code?: string }) => void;
}

export async function streamChat(args: StreamChatArgs): Promise<void> {
  const { message, mode, history, attachments, settings, sources, signal, onMode, onDelta, onDone, onError } = args;

  const body = {
    message,
    mode,
    history: settings.memoryEnabled ? history : [],
    attachments,
    sources,
    settings: {
      style: settings.responseStyle,
      length: settings.responseLength,
      customInstructions: settings.customInstructions,
      researchEnabled: settings.researchEnabled,
    },
  };

  let resp: Response;
  try {
    resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return;
    onError({ error: 'Could not reach the server. Check your connection and try again.', code: 'network' });
    return;
  }

  if (!resp.ok) {
    let message2 = 'The request could not be processed.';
    try {
      const j = await resp.json();
      if (j?.error) message2 = j.error;
    } catch { /* ignore */ }
    onError({ error: message2, code: String(resp.status) });
    return;
  }
  if (!resp.body) {
    onError({ error: 'Streaming is not supported by this connection.', code: 'no_stream' });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }
        if (typeof json.delta === 'string') onDelta(json.delta);
        else if (typeof json.mode === 'string' && !json.done) onMode?.(json.mode);
        else if (json.done) onDone({ mode: String(json.mode || ''), sources: (json.sources as SourceCard[]) || [] });
        else if (json.error) onError({ error: String(json.error), code: json.code ? String(json.code) : undefined });
      }
    }
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return;
    onError({ error: 'The connection was interrupted. Please try again.', code: 'network' });
  }
}

export async function fetchHealth(): Promise<HealthServices | null> {
  try {
    const resp = await fetch('/api/health');
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.services as HealthServices;
  } catch {
    return null;
  }
}

export async function fetchResearch(query: string): Promise<{ configured: boolean; sources: SourceCard[]; message?: string }> {
  const resp = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Research failed.');
  return data;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File): Promise<AttachmentDescriptor> {
  const base64 = await fileToBase64(file);
  const resp = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, fileBase64: base64, contentType: file.type }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Upload failed.');
  if (data.kind === 'image') {
    return { kind: 'image', mimeType: data.mimeType, base64: data.base64, fileName: data.fileName, previewUrl: `data:${data.mimeType};base64,${data.base64}` };
  }
  return { kind: 'text', text: data.text, fileName: data.fileName };
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiListConversations(token: string) {
  const resp = await fetch('/api/conversations', { headers: authHeaders(token) });
  if (!resp.ok) throw new Error('Could not load conversations.');
  return resp.json();
}

export async function apiCreateConversation(token: string, title: string) {
  const resp = await fetch('/api/conversations', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ title }) });
  if (!resp.ok) throw new Error('Could not create conversation.');
  return resp.json();
}

export async function apiUpdateConversation(token: string, id: string, title?: string) {
  const resp = await fetch('/api/conversations', { method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ id, title }) });
  if (!resp.ok) throw new Error('Could not update conversation.');
  return resp.json();
}

export async function apiDeleteConversation(token: string, id: string) {
  const resp = await fetch('/api/conversations', { method: 'DELETE', headers: authHeaders(token), body: JSON.stringify({ id }) });
  if (!resp.ok) throw new Error('Could not delete conversation.');
  return resp.json();
}

export async function apiListMessages(token: string, conversationId: string): Promise<ChatMessage[]> {
  const resp = await fetch(`/api/messages?conversation_id=${encodeURIComponent(conversationId)}`, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error('Could not load messages.');
  const rows = await resp.json();
  return rows.map((r: { id: string; role: 'user' | 'assistant'; content: string; metadata?: { sources?: SourceCard[] }; created_at: string }) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
    sources: r.metadata?.sources,
    status: 'done' as const,
  }));
}

export async function apiCreateMessage(token: string, conversationId: string, role: 'user' | 'assistant', content: string, metadata?: Record<string, unknown>) {
  const resp = await fetch('/api/messages', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ conversation_id: conversationId, role, content, metadata }) });
  if (!resp.ok) throw new Error('Could not save message.');
  return resp.json();
}

export async function apiDeleteMessages(token: string, ids: string[]) {
  if (ids.length === 0) return;
  const resp = await fetch('/api/messages', { method: 'DELETE', headers: authHeaders(token), body: JSON.stringify({ ids }) });
  if (!resp.ok) throw new Error('Could not delete messages.');
}

export async function apiGetSettings(token: string) {
  const resp = await fetch('/api/settings', { headers: authHeaders(token) });
  if (!resp.ok) throw new Error('Could not load settings.');
  return resp.json();
}

export async function apiUpdateSettings(token: string, patch: Record<string, unknown>) {
  const resp = await fetch('/api/settings', { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(patch) });
  if (!resp.ok) throw new Error('Could not save settings.');
  return resp.json();
}

export async function apiSyncProfile(token: string) {
  try {
    await fetch('/api/profile', { method: 'POST', headers: authHeaders(token) });
  } catch {
    /* best effort */
  }
}
