import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import Sidebar from './components/Sidebar';
import ChatWorkspace from './components/ChatWorkspace';
import SettingsDialog from './components/SettingsDialog';
import AuthDialog from './components/AuthDialog';
import type { AttachmentDescriptor, ChatMessage, Conversation, ConversationMeta, HealthServices, Mode, Settings } from './lib/types';
import { autoTitle, downloadMarkdown, exportConversationMarkdown, loadLocalHistory, loadLocalSettings, saveLocalHistory, saveLocalSettings, uid } from './lib/storage';
import {
  apiCreateConversation, apiCreateMessage, apiDeleteConversation, apiDeleteMessages,
  apiGetSettings, apiListConversations, apiListMessages, apiUpdateConversation, apiUpdateSettings,
  fetchHealth, streamChat,
} from './lib/api';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

interface Toast { id: string; message: string; kind: 'success' | 'error' | 'info' }

function toDbSettings(s: Settings) {
  return {
    memory_enabled: s.memoryEnabled,
    research_enabled: s.researchEnabled,
    preferred_mode: s.preferredMode,
    response_style: s.responseStyle,
    response_length: s.responseLength,
    custom_instructions: s.customInstructions,
  };
}

function fromDbSettings(row: Record<string, unknown>, current: Settings): Settings {
  return {
    ...current,
    memoryEnabled: typeof row.memory_enabled === 'boolean' ? row.memory_enabled : current.memoryEnabled,
    researchEnabled: typeof row.research_enabled === 'boolean' ? row.research_enabled : current.researchEnabled,
    preferredMode: (row.preferred_mode as Mode) || current.preferredMode,
    responseStyle: (row.response_style as Settings['responseStyle']) || current.responseStyle,
    responseLength: (row.response_length as Settings['responseLength']) || current.responseLength,
    customInstructions: typeof row.custom_instructions === 'string' ? row.custom_instructions : current.customInstructions,
  };
}

function AppInner() {
  const { user, session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;

  const [settings, setSettings] = useState<Settings>(() => loadLocalSettings());
  const [health, setHealth] = useState<HealthServices | null>(null);

  const [guestConvos, setGuestConvos] = useState<Conversation[]>(() => loadLocalHistory());
  const [authConvos, setAuthConvos] = useState<ConversationMeta[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<Mode>(settings.preferredMode);
  const [isStreaming, setIsStreaming] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const settingsRef = useRef<Settings>(settings);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const notify = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // theme
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };
    apply();
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [settings.theme]);

  // persist local settings + sync mode default
  useEffect(() => { saveLocalSettings(settings); }, [settings]);
  useEffect(() => { saveLocalHistory(guestConvos); }, [guestConvos]);

  // health check
  useEffect(() => { fetchHealth().then(setHealth); }, []);

  // load settings/conversations when auth state resolves
  useEffect(() => {
    if (authLoading) return;
    if (user && token) {
      apiGetSettings(token).then((row) => setSettings((prev) => fromDbSettings(row, prev))).catch(() => notify('Could not load your saved settings.', 'error'));
      apiListConversations(token)
        .then((rows: Array<{ id: string; title: string; created_at: string; updated_at: string }>) => {
          setAuthConvos(rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at })));
        })
        .catch(() => notify('Could not load your conversation history.', 'error'));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthConvos([]);
    }
    setActiveId(null);
    setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const conversations: ConversationMeta[] = useMemo(() => {
    if (user) return authConvos;
    return guestConvos.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [user, authConvos, guestConvos]);

  // load messages when active conversation changes
  useEffect(() => {
    if (!activeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([]);
      return;
    }
    if (user && token) {
      apiListMessages(token, activeId).then(setMessages).catch(() => notify('Could not load this conversation.', 'error'));
    } else {
      const conv = guestConvos.find((c) => c.id === activeId);
      if (conv) setMessages(conv.messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user]);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (user && token) {
        apiUpdateSettings(token, toDbSettings(next)).catch(() => notify('Could not save settings to your account.', 'error'));
      }
      return next;
    });
  };

  const touchGuestConvo = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setGuestConvos((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  const ensureConversation = useCallback(async (firstMessage: string): Promise<string> => {
    if (activeId) return activeId;
    const title = autoTitle(firstMessage);
    if (user && token) {
      const row = await apiCreateConversation(token, title);
      setAuthConvos((prev) => [{ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at }, ...prev]);
      setActiveId(row.id);
      return row.id;
    }
    const id = uid();
    const now = new Date().toISOString();
    const conv: Conversation = { id, title, messages: [], createdAt: now, updatedAt: now };
    setGuestConvos((prev) => [conv, ...prev]);
    setActiveId(id);
    return id;
  }, [activeId, user, token]);

  const persistUserMessage = useCallback(async (convId: string, msg: ChatMessage, isFirst: boolean) => {
    if (user && token) {
      try {
        const row = await apiCreateMessage(token, convId, 'user', msg.content, { attachments: msg.attachments });
        msg.id = row.id;
        if (isFirst) await apiUpdateConversation(token, convId, autoTitle(msg.content));
        else await apiUpdateConversation(token, convId);
        setAuthConvos((prev) => {
          const updated = prev.map((c) => (c.id === convId ? { ...c, title: isFirst ? autoTitle(msg.content) : c.title, updatedAt: new Date().toISOString() } : c));
          return updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        });
      } catch {
        notify('Your message could not be synced to your account.', 'error');
      }
    } else {
      touchGuestConvo(convId, (c) => ({
        ...c,
        title: isFirst ? autoTitle(msg.content) : c.title,
        messages: [...c.messages, msg],
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [user, token, touchGuestConvo, notify]);

  const persistAssistantMessage = useCallback(async (convId: string, msg: ChatMessage) => {
    if (user && token) {
      try {
        const row = await apiCreateMessage(token, convId, 'assistant', msg.content, { sources: msg.sources, mode: msg.mode });
        return row.id as string;
      } catch {
        notify('The response could not be synced to your account.', 'error');
        return msg.id;
      }
    }
    touchGuestConvo(convId, (c) => ({ ...c, messages: [...c.messages, msg], updatedAt: new Date().toISOString() }));
    return msg.id;
  }, [user, token, touchGuestConvo, notify]);

  const removeMessagesFrom = useCallback(async (convId: string, ids: string[]) => {
    if (ids.length === 0) return;
    if (user && token) {
      try { await apiDeleteMessages(token, ids); } catch { notify('Could not fully sync the edit.', 'error'); }
    } else {
      touchGuestConvo(convId, (c) => ({ ...c, messages: c.messages.filter((m) => !ids.includes(m.id)) }));
    }
  }, [user, token, touchGuestConvo, notify]);

  const runAssistantTurn = useCallback(async (convId: string, userContent: string, attachments: AttachmentDescriptor[], history: ChatMessage[]) => {
    const assistantId = uid();
    const placeholder: ChatMessage = { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString(), status: 'streaming' };
    setMessages((prev) => [...prev, placeholder]);

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    let finalContent = '';
    let finalMode = '';
    let finalSources: ChatMessage['sources'] = [];
    let erred = false;

    await streamChat({
      message: userContent,
      mode,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      attachments,
      settings: settingsRef.current,
      signal: controller.signal,
      onMode: (m) => setMessages((prev) => prev.map((x) => (x.id === assistantId ? { ...x, mode: m } : x))),
      onDelta: (delta) => {
        finalContent += delta;
        setMessages((prev) => prev.map((x) => (x.id === assistantId ? { ...x, content: x.content + delta } : x)));
      },
      onDone: (info) => {
        finalMode = info.mode;
        finalSources = info.sources;
        setMessages((prev) => prev.map((x) => (x.id === assistantId ? { ...x, status: 'done', mode: info.mode, sources: info.sources } : x)));
      },
      onError: (info) => {
        erred = true;
        setMessages((prev) => prev.map((x) => (x.id === assistantId ? { ...x, status: 'error', error: info.error } : x)));
      },
    });

    setIsStreaming(false);
    abortRef.current = null;

    const wasAborted = controller.signal.aborted;
    if (wasAborted) {
      const latest = messagesRef.current.find((x) => x.id === assistantId);
      finalContent = latest?.content ?? finalContent;
      setMessages((prev) => prev.map((x) => (x.id === assistantId ? { ...x, status: 'stopped' } : x)));
    }

    if (!erred && (finalContent || wasAborted)) {
      const finalMsg: ChatMessage = {
        id: assistantId, role: 'assistant', content: finalContent, createdAt: new Date().toISOString(),
        status: 'done', mode: finalMode, sources: finalSources,
      };
      const newId = await persistAssistantMessage(convId, finalMsg);
      if (newId !== assistantId) {
        setMessages((prev) => prev.map((x) => (x.id === assistantId ? { ...x, id: newId } : x)));
      }
    }
  }, [mode, persistAssistantMessage]);

  const sendMessage = useCallback(async (content: string, attachments: AttachmentDescriptor[]) => {
    if (isStreaming) return;
    if (!content.trim() && attachments.length === 0) return;
    try {
      const historyBefore = messagesRef.current;
      const isFirst = historyBefore.length === 0 && !activeId;
      const convId = await ensureConversation(content || 'Attachment');
      const userMsg: ChatMessage = { id: uid(), role: 'user', content, createdAt: new Date().toISOString(), attachments, status: 'done' };
      setMessages((prev) => [...prev, userMsg]);
      await persistUserMessage(convId, userMsg, isFirst);
      await runAssistantTurn(convId, content, attachments, historyBefore);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send your message.', 'error');
    }
  }, [isStreaming, activeId, ensureConversation, persistUserMessage, runAssistantTurn, notify]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(async () => {
    if (!activeId || isStreaming) return;
    const msgs = messagesRef.current;
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') { lastAssistantIdx = i; break; }
    if (lastAssistantIdx === -1) return;
    let userIdx = -1;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) if (msgs[i].role === 'user') { userIdx = i; break; }
    if (userIdx === -1) return;

    const assistantMsg = msgs[lastAssistantIdx];
    const userMsg = msgs[userIdx];
    const history = msgs.slice(0, userIdx);

    setMessages(msgs.filter((_, i) => i !== lastAssistantIdx));
    await removeMessagesFrom(activeId, [assistantMsg.id]);
    await runAssistantTurn(activeId, userMsg.content, userMsg.attachments ?? [], history);
  }, [activeId, isStreaming, removeMessagesFrom, runAssistantTurn]);

  const editMessage = useCallback(async (id: string, newContent: string) => {
    if (!activeId || isStreaming) return;
    const msgs = messagesRef.current;
    const idx = msgs.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const removedIds = msgs.slice(idx).map((m) => m.id);
    const history = msgs.slice(0, idx);
    const attachments = msgs[idx].attachments ?? [];

    setMessages(history);
    await removeMessagesFrom(activeId, removedIds);
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: newContent, createdAt: new Date().toISOString(), attachments, status: 'done' };
    setMessages((prev) => [...prev, userMsg]);
    await persistUserMessage(activeId, userMsg, history.length === 0);
    await runAssistantTurn(activeId, newContent, attachments, history);
  }, [activeId, isStreaming, removeMessagesFrom, persistUserMessage, runAssistantTurn]);

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    if (user && token) {
      try {
        await apiUpdateConversation(token, id, title);
        setAuthConvos((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      } catch { notify('Could not rename conversation.', 'error'); }
    } else {
      touchGuestConvo(id, (c) => ({ ...c, title }));
    }
  }, [user, token, touchGuestConvo, notify]);

  const deleteConversation = useCallback(async (id: string) => {
    if (user && token) {
      try {
        await apiDeleteConversation(token, id);
        setAuthConvos((prev) => prev.filter((c) => c.id !== id));
      } catch { notify('Could not delete conversation.', 'error'); }
    } else {
      setGuestConvos((prev) => prev.filter((c) => c.id !== id));
    }
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }, [user, token, activeId, notify]);

  const exportActive = useCallback(() => {
    const current = conversations.find((c) => c.id === activeId);
    if (!current) return;
    const conv: Conversation = { id: current.id, title: current.title, createdAt: current.createdAt, updatedAt: current.updatedAt, messages: messagesRef.current };
    downloadMarkdown(`${(current.title || 'ozlind-chat').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60)}.md`, exportConversationMarkdown(conv));
    notify('Conversation exported as Markdown.', 'success');
  }, [conversations, activeId, notify]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.key === 'O' || e.key === 'o')) { e.preventDefault(); newChat(); }
      else if (mod && e.key === '/') { e.preventDefault(); window.dispatchEvent(new Event('ozlind:focus-composer')); }
      else if (e.key === 'Escape' && isStreaming) { stopGeneration(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [newChat, isStreaming, stopGeneration]);

  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? '';

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#0a0a12] text-white">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectConversation}
        onNew={newChat}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
      />
      <ChatWorkspace
        title={activeTitle}
        messages={messages}
        isStreaming={isStreaming}
        mode={mode}
        onModeChange={setMode}
        health={health}
        onSend={sendMessage}
        onStop={stopGeneration}
        onRegenerate={regenerate}
        onEditMessage={editMessage}
        onOpenSidebar={() => setSidebarOpen(true)}
        onExport={exportActive}
        hasConversation={!!activeId}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        onOpenAuth={() => { setSettingsOpen(false); setAuthOpen(true); }}
      />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-2xl backdrop-blur ${
              t.kind === 'error' ? 'border-red-400/30 bg-red-950/80 text-red-100' :
              t.kind === 'success' ? 'border-emerald-400/30 bg-emerald-950/80 text-emerald-100' :
              'border-white/10 bg-[#161622]/90 text-white/90'
            }`}
          >
            {t.kind === 'error' ? <XCircle size={16} /> : t.kind === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
