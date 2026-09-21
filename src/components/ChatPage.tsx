import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Send, Paperclip, Square, RotateCcw, Sparkles, Image as ImageIcon, FileText, X, ChevronRight } from 'lucide-react';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  attachments?: Attachment[];
  requestId?: string;
}

interface Source {
  index: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Settings {
  mode?: string;
  research_enabled?: boolean;
  memory_enabled?: boolean;
  style?: string;
  length?: string;
  instructions?: string;
}

export default function ChatPage() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streamingRequestId, setStreamingRequestId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [session]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      loadConversation(custom.detail);
    };
    window.addEventListener('load-conversation', handler);
    return () => window.removeEventListener('load-conversation', handler);
  }, [session]);

  const loadConversation = async (id: number) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(id);
        setMessages(data.messages?.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          attachments: m.attachments || [],
        })) || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setAttachments([]);
    setStreamingRequestId(null);
    inputRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/csv', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(file.type)) {
      alert('File type not supported');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10MB)');
      return;
    }

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAttachments(prev => [...prev, { name: file.name, url: data.url, type: file.type, size: file.size }]);
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !session?.access_token) return;

    const userMsg: Message = { role: 'user', content: input.trim(), attachments: [...attachments] };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setLoading(true);

    // Auto-create conversation on first message
    let currentConvId = conversationId;
    if (!currentConvId) {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ title: userMsg.content.slice(0, 60) }),
        });
        if (res.ok) {
          const data = await res.json();
          currentConvId = data.id;
          setConversationId(data.id);
        }
      } catch (err) {
        console.error('Create conv error:', err);
      }
    }

    const controller = new AbortController();
    setAbortController(controller);
    setStreamingRequestId(null);

    try {
      const apiMessages = newMessages.slice(-20).map(m => ({
        role: m.role,
        content: m.content + (m.attachments?.length ? `\n\n[Attached files: ${m.attachments.map(a => a.name).join(', ')}]` : ''),
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          mode: settings.mode || 'auto',
          conversation_id: currentConvId,
          attachments: userMsg.attachments,
          custom_instructions: settings.instructions || '',
          style: settings.style || 'balanced',
          length: settings.length || 'medium',
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || 'Something went wrong. Please try again.' }]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let currentSources: Source[] | undefined;
      let currentRequestId: string | null = null;

      setMessages(prev => [...prev, { role: 'assistant', content: '', sources: undefined }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setLoading(false);
              setAbortController(null);
              // Save assistant message
              if (currentConvId) {
                fetch('/api/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    conversation_id: currentConvId,
                    role: 'assistant',
                    content: assistantContent,
                    attachments: [],
                  }),
                }).catch(console.error);
              }
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { role: 'assistant', content: parsed.error, requestId: parsed.requestId };
                  return next;
                });
                setLoading(false);
                setAbortController(null);
                return;
              }
              if (parsed.sources) {
                currentSources = parsed.sources;
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { ...next[next.length - 1], sources: currentSources, requestId: parsed.requestId };
                  return next;
                });
              }
              if (parsed.chunk) {
                assistantContent += parsed.chunk;
                if (parsed.requestId) currentRequestId = parsed.requestId;
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { role: 'assistant', content: assistantContent, sources: currentSources, requestId: currentRequestId || undefined };
                  return next;
                });
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const next = [...prev];
          if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1]?.content) {
            next[next.length - 1] = { role: 'assistant', content: 'Message stopped.' };
          }
          return next;
        });
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const stopStreaming = () => {
    abortController?.abort();
  };

  const regenerate = async () => {
    if (messages.length < 2) return;
    // Remove last assistant message and resend
    const trimmed = messages.slice(0, -1);
    setMessages(trimmed);
    // Simulate sending the last user message again
    const lastUser = trimmed[trimmed.length - 1];
    if (lastUser?.role === 'user') {
      setInput(lastUser.content);
      setTimeout(() => sendMessage(), 50);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown parser - convert code blocks, bold, italic, links
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-ozlind-cyan hover:underline">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, '<br />');

    // Citations [1], [2]
    html = html.replace(/\[(\d+)\]/g, '<sup class="text-ozlind-cyan text-[10px] ml-0.5">[$1]</sup>');

    return html;
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0b3b34,#0a2540,#1c1445)', border: '1px solid rgba(56,230,200,0.3)' }}>
              <svg viewBox="0 0 32 32" className="w-10 h-10">
                <defs>
                  <linearGradient id="ti" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#38e6c8" />
                    <stop offset="1" stopColor="#4cc9ff" />
                  </linearGradient>
                </defs>
                <text x="16" y="22" textAnchor="middle" fontWeight="900" fontSize="18" fill="url(#ti)">O</text>
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1">Welcome to OZLIND AI</h2>
            <p className="text-sm text-ozlind-muted max-w-md">
              Ask anything, upload files, or switch modes for research and vision tasks.
              Created by Athul.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {['Explain quantum computing simply', 'Analyze this PDF', 'Research latest AI trends', 'Write a Python script'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full border border-ozlind-border text-xs hover:bg-white/5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'bg-ozlind-cyan/10 border border-ozlind-cyan/20 rounded-2xl rounded-tr-md px-4 py-3' : 'w-full'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles size={14} className="text-ozlind-cyan" />
                  <span className="text-xs font-medium text-ozlind-muted">OZLIND AI</span>
                  {msg.requestId && <span className="text-[10px] text-ozlind-muted/50">{msg.requestId.slice(0, 12)}</span>}
                </div>
              )}

              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.attachments.map((att, ai) => (
                    <div key={ai} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-ozlind-dark border border-ozlind-border text-[10px]">
                      {att.type.startsWith('image') ? <ImageIcon size={12} /> : <FileText size={12} />}
                      {att.name}
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`text-sm leading-relaxed ${msg.role === 'user' ? '' : 'prose-dark'}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />

              {/* Sources for research */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-ozlind-muted">Sources</p>
                  {msg.sources.map(source => (
                    <div key={source.index} className="border border-ozlind-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          const next = new Set(expandedSources);
                          if (next.has(source.index)) next.delete(source.index); else next.add(source.index);
                          setExpandedSources(next);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                      >
                        <span className="text-xs font-bold text-ozlind-cyan w-5">{source.index}</span>
                        <img src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`} alt="" className="w-4 h-4 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-xs flex-1 truncate">{source.title}</span>
                        <span className="text-[10px] text-ozlind-muted">{source.domain}</span>
                        <ChevronRight size={12} className={`text-ozlind-muted transition-transform ${expandedSources.has(source.index) ? 'rotate-90' : ''}`} />
                      </button>
                      {expandedSources.has(source.index) && (
                        <div className="px-3 py-2 border-t border-ozlind-border bg-ozlind-dark/50">
                          <p className="text-xs text-ozlind-muted leading-relaxed">{source.snippet}</p>
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ozlind-cyan hover:underline mt-1 inline-block">
                            Visit source →
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && msg.content && !loading && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={regenerate}
                    className="text-[10px] text-ozlind-muted hover:text-ozlind-cyan transition-colors flex items-center gap-1"
                    title="Regenerate"
                  >
                    <RotateCcw size={10} /> Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-center gap-2 text-ozlind-muted">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-ozlind-cyan animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-ozlind-cyan animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-ozlind-cyan animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">Thinking...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-ozlind-border bg-ozlind-panel/80 backdrop-blur p-3 safe-bottom">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-ozlind-dark border border-ozlind-border text-[10px]">
                {att.type.startsWith('image') ? <ImageIcon size={12} /> : <FileText size={12} />}
                {att.name}
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-ozlind-muted hover:text-red-400">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-ozlind-dark border border-ozlind-border rounded-xl px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,text/csv,text/plain,.md"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-ozlind-muted hover:text-ozlind-text hover:bg-white/5 transition-colors flex-shrink-0"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none py-2 max-h-[200px]"
            style={{ minHeight: '40px' }}
          />

          {loading ? (
            <button
              onClick={stopStreaming}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
              aria-label="Stop"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-ozlind-cyan/10 text-ozlind-cyan hover:bg-ozlind-cyan/20 transition-colors disabled:opacity-30 flex-shrink-0"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <button
            onClick={startNewChat}
            className="text-[10px] text-ozlind-muted hover:text-ozlind-cyan transition-colors"
          >
            + New chat
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ozlind-muted uppercase">
              {settings.mode || 'auto'}
            </span>
            <span className="text-[10px] text-ozlind-muted/50">Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
