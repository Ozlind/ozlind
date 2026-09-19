'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MODES = [
  { id: 'auto', label: 'Auto', note: 'Balanced' },
  { id: 'fast', label: 'Fast', note: 'Quick' },
  { id: 'pro', label: 'Pro', note: 'Reasoning' },
  { id: 'vision', label: 'Vision', note: 'Files' },
  { id: 'research', label: 'Research', note: 'Web' },
];

const NAV_ITEMS = [
  { id: 'chat', label: 'AI Chat', status: 'LIVE', icon: 'chat' },
  { id: 'research', label: 'Web Research', status: 'LIVE', icon: 'globe' },
  { id: 'vision', label: 'Vision & Files', status: 'LIVE', icon: 'image' },
];

const CHAT_KEY = 'ozlind.conversations.v6';
const SETTINGS_KEY = 'ozlind.settings.v6';
const MAX_HISTORY = 40;
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function titleFrom(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean ? (clean.length > 48 ? `${clean.slice(0, 48).trim()}…` : clean) : 'New conversation';
}

function favicon(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`;
  } catch {
    return '';
  }
}

function Icon({ name, size = 18, className = '' }) {
  const ids = {
    menu: 'i-menu', x: 'i-close', plus: 'i-plus', search: 'i-search',
    chat: 'i-ai-chat', home: 'i-home', newChat: 'i-new-conversation',
    settings: 'i-settings', profile: 'i-profile', history: 'i-history',
    back: 'i-back', forward: 'i-forward', research: 'i-research',
    globe: 'i-web-research', sources: 'i-sources', image: 'sym-discovery',
    edit: 'i-photo-editor', code: 'i-code-assistant', file: 'i-documents',
    mic: 'i-microphone', send: 'i-send', paperclip: 'i-attach', stop: 'i-stop',
    error: 'i-error', info: 'i-information', copy: 'i-copy', editMessage: 'i-edit',
    refresh: 'i-refresh', trash: 'i-delete', chevron: 'i-collapse',
    spark: 'sym-insight', expand: 'i-expand', collapse: 'i-collapse',
    external: 'i-open-external', download: 'i-download', upload: 'i-upload',
    clear: 'i-clear', bookmark: 'i-bookmark', share: 'i-share',
    check: 'i-check', arrow: 'i-arrow-right', arrowUp: 'i-arrow-up',
    active: 'sym-active', thinking: 'sym-thinking', processing: 'sym-processing',
    success: 'sym-success', warning: 'sym-warning', conversation: 'sym-conversation',
    creation: 'sym-creation', discovery: 'sym-discovery', fallback: 'src-fallback',
  };
  return (
    <svg className={`ozl-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href={`/ozlind-icons-sprite.svg#${ids[name] || 'i-information'}`} />
    </svg>
  );
}

function BrandMark({ large = false }) {
  return (
    <svg className={large ? 'brand-svg brand-svg-large' : 'brand-svg'} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <use href="/ozlind-icons-sprite.svg#ozl-mark" />
    </svg>
  );
}

function InlineText({ text }) {
  const tokens = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);

  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <span key={index}>{token}</span>;
  });
}

function Markdown({ content }) {
  const sections = String(content || '').split(/```/);

  return (
    <div className="markdown">
      {sections.map((section, index) => {
        if (index % 2 === 1) {
          return <pre className="code-block" key={index}><code>{section.replace(/^\w+\n/, '').trimEnd()}</code></pre>;
        }

        return section.split(/\n{2,}/).filter(Boolean).map((paragraph, paragraphIndex) => (
          <div className="md-block" key={`${index}-${paragraphIndex}`}>
            {paragraph.split('\n').filter(Boolean).map((line, lineIndex) => {
              const heading = line.match(/^#{1,3}\s+(.+)$/);
              const bullet = line.match(/^[-*]\s+(.+)$/);
              const numbered = line.match(/^\d+\.\s+(.+)$/);

              if (heading) return <h3 key={lineIndex}>{heading[1]}</h3>;
              if (bullet) return <div className="md-list" key={lineIndex}><span>•</span><InlineText text={bullet[1]} /></div>;
              if (numbered) return <div className="md-list" key={lineIndex}><span>{line.match(/^\d+/)[0]}.</span><InlineText text={numbered[1]} /></div>;
              return <p key={lineIndex}><InlineText text={line} /></p>;
            })}
          </div>
        ));
      })}
    </div>
  );
}

async function fileToPayload(file) {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name} is not a supported file type.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 8 MB.`);

  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

  return { name: file.name, mimeType: file.type, data };
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [memory, setMemory] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const chatsRef = useRef([]);
  const activeRef = useRef(null);
  const persistTimer = useRef(null);

  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const validChats = Array.isArray(stored) ? stored.filter((chat) => chat?.id && Array.isArray(chat.messages)).slice(-MAX_HISTORY) : [];
      setChats(validChats);
      if (validChats.length) setActiveId(validChats[validChats.length - 1].id);
      setCustomInstructions(typeof settings.customInstructions === 'string' ? settings.customInstructions : '');
      setMemory(settings.memory !== false);
    } catch {
      setChats([]);
    }
  }, []);

  useEffect(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(chats.slice(-MAX_HISTORY).map((chat) => ({
          ...chat,
          messages: chat.messages.map(({ attachments: _attachments, ...message }) => message),
        }))));
      } catch {
        setNotice('Local history could not be saved on this device.');
      }
    }, 300);
    return () => clearTimeout(persistTimer.current);
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ customInstructions: customInstructions.slice(0, 3000), memory }));
    } catch {
      // Preferences are optional.
    }
  }, [customInstructions, memory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeId, chats, busy]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA';

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('[data-history-search]')?.focus();
      }

      if (!editing && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createChat();
      }

      if (event.key === 'Escape') {
        setMobileOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  const current = useMemo(() => chats.find((chat) => chat.id === activeId) || null, [chats, activeId]);
  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chats.filter((chat) => !query || chat.title.toLowerCase().includes(query));
  }, [chats, search]);
  const activeMode = MODES.find((item) => item.id === mode) || MODES[0];

  const updateChat = useCallback((id, updater) => {
    setChats((items) => items.map((chat) => (chat.id === id ? updater(chat) : chat)));
  }, []);

  function createChat() {
    if (busy) abortRef.current?.abort();
    const chat = { id: uid(), title: 'New conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    setChats((items) => [...items, chat].slice(-MAX_HISTORY));
    setActiveId(chat.id);
    activeRef.current = chat.id;
    setInput('');
    setAttachments([]);
    setNotice('');
    setMobileOpen(false);
    setBusy(false);
  }

  function selectNav(id) {
    if (id === 'research') setMode('research');
    else if (id === 'vision') setMode('vision');
    else if (id === 'chat') setMode('auto');
    else {
      setNotice(`${NAV_ITEMS.find((item) => item.id === id)?.label || 'This feature'} is planned for a future release.`);
      return;
    }
    setMobileOpen(false);
  }

  function clearCurrent() {
    if (!current) return;
    updateChat(current.id, (chat) => ({ ...chat, title: 'New conversation', messages: [], updatedAt: Date.now() }));
    setInput('');
    setAttachments([]);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    const chatId = activeRef.current;
    if (chatId) updateChat(chatId, (chat) => ({ ...chat, messages: chat.messages.map((message) => message.streaming ? { ...message, streaming: false } : message) }));
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(''), 1200);
    } catch {
      setNotice('Copy is unavailable in this browser.');
    }
  }

  function editMessage(message) {
    setInput(message.content || '');
    setAttachments([]);
    textareaRef.current?.focus();
  }

  function deleteMessage(messageId) {
    if (!current) return;
    updateChat(current.id, (chat) => ({ ...chat, messages: chat.messages.filter((message) => message.id !== messageId), updatedAt: Date.now() }));
  }

  async function attachFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;

    if (attachments.length + selected.length > MAX_ATTACHMENTS) {
      setNotice(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }

    try {
      const payloads = [];
      for (const file of selected) payloads.push(await fileToPayload(file));
      setAttachments((items) => [...items, ...payloads]);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not attach the file.');
    }
  }

  async function sendMessage(valueOverride = null) {
    const text = String(valueOverride ?? input).trim();
    if ((!text && !attachments.length) || busy) return;

    let chat = chatsRef.current.find((item) => item.id === activeRef.current);
    if (!chat) {
      chat = { id: uid(), title: titleFrom(text || 'File analysis'), messages: [], createdAt: Date.now(), updatedAt: Date.now() };
      setChats((items) => [...items, chat].slice(-MAX_HISTORY));
      setActiveId(chat.id);
      activeRef.current = chat.id;
    }

    const requestAttachments = attachments.map((file) => ({ ...file }));
    const userMessage = {
      id: uid(),
      role: 'user',
      content: text || 'Please analyze the attached files.',
      attachments: requestAttachments.map(({ name, mimeType }) => ({ name, mimeType })),
      createdAt: Date.now(),
    };
    const assistantMessage = { id: uid(), role: 'assistant', content: '', streaming: true, createdAt: Date.now() };
    const history = [...(chat.messages || []), userMessage];
    const requestMessages = (memory ? history : [userMessage]).slice(-24).map((message) => ({ role: message.role, content: message.content }));

    updateChat(chat.id, (item) => ({
      ...item,
      title: item.title === 'New conversation' ? titleFrom(text || 'File analysis') : item.title,
      messages: [...history, assistantMessage],
      updatedAt: Date.now(),
    }));

    setInput('');
    setAttachments([]);
    setBusy(true);
    setNotice('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          messages: requestMessages,
          mode,
          memory,
          customInstructions,
          attachments: requestAttachments,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'OZLIND could not complete that request.');
      }
      if (!response.body) throw new Error('The server returned an empty response.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let sources = [];

      const applyAssistant = (extra = {}) => {
        updateChat(chat.id, (item) => ({
          ...item,
          messages: item.messages.map((message) => message.id === assistantMessage.id ? { ...message, content: fullText, streaming: true, ...extra } : message),
          updatedAt: Date.now(),
        }));
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const payload = JSON.parse(raw);
            if (payload.type === 'text' && typeof payload.text === 'string') {
              fullText += payload.text;
              applyAssistant();
            }
            if (payload.type === 'sources' && Array.isArray(payload.sources)) {
              sources = payload.sources;
              applyAssistant({ sources });
            }
          } catch {
            // Ignore malformed SSE frames while keeping the stream alive.
          }
        }
      }

      if (!fullText.trim()) fullText = 'I could not generate a response. Please try again.';

      updateChat(chat.id, (item) => ({
        ...item,
        messages: item.messages.map((message) => message.id === assistantMessage.id ? { ...message, content: fullText, sources, streaming: false } : message),
        updatedAt: Date.now(),
      }));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'OZLIND could not complete that request.';
      updateChat(chat.id, (item) => ({
        ...item,
        messages: item.messages.map((entry) => entry.id === assistantMessage.id ? { ...entry, content: message, streaming: false, error: true } : entry),
        updatedAt: Date.now(),
      }));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function regenerateFrom(messageIndex) {
    if (!current || busy) return;
    const previousUser = [...current.messages.slice(0, messageIndex)].reverse().find((message) => message.role === 'user');
    if (!previousUser?.content) return;
    setInput(previousUser.content);
    window.setTimeout(() => sendMessage(previousUser.content), 0);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-lockup">
            <BrandMark />
            <div>
              <div className="brand-name">OZLIND</div>
              <div className="brand-sub">AI WORKSPACE</div>
            </div>
          </div>
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><Icon name="x" size={18} /></button>
        </div>

        <button className="new-chat-button" onClick={createChat}>
          <span><Icon name="plus" size={17} /></span>
          <strong>New conversation</strong>
          <kbd>N</kbd>
        </button>

        <nav className="nav-stack" aria-label="Workspace">
          <div className="nav-label">WORKSPACE</div>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={`nav-link ${((item.id === 'chat' && mode === 'auto') || (item.id === 'research' && mode === 'research') || (item.id === 'vision' && mode === 'vision')) ? 'selected' : ''}`} onClick={() => selectNav(item.id)}>
              <span className="nav-icon"><Icon name={item.icon} size={17} /></span>
              <span className="nav-text">{item.label}</span>
              <small className={item.status === 'LIVE' ? 'live' : ''}>{item.status}</small>
            </button>
          ))}
        </nav>

        <section className="history-section">
          <div className="history-head">
            <span>RECENT</span>
            <span>{visibleChats.length}</span>
          </div>
          <label className="history-search">
            <Icon name="search" size={15} />
            <input data-history-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" />
            <kbd>⌘K</kbd>
          </label>
          <div className="history-list">
            {visibleChats.slice(-7).reverse().map((chat) => (
              <button key={chat.id} className={`history-item ${chat.id === activeId ? 'selected' : ''}`} onClick={() => { setActiveId(chat.id); setMobileOpen(false); }}>
                <span className="history-marker" />
                <span>{chat.title}</span>
              </button>
            ))}
            {!visibleChats.length && <div className="history-empty">No saved conversations.</div>}
          </div>
        </section>

        <div className="sidebar-footer">
          <button className="nav-link" onClick={() => setSettingsOpen(true)}><span className="nav-icon"><Icon name="settings" size={17} /></span><span className="nav-text">Settings</span></button>
          <div className="profile-row">
            <div className="avatar">A</div>
            <div><strong>Athul</strong><small>OZLIND User</small></div>
            <i />
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Icon name="menu" size={19} /></button>
          <div className="topbar-brand"><BrandMark /><div><strong>OZLIND AI</strong><span><i />Online</span></div></div>
          <div className="topbar-center">{current ? <span>{current.title}</span> : <span>Intelligence workspace</span>}</div>
          <div className="topbar-actions">
            {current && <button className="top-action" onClick={clearCurrent}><Icon name="trash" size={15} /> <span>Clear</span></button>}
            <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Icon name="settings" size={17} /></button>
          </div>
        </header>

        <section className="content-area">
          {!current?.messages?.length ? (
            <div className="welcome-screen">
              <div className="hero-symbol"><BrandMark large /></div>
              <div className="eyebrow">PRIVATE AI WORKSPACE · {activeMode.label.toUpperCase()}</div>
              <h1>Think clearly.<br /><em>Create with intent.</em></h1>
              <p className="hero-copy">Conversation, research, reasoning and file understanding in one focused workspace.</p>

              <div className="capability-row">
                <span><Icon name="chat" size={15} /> Conversation</span>
                <span><Icon name="globe" size={15} /> Current research</span>
                <span><Icon name="image" size={15} /> Vision & files</span>
              </div>

              <div className="prompt-grid">
                <button onClick={() => { setInput('Explain a difficult concept in a simple, practical way.'); textareaRef.current?.focus(); }}><span className="prompt-icon"><Icon name="spark" size={17} /></span><span><strong>Make it simple</strong><small>Turn complexity into clarity</small></span><Icon name="arrow" size={15} /></button>
                <button onClick={() => { setInput('Help me plan this project from idea to execution.'); textareaRef.current?.focus(); }}><span className="prompt-icon"><Icon name="code" size={17} /></span><span><strong>Build a plan</strong><small>Structure the next steps</small></span><Icon name="arrow" size={15} /></button>
                <button onClick={() => { setMode('research'); setInput('Research the latest information about '); textareaRef.current?.focus(); }}><span className="prompt-icon"><Icon name="globe" size={17} /></span><span><strong>Research current facts</strong><small>Search the live web</small></span><Icon name="arrow" size={15} /></button>
              </div>
            </div>
          ) : (
            <div className="conversation-view">
              <div className="conversation-titlebar">
                <div><span className="eyebrow">CONVERSATION</span><h1>{current.title}</h1></div>
                <button className="clear-current" onClick={clearCurrent}><Icon name="trash" size={14} /> Clear</button>
              </div>

              <div className="message-list">
                {current.messages.map((message, index) => (
                  <article className={`message-row ${message.role} ${message.error ? 'message-error' : ''}`} key={message.id}>
                    <div className="message-avatar">{message.role === 'user' ? 'A' : <BrandMark />}</div>
                    <div className="message-main">
                      <div className="message-meta"><strong>{message.role === 'user' ? 'You' : 'OZLIND'}</strong>{message.streaming && <span className="streaming-label"><i /> Generating</span>}</div>
                      <div className="message-content">
                        {message.content ? <Markdown content={message.content} /> : <div className="thinking"><i /><i /><i /></div>}
                        {message.streaming && message.content && <span className="typing-cursor" />}
                      </div>

                      {message.attachments?.length > 0 && <div className="message-files">{message.attachments.map((file) => <span key={`${file.name}-${file.mimeType}`}><Icon name="file" size={12} /> {file.name}</span>)}</div>}

                      {message.sources?.length > 0 && (
                        <details className="sources-panel">
                          <summary><span className="source-icons">{message.sources.slice(0, 4).map((source) => <img key={source.url} src={favicon(source.url)} alt="" />)}</span><span>Sources</span><b>{message.sources.length}</b><Icon name="chevron" size={13} /></summary>
                          <div className="source-list">{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><img src={favicon(source.url)} alt="" /><span><strong>{source.title || source.domain}</strong><small>{source.domain}</small></span><Icon name="arrow" size={13} /></a>)}</div>
                        </details>
                      )}

                      {!message.streaming && <div className="message-actions">
                        <button onClick={() => copyMessage(message)}><Icon name="copy" size={13} /> {copiedId === message.id ? 'Copied' : 'Copy'}</button>
                        {message.role === 'user' && <button onClick={() => editMessage(message)}>Edit</button>}
                        {message.role === 'assistant' && <button onClick={() => regenerateFrom(index)}><Icon name="refresh" size={13} /> Regenerate</button>}
                        <button onClick={() => deleteMessage(message.id)}><Icon name="trash" size={13} /> Delete</button>
                      </div>}
                    </div>
                  </article>
                ))}
                <div ref={endRef} />
              </div>
            </div>
          )}

          {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><Icon name="x" size={14} /></button></div>}

          <div className="composer-dock">
            {attachments.length > 0 && <div className="attachment-strip">{attachments.map((file) => <button key={`${file.name}-${file.mimeType}`} onClick={() => setAttachments((items) => items.filter((item) => item !== file))}><Icon name="file" size={13} /><span>{file.name}</span><Icon name="x" size={12} /></button>)}</div>}

            <div className="mode-tabs" role="tablist" aria-label="AI mode">
              {MODES.map((item) => <button key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}><span>{item.label}</span><small>{item.note}</small></button>)}
            </div>

            <div className="composer">
              <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={mode === 'research' ? 'What should OZLIND research?' : mode === 'vision' ? 'Ask about an image, PDF or file…' : 'Ask OZLIND anything…'} aria-label="Message OZLIND" />
              <div className="composer-bottom">
                <div className="composer-tools">
                  <button className="attach-button" onClick={() => fileRef.current?.click()} aria-label="Attach a file"><Icon name="paperclip" size={17} /></button>
                  <input ref={fileRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv" onChange={attachFiles} />
                  <button className={`memory-chip ${memory ? 'on' : ''}`} onClick={() => setMemory((value) => !value)}><i /> Memory {memory ? 'On' : 'Off'}</button>
                  <span className="keyboard-hint">Shift + Enter for new line</span>
                </div>
                {busy ? <button className="send-button stop" onClick={stopGeneration} aria-label="Stop generation"><Icon name="stop" size={15} /></button> : <button className="send-button" onClick={sendMessage} disabled={!input.trim() && !attachments.length} aria-label="Send message"><Icon name="arrow" size={18} /></button>}
              </div>
            </div>
            <div className="composer-note">OZLIND can make mistakes. Verify important information.</div>
          </div>
        </section>
      </main>

      {settingsOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="settings-modal">
          <div className="modal-head"><div><span className="eyebrow">WORKSPACE PREFERENCES</span><h2>Settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><Icon name="x" size={18} /></button></div>
          <div className="setting-row"><div><strong>Conversation memory</strong><span>Include previous messages in new requests.</span></div><button className={`switch ${memory ? 'on' : ''}`} onClick={() => setMemory((value) => !value)} aria-pressed={memory}><i /></button></div>
          <label className="instruction-field"><span>Custom instructions</span><textarea value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value.slice(0, 3000))} placeholder="Tell OZLIND how you prefer to work…" /></label>
          <div className="counter">{customInstructions.length}/3000</div>
          <div className="settings-note">Settings are stored locally in this browser. Secret provider credentials never belong in the client.</div>
          <button className="save-button" onClick={() => setSettingsOpen(false)}>Save & close</button>
        </div>
      </div>}
    </div>
  );
}
