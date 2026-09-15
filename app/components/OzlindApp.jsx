'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const initialSettings = { provider: 'auto', length: 'medium', style: 'balanced', memory: true, research: false, custom: '' };
const icon = (name, className = 'icon') => <svg className={className} aria-hidden="true"><use href={`/ozlind-icons.svg#${name}`} /></svg>;

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function titleFrom(text) { return (text || 'New conversation').replace(/\s+/g, ' ').trim().slice(0, 54) || 'New conversation'; }
function wantsImage(text) { return /\b(create|generate|make|draw|design|render|produce)\b.{0,80}\b(image|picture|photo|poster|illustration|wallpaper|portrait|logo|artwork)\b/i.test(text || ''); }
function renderText(text) {
  const lines = String(text || '').split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g).filter(Boolean);
    return <span key={i}>{parts.map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith('`') && part.endsWith('`') ? <code key={j}>{part.slice(1, -1)}</code> : <span key={j}>{part}</span>)}{i < lines.length - 1 && <br/>}</span>;
  });
}

export default function OzlindApp() {
  const [boot, setBoot] = useState(true);
  const [sidebar, setSidebar] = useState(false);
  const [view, setView] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem('ozlind.history') || '[]');
      const savedSettings = JSON.parse(localStorage.getItem('ozlind.settings') || 'null');
      setHistory(Array.isArray(savedHistory) ? savedHistory : []);
      if (savedSettings) setSettings({ ...initialSettings, ...savedSettings });
    } catch {}
    const timer = setTimeout(() => setBoot(false), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { localStorage.setItem('ozlind.history', JSON.stringify(history.slice(0, 40))); }, [history]);
  useEffect(() => { localStorage.setItem('ozlind.settings', JSON.stringify(settings)); }, [settings]);

  const activeTitle = history[0]?.title || 'New chat';
  const filteredHistory = useMemo(() => history.filter(h => h.title.toLowerCase().includes(search.toLowerCase())), [history, search]);

  function updateSettings(patch) { setSettings(s => ({ ...s, ...patch })); }
  function newChat() { abortRef.current?.abort(); setLoading(false); setMessages([]); setAttachments([]); setInput(''); setView('chat'); setSidebar(false); }
  function openConversation(item) { setMessages(item.messages || []); setView('chat'); setSidebar(false); }

  function saveConversation(nextMessages) {
    if (!nextMessages.length) return;
    const firstUser = nextMessages.find(m => m.role === 'user');
    const id = history.find(h => h.messages?.some(m => m.id === nextMessages[0]?.id))?.id || makeId();
    const entry = { id, title: titleFrom(firstUser?.content), updatedAt: Date.now(), messages: nextMessages.slice(-40) };
    setHistory(prev => [entry, ...prev.filter(h => h.id !== id)].slice(0, 40));
  }

  async function readStream(response, assistantId, setAssistant) {
    if (!response.body) throw new Error('No response stream received.');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n'); buffer = chunks.pop() || '';
      for (const chunk of chunks) {
        const line = chunk.split('\n').find(x => x.startsWith('data: ')); if (!line) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'delta') setAssistant(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + payload.text, provider: payload.provider, model: payload.model } : m));
          if (payload.type === 'done' && payload.sources?.length) setAssistant(prev => prev.map(m => m.id === assistantId ? { ...m, sources: payload.sources } : m));
        } catch {}
      }
    }
  }

  async function sendMessage(override) {
    const text = String(override ?? input).trim();
    if ((!text && !attachments.length) || loading) return;
    setNotice(''); setInput(''); setView('chat');
    const user = { id: makeId(), role: 'user', content: text || 'Analyze the attached image.', attachments: attachments.map(a => ({ name: a.name, mimeType: a.mimeType })) };
    const next = [...messages, user]; setMessages(next); setAttachments([]); setLoading(true);

    if (wantsImage(text)) {
      const assistantId = makeId();
      setMessages([...next, { id: assistantId, role: 'assistant', content: '', imageLoading: true }]);
      try {
        const response = await fetch('/api/image-generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Image generation failed.');
        const finalMessages = [...next, { id: assistantId, role: 'assistant', content: 'Generated image.', imageUrl: data.imageUrl, provider: data.provider, model: data.model }];
        setMessages(finalMessages); saveConversation(finalMessages);
      } catch (error) { const failed = [...next, { id: assistantId, role: 'assistant', content: `I couldn't generate the image. ${error.message}` }]; setMessages(failed); saveConversation(failed); }
      finally { setLoading(false); }
      return;
    }

    const assistantId = makeId();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', thinking: true }]);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const body = { message: text, messages: next.map(({ role, content }) => ({ role, content })), provider: settings.provider, length: settings.length, style: settings.style, memory: settings.memory, research: settings.research, customInstructions: settings.custom, attachments: attachments.map(a => ({ mimeType: a.mimeType, data: a.data })) };
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Request failed (${response.status})`); }
      const type = response.headers.get('content-type') || '';
      if (type.includes('text/event-stream')) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, thinking: false } : m));
        await readStream(response, assistantId, setMessages);
      } else {
        const data = await response.json();
        let displayed = ''; setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, thinking: false } : m));
        for (const char of data.text || '') { displayed += char; await new Promise(r => setTimeout(r, 4)); setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: displayed, provider: data.provider, model: data.model, sources: data.sources } : m)); }
      }
      setMessages(prev => { saveConversation(prev); return prev; });
    } catch (error) {
      if (error.name !== 'AbortError') { const failed = [...next, { id: assistantId, role: 'assistant', content: `I couldn't complete that request. ${error.message}` }]; setMessages(failed); saveConversation(failed); }
    } finally { setLoading(false); abortRef.current = null; }
  }

  async function regenerate(id) {
    const index = messages.findIndex(m => m.id === id); if (index < 0) return;
    const previousUser = [...messages.slice(0, index)].reverse().find(m => m.role === 'user'); if (!previousUser) return;
    setMessages(messages.slice(0, index)); setTimeout(() => sendMessage(previousUser.content), 0);
  }

  function deleteMessage(id) { setMessages(prev => prev.filter(m => m.id !== id)); }
  function editMessage(message) { if (message.role !== 'user') return; setInput(message.content); textareaRef.current?.focus(); }
  async function copyText(text) { await navigator.clipboard?.writeText(text); setNotice('Copied'); setTimeout(() => setNotice(''), 1200); }

  async function handleFiles(event) {
    const files = [...event.target.files].slice(0, 3);
    const loaded = await Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, mimeType: file.type, data: String(reader.result).split(',')[1] }); reader.readAsDataURL(file); })));
    setAttachments(loaded); event.target.value = '';
  }

  if (boot) return <div className="boot"><div className="boot-logo">{icon('ozl-mark')}</div><div className="boot-name">OZLIND</div><div className="boot-sub">AI PLATFORM</div><div className="boot-loader"><i/><i/><i/></div></div>;

  const nav = [
    ['chat', 'i-chat', 'Chat', 'LIVE'], ['history', 'i-history', 'History', ''], ['research', 'i-globe', 'Web Research', 'LIVE'], ['photo', 'i-image', 'Photo Editor', 'NEXT'], ['code', 'i-chat', 'Code Assistant', 'NEXT'], ['documents', 'i-history', 'Documents', 'NEXT'], ['voice', 'i-chat', 'Voice AI', 'NEXT'], ['settings', 'i-settings', 'Settings', '']
  ];
  const modelLabel = { auto: 'Auto', groq: 'Groq', gemini: 'Gemini', experiential: 'Experiential' }[settings.provider];

  return <div className="app">
    <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">{icon('ozl-mark')}</div><div><b>OZLIND</b><span>AI WORKSPACE</span></div></div>
      <button className="new-chat" onClick={newChat}>{icon('i-plus')}<span>New chat</span></button>
      <div className="nav-label">WORKSPACE</div>
      {nav.slice(0, 3).map(([key, ico, label, badge]) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => { setView(key); setSidebar(false); }}>{icon(ico)}<span>{label}</span>{badge && <em>{badge}</em>}</button>)}
      <div className="nav-label">AI TOOLS</div>
      {nav.slice(3, 7).map(([key, ico, label, badge]) => <button key={key} className="nav-item disabled" onClick={() => setNotice(`${label} is on the roadmap.`)}>{icon(ico)}<span>{label}</span><em>{badge}</em></button>)}
      <div className="nav-label">PERSONAL</div>
      <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => { setView('settings'); setSidebar(false); }}>{icon('i-settings')}<span>Settings</span></button>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar">A</div><div><b>Athul</b><span>OZLIND User</span></div></div></div>
    </aside>
    {sidebar && <button className="overlay" aria-label="Close menu" onClick={() => setSidebar(false)} />}
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={() => setSidebar(true)}>{icon('i-menu')}</button><div className="crumb">{view === 'chat' ? 'AI Chat' : nav.find(x => x[0] === view)?.[2] || 'OZLIND'}</div><div className="top-actions"><span className="ready"><i/> Ready</span><button className="top-btn" onClick={() => setView('settings')}>{icon('i-settings')}</button></div></header>
      {notice && <div className="toast">{notice}</div>}

      {view === 'chat' && <section className="chat-page">
        <div className="chat-head"><div><div className="eyebrow">PRIVATE AI WORKSPACE</div><h1>How can I <strong>help?</strong></h1><p>Clear answers, focused research and intelligent conversation.</p></div><div className="controls"><div className="model-control"><button className="model-button" onClick={() => setModelOpen(!modelOpen)}><span><small>MODEL</small><b>{modelLabel}</b></span>{icon('i-settings')}</button>{modelOpen && <div className="model-menu">{Object.entries({auto:'Recommended routing',groq:'Fast text generation',gemini:'Multimodal and vision',experiential:'Alternative provider'}).map(([key, desc]) => <button key={key} onClick={() => { updateSettings({ provider: key }); setModelOpen(false); }}><span><b>{key[0].toUpperCase()+key.slice(1)}</b><small>{desc}</small></span>{settings.provider === key && icon('i-check')}</button>)}</div>}</div><button className={`research-pill ${settings.research ? 'on' : ''}`} onClick={() => updateSettings({ research: !settings.research })}>{icon('i-globe')} Research <b>{settings.research ? 'ON' : 'OFF'}</b></button></div></div>
        <div className="messages" aria-live="polite">
          {!messages.length && <div className="empty"><div className="empty-mark">{icon('ozl-mark')}</div><span>OZLIND AI</span><h2>Start a conversation</h2><p>Ask a question, explore an idea, or create something.</p><div className="suggestions"><button onClick={() => sendMessage('Explain quantum computing simply.')}>Explain something</button><button onClick={() => sendMessage('Help me plan a productive week.')}>Plan something</button><button onClick={() => sendMessage('Write a clean JavaScript function for me.')}>Write code</button><button onClick={() => sendMessage('Create an image of a cinematic Kerala landscape at golden hour.')}>Create an image</button></div></div>}
          {messages.map(m => <article className={`message ${m.role}`} key={m.id}><div className="message-avatar">{m.role === 'assistant' ? icon('ozl-mark') : 'A'}</div><div className="message-body"><div className="message-meta"><b>{m.role === 'assistant' ? 'OZLIND' : 'You'}</b>{m.provider && <span>{m.provider} · {m.model}</span>}</div>{m.thinking ? <div className="typing"><i/><i/><i/></div> : <>{m.imageUrl ? <img className="generated-image" src={m.imageUrl} alt="AI generated result" /> : <div className="message-text">{renderText(m.content)}</div>}{m.sources?.length > 0 && <div className="sources"><b>Sources</b>{m.sources.map((s, i) => <a href={s.url} target="_blank" rel="noreferrer" key={`${s.url}-${i}`}>{s.title || s.url}</a>)}</div>}</>}<div className="message-actions">{m.role === 'assistant' && <><button onClick={() => copyText(m.content)} title="Copy">{icon('i-copy')}</button><button onClick={() => regenerate(m.id)} title="Regenerate">{icon('i-refresh')}</button></>}{m.role === 'user' && <button onClick={() => editMessage(m)} title="Edit">{icon('i-edit')}</button>}<button onClick={() => deleteMessage(m.id)} title="Delete">{icon('i-trash')}</button></div></div></article>)}
          {loading && messages.at(-1)?.role === 'assistant' && !messages.at(-1)?.thinking && <div className="streaming-label">OZLIND is thinking…</div>}
        </div>
        <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}><div className="attachments">{attachments.map(a => <span key={a.name}>{a.name}<button type="button" onClick={() => setAttachments(x => x.filter(y => y.name !== a.name))}>{icon('i-close')}</button></span>)}</div><div className="composer-row"><label className="attach" title="Attach image"><input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={handleFiles}/>{icon('i-image')}</label><textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Message OZLIND…" rows={1} maxLength={12000}/><button className="send" type={loading ? 'button' : 'submit'} onClick={loading ? () => abortRef.current?.abort() : undefined} disabled={!loading && (!input.trim() && !attachments.length)}>{loading ? icon('i-stop') : icon('i-send')}</button></div><div className="composer-foot"><span>{settings.memory ? 'Conversation memory on' : 'Memory off'}</span><span>Enter to send · Shift + Enter for new line</span></div></form>
      </section>}

      {view === 'history' && <section className="page-section"><div className="page-title"><div><div className="eyebrow">PERSONAL</div><h2>Conversation history</h2><p>Stored locally in this browser.</p></div><button className="new-chat small" onClick={newChat}>{icon('i-plus')} New chat</button></div><div className="searchbox">{icon('i-search')}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…"/></div><div className="history-list">{filteredHistory.map(h => <button key={h.id} onClick={() => openConversation(h)}><span>{h.title}</span><small>{new Date(h.updatedAt).toLocaleDateString()}</small></button>)}{!filteredHistory.length && <div className="empty-card">No conversations yet.</div>}</div></section>}

      {view === 'research' && <section className="page-section"><div className="page-title"><div><div className="eyebrow">LIVE SOURCES</div><h2>Web Research</h2><p>Search current information through Tavily on the server.</p></div><button className="new-chat small" onClick={() => setView('chat')}>Open chat</button></div><div className="research-card"><div className="research-icon">{icon('i-globe')}</div><h3>Research mode</h3><p>Turn on <b>Research</b> in chat when a question depends on current information. Sources are shown below the answer.</p><button className="research-pill on" onClick={() => { updateSettings({ research: true }); setView('chat'); }}>Enable Research</button></div></section>}

      {view === 'settings' && <section className="page-section"><div className="page-title"><div><div className="eyebrow">PERSONAL</div><h2>Settings</h2><p>Control response behavior and local data.</p></div></div><div className="settings-grid"><div className="setting-card"><div className="eyebrow">RESPONSE</div><h3>Answer preferences</h3><label>Length<select value={settings.length} onChange={e => updateSettings({ length: e.target.value })}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label><label>Style<select value={settings.style} onChange={e => updateSettings({ style: e.target.value })}><option value="balanced">Balanced</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="direct">Direct</option><option value="creative">Creative</option></select></label><button className={`switch ${settings.memory ? 'on' : ''}`} onClick={() => updateSettings({ memory: !settings.memory })}><span>Conversation memory</span><i/></button></div><div className="setting-card"><div className="eyebrow">CUSTOM</div><h3>Custom instructions</h3><textarea value={settings.custom} onChange={e => updateSettings({ custom: e.target.value })} maxLength={5000} placeholder="Tell OZLIND how you prefer answers…"/><button className="new-chat small" onClick={() => setNotice('Settings saved locally')}>{icon('i-check')} Save settings</button></div><div className="setting-card"><div className="eyebrow">LOCAL DATA</div><h3>History</h3><button className="danger-button" onClick={() => { if (confirm('Clear all local conversations?')) setHistory([]); }}>{icon('i-trash')} Clear history</button></div></div></section>}

      {['photo','code','documents','voice'].includes(view) && <section className="page-section"><div className="page-title"><div><div className="eyebrow">ROADMAP</div><h2>{nav.find(x => x[0] === view)?.[2]}</h2><p>This capability is planned for a future OZLIND release.</p></div></div><div className="empty-card roadmap">{icon('ozl-mark')}<b>Coming next</b><span>Chat, web research and in-chat image generation are the active v1 capabilities.</span><button className="new-chat small" onClick={() => setView('chat')}>Back to chat</button></div></section>}
    </main>
  </div>;
}
