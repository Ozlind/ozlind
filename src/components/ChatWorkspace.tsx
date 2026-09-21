import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu, Send, Square, Paperclip, X, Copy, Check, RotateCcw, Pencil,
  ChevronDown, Zap, BrainCircuit, Eye, Globe2, Sparkles, Download, ExternalLink, AlertTriangle,
} from 'lucide-react';
import type { AttachmentDescriptor, ChatMessage, HealthServices, Mode } from '../lib/types';
import MarkdownMessage from './MarkdownMessage';
import { uploadFile } from '../lib/api';

const MODES: { id: Mode; label: string; icon: typeof Zap; hint: string }[] = [
  { id: 'auto', label: 'Auto', icon: Sparkles, hint: 'Picks the best mode automatically' },
  { id: 'fast', label: 'Fast', icon: Zap, hint: 'Quick, concise answers' },
  { id: 'pro', label: 'Pro', icon: BrainCircuit, hint: 'Deeper reasoning, longer answers' },
  { id: 'vision', label: 'Vision', icon: Eye, hint: 'Understands images & screenshots' },
  { id: 'research', label: 'Research', icon: Globe2, hint: 'Searches the web, cites sources' },
];

const STARTERS = [
  { title: 'Explain a concept', prompt: 'Explain how neural networks learn, in simple terms with an analogy.' },
  { title: 'Plan something', prompt: 'Help me plan a 3-day itinerary for a first trip to Tokyo.' },
  { title: 'Latest news', prompt: 'What are the biggest AI news stories from this week?' },
  { title: 'Write & polish', prompt: 'Write a short, warm welcome email for new SaaS customers.' },
];

interface Props {
  title: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  health: HealthServices | null;
  onSend: (content: string, attachments: AttachmentDescriptor[]) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onEditMessage: (id: string, newContent: string) => void;
  onOpenSidebar: () => void;
  onExport: () => void;
  hasConversation: boolean;
}

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  if (role === 'assistant') {
    return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-bold text-black">OZ</div>;
  }
  return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80">You</div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ } }}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white"
      aria-label="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function SourceCards({ sources }: { sources: ChatMessage['sources'] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {sources.map((s, i) => (
        <a
          key={s.url + i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-violet-400/40 hover:bg-white/10"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-violet-300">[{i + 1}] {s.domain}</span>
            <ExternalLink size={12} className="text-white/30 group-hover:text-white/60" />
          </div>
          <p className="line-clamp-1 text-sm font-medium text-white/90">{s.title}</p>
          <p className="line-clamp-2 text-xs text-white/50">{s.excerpt}</p>
        </a>
      ))}
    </div>
  );
}

export default function ChatWorkspace({
  title, messages, isStreaming, mode, onModeChange, health,
  onSend, onStop, onRegenerate, onEditMessage, onOpenSidebar, onExport, hasConversation,
}: Props) {
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentDescriptor[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showJump, setShowJump] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 160) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJump(distanceFromBottom > 300);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const focusHandler = () => textareaRef.current?.focus();
    window.addEventListener('ozlind:focus-composer', focusHandler);
    return () => window.removeEventListener('ozlind:focus-composer', focusHandler);
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const activeMode = useMemo(() => MODES.find((m) => m.id === mode) ?? MODES[0], [mode]);

  const submit = () => {
    const content = input.trim();
    if (!content && pendingAttachments.length === 0) return;
    if (isStreaming) return;
    onSend(content, pendingAttachments);
    setInput('');
    setPendingAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const desc = await uploadFile(file);
        setPendingAttachments((prev) => [...prev, desc]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
    return -1;
  }, [messages]);

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditValue(m.content);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) onEditMessage(editingId, editValue.trim());
    setEditingId(null);
  };

  return (
    <div className="relative flex h-[100dvh] flex-1 flex-col overflow-hidden bg-[#0a0a12]">
      <header
        className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onOpenSidebar} aria-label="Open sidebar" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden">
            <Menu size={18} />
          </button>
          <h1 className="truncate text-sm font-medium text-white/80 sm:text-base">{title || 'New chat'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasConversation && (
            <button onClick={onExport} aria-label="Export as Markdown" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white sm:flex">
              <Download size={14} /> Export
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setModeMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <activeMode.icon size={14} className="text-violet-300" />
              {activeMode.label}
              <ChevronDown size={13} className="text-white/40" />
            </button>
            {modeMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-white/10 bg-[#12121c] p-1.5 shadow-2xl">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onModeChange(m.id); setModeMenuOpen(false); }}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white/10 ${mode === m.id ? 'bg-white/10' : ''}`}
                  >
                    <m.icon size={16} className="mt-0.5 text-violet-300" />
                    <span>
                      <span className="block text-sm font-medium text-white">{m.label}</span>
                      <span className="block text-xs text-white/40">{m.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-bold text-black shadow-lg shadow-violet-900/30">OZ</div>
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">What can I help with?</h2>
            <p className="mt-2 max-w-md text-sm text-white/50">Ask anything, drop in an image, or switch to Research for answers grounded in live sources.</p>
            <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s.title}
                  onClick={() => onSend(s.prompt, [])}
                  className="rounded-xl border border-white/10 bg-white/5 p-3.5 text-left transition-colors hover:border-violet-400/40 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">{s.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-white/40">{s.prompt}</p>
                </button>
              ))}
            </div>
            {health && !health.groq && !health.gemini && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle size={14} /> AI providers are not configured yet. Add API keys to enable responses.
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m, idx) => (
              <div key={m.id} className="flex gap-3">
                <Avatar role={m.role} />
                <div className="min-w-0 flex-1">
                  {editingId === m.id ? (
                    <div className="rounded-xl border border-violet-400/40 bg-white/5 p-2">
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={3}
                        className="w-full resize-none bg-transparent text-[15px] text-white focus:outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/10">Cancel</button>
                        <button onClick={commitEdit} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Save &amp; resend</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {m.attachments.map((a, i) => a.kind === 'image' ? (
                            <img key={i} src={a.previewUrl} alt={a.fileName} className="h-20 w-20 rounded-lg object-cover" />
                          ) : (
                            <span key={i} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white/60">{a.fileName}</span>
                          ))}
                        </div>
                      )}
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">{m.content}</p>
                      ) : m.status === 'error' ? (
                        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                          <span>{m.error || 'Something went wrong.'}</span>
                        </div>
                      ) : (
                        <>
                          <MarkdownMessage content={m.content || (m.status === 'streaming' ? '\u200b' : '')} />
                          {m.status === 'streaming' && (
                            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-white/50 align-middle" />
                          )}
                          <SourceCards sources={m.sources} />
                        </>
                      )}
                      <div className="mt-1.5 flex items-center gap-0.5">
                        {m.role === 'assistant' && m.status !== 'streaming' && m.content && <CopyButton text={m.content} />}
                        {m.role === 'user' && !isStreaming && (
                          <button onClick={() => startEdit(m)} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white" aria-label="Edit message">
                            <Pencil size={13} />
                          </button>
                        )}
                        {m.role === 'assistant' && idx === lastAssistantIndex && m.status !== 'streaming' && !isStreaming && (
                          <button onClick={onRegenerate} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white" aria-label="Regenerate response">
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {showJump && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
          className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[#161622] p-2 text-white/70 shadow-xl hover:text-white"
          aria-label="Jump to latest message"
        >
          <ChevronDown size={16} />
        </button>
      )}

      <div className="border-t border-white/10 bg-[#0a0a12] px-3 pb-3 pt-2 sm:px-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
        <div className="mx-auto max-w-3xl">
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70">
                  {a.kind === 'image' ? <img src={a.previewUrl} alt="" className="h-5 w-5 rounded object-cover" /> : <Paperclip size={12} />}
                  <span className="max-w-[140px] truncate">{a.fileName}</span>
                  <button onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove attachment">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploadError && <p className="mb-2 text-xs text-red-400">{uploadError}</p>}
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 focus-within:border-violet-400/50">
            <input ref={fileInputRef} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,text/plain,text/csv,application/pdf" onChange={(e) => handleFiles(e.target.files)} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Attach a file"
              className="shrink-0 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message OZLIND…"
              rows={1}
              aria-label="Message composer"
              className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
            />
            {isStreaming ? (
              <button onClick={onStop} aria-label="Stop generating" className="shrink-0 rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20">
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim() && pendingAttachments.length === 0}
                aria-label="Send message"
                className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 p-2.5 text-white shadow-lg shadow-violet-900/30 transition-opacity disabled:opacity-30"
              >
                <Send size={16} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-white/25">OZLIND can make mistakes. Verify important information.</p>
        </div>
      </div>
    </div>
  );
}
