"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MODES = [
  ["auto", "Auto"],
  ["fast", "Fast"],
  ["pro", "Pro"],
  ["vision", "Vision"],
  ["research", "Research"],
  ["image", "Image"],
];

const CONVERSATIONS_KEY = "ozlind.conversations.v4";
const SETTINGS_KEY = "ozlind.settings.v3";
const MAX_HISTORY = 30;
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

function uid() {
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function titleOf(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > 42 ? `${value.slice(0, 42).trim()}…` : value || "New conversation";
}

function Inline({ text }) {
  const source = String(text || "");
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const parts = source.split(tokenPattern);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

function Markdown({ content }) {
  const blocks = String(content || "").split(/```/);
  return (
    <div className="markdown">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const lines = block.replace(/^\w+\n/, "");
          return <pre className="code-block" key={index}><code>{lines.trimEnd()}</code></pre>;
        }
        const paragraphs = block.split(/\n{2,}/).filter((value) => value.trim());
        return paragraphs.map((paragraph, paragraphIndex) => {
          const lines = paragraph.split("\n").filter(Boolean);
          return (
            <div className="md-block" key={`${index}-${paragraphIndex}`}>
              {lines.map((line, lineIndex) => {
                const heading = line.match(/^(#{1,3})\s+(.+)$/);
                if (heading) return <h3 key={lineIndex}>{heading[2]}</h3>;
                if (/^[-*]\s+/.test(line)) return <div className="md-list" key={lineIndex}>• <Inline text={line.replace(/^[-*]\s+/, "")} /></div>;
                return <div key={lineIndex}><Inline text={line} /></div>;
              })}
            </div>
          );
        });
      })}
    </div>
  );
}

async function fileToAttachment(file) {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error(`Unsupported file type: ${file.name}`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 8 MB.`);
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type, data };
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [notice, setNotice] = useState("");
  const [attachments, setAttachments] = useState([]);

  const abortRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const persistTimer = useRef(null);
  const chatsRef = useRef(chats);
  const activeRef = useRef(active);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || "[]");
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      setChats(Array.isArray(stored) ? stored.slice(-MAX_HISTORY) : []);
      setCustom(typeof settings.custom === "string" ? settings.custom : "");
    } catch {
      setChats([]);
    }
  }, []);

  useEffect(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(chats.slice(-MAX_HISTORY).map((chat) => ({ ...chat, messages: chat.messages.map(({ image, ...message }) => message) }))));
      } catch {
        setNotice("Conversation storage is unavailable on this device.");
      }
    }, 350);
    return () => clearTimeout(persistTimer.current);
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ custom: custom.slice(0, 3000) }));
    } catch {
      // Preferences are optional; generation must continue if storage is blocked.
    }
  }, [custom]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active, busy]);

  const current = useMemo(() => chats.find((chat) => chat.id === active) || null, [chats, active]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chats.filter((chat) => !query || chat.title.toLowerCase().includes(query));
  }, [chats, search]);

  function updateChat(id, updater) {
    setChats((items) => items.map((chat) => (chat.id === id ? updater(chat) : chat)));
  }

  function newChat() {
    if (busy) stop();
    const chat = { id: uid(), title: "New conversation", messages: [], createdAt: Date.now() };
    setChats((items) => [...items, chat].slice(-MAX_HISTORY));
    setActive(chat.id);
    activeRef.current = chat.id;
    setInput("");
    setAttachments([]);
    setMobile(false);
    setNotice("");
  }

  async function send(text = input, requestedMode = mode, targetChatId = activeRef.current) {
    const value = String(text || "").trim();
    if (!value || busy) return;

    let chat = chatsRef.current.find((item) => item.id === targetChatId);
    if (!chat) {
      chat = { id: uid(), title: titleOf(value), messages: [], createdAt: Date.now() };
      setChats((items) => [...items, chat].slice(-MAX_HISTORY));
      setActive(chat.id);
      activeRef.current = chat.id;
    }

    const user = { id: uid(), role: "user", content: value, attachments: attachments.map(({ name, mimeType }) => ({ name, mimeType })) };
    const assistant = { id: uid(), role: "assistant", content: "", streaming: true };
    const history = [...(chat.messages || []), user];
    const assistantIndex = history.length;
    const requestAttachments = attachments;

    updateChat(chat.id, (item) => ({
      ...item,
      title: item.title === "New conversation" ? titleOf(value) : item.title,
      messages: [...history, assistant],
    }));
    setInput("");
    setAttachments([]);
    setBusy(true);
    setNotice("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (requestedMode === "image") {
        const response = await fetch("/api?action=image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: value }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "OZLIND could not create that image.");
        updateChat(chat.id, (item) => ({
          ...item,
          messages: item.messages.map((message) =>
            message.id === assistant.id
              ? { ...message, content: data.image ? "Your image is ready.": "", image: data.image, streaming: false }
              : message,
          ),
        }));
        return;
      }

      const response = await fetch("/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: requestedMode,
          messages: history.map(({ role, content }) => ({ role, content })),
          customInstructions: custom,
          attachments: requestAttachments,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "OZLIND could not complete that request.");
      }
      if (!response.body) throw new Error("The response stream was unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources = [];

      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            if (event.type === "text" && event.text) {
              updateChat(chat.id, (item) => ({
                ...item,
                messages: item.messages.map((message, index) =>
                  index === assistantIndex && message.id === assistant.id
                    ? { ...message, content: message.content + event.text, streaming: true }
                    : message,
                ),
              }));
            }
            if (event.type === "sources" && Array.isArray(event.sources)) sources = event.sources;
          } catch {
            // Ignore incomplete SSE frames; the next chunk completes them.
          }
        }
      }

      updateChat(chat.id, (item) => ({
        ...item,
        messages: item.messages.map((message) =>
          message.id === assistant.id ? { ...message, streaming: false, sources } : message,
        ),
      }));
    } catch (error) {
      if (error?.name !== "AbortError") {
        updateChat(chat.id, (item) => ({
          ...item,
          messages: item.messages.map((message) =>
            message.id === assistant.id
              ? { ...message, content: error?.message || "OZLIND couldn't complete that request.", error: true, streaming: false }
              : message,
          ),
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    if (active) {
      updateChat(active, (chat) => ({
        ...chat,
        messages: chat.messages.map((message) => (message.streaming ? { ...message, streaming: false } : message)),
      }));
    }
  }

  function removeMessage(id) {
    if (!active || busy) return;
    updateChat(active, (chat) => ({ ...chat, messages: chat.messages.filter((message) => message.id !== id) }));
  }

  function editMessage(message) {
    if (busy) return;
    setInput(message.content);
    removeMessage(message.id);
    setTimeout(() => document.querySelector("textarea")?.focus(), 0);
  }

  function regenerate(index) {
    if (!current || busy || index < 1) return;
    const previous = current.messages[index - 1];
    if (previous?.role !== "user") return;
    const retained = current.messages.slice(0, index - 1);
    const value = previous.content;
    const snapshot = { ...current, messages: retained };
    updateChat(current.id, () => snapshot);
    chatsRef.current = chatsRef.current.map((chat) => chat.id === current.id ? snapshot : chat);
    setActive(current.id);
    activeRef.current = current.id;
    setTimeout(() => send(value, mode, current.id), 0);
  }

  function clearChat() {
    if (busy) stop();
    if (active) updateChat(active, (chat) => ({ ...chat, messages: [] }));
  }

  async function handleFiles(event) {
    const selected = [...(event.target.files || [])];
    event.target.value = "";
    if (!selected.length) return;
    if (selected.length > MAX_ATTACHMENTS) {
      setNotice(`You can attach up to ${MAX_ATTACHMENTS} files.`);
    }
    try {
      const converted = [];
      for (const file of selected.slice(0, MAX_ATTACHMENTS)) converted.push(await fileToAttachment(file));
      setAttachments(converted);
      setNotice(`${converted.length} attachment${converted.length === 1 ? "" : "s"} ready.`);
    } catch (error) {
      setNotice(error.message || "Could not read the selected file.");
    }
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <span className="mark" aria-hidden="true"><i /></span>
          <span>OZLIND</span>
          <button className="icon mobile-close" onClick={() => setMobile(false)} aria-label="Close menu">×</button>
        </div>
        <button className="new" onClick={newChat}><span>＋</span> New conversation</button>

        <div className="side-section">
          <small>Workspace</small>
          <button className="nav active"><span>◈</span> AI Chat</button>
          <button className={`nav ${mode === "research" ? "active" : ""}`} onClick={() => setMode("research")}><span>⌁</span> Research</button>
          <button className={`nav ${mode === "image" ? "active" : ""}`} onClick={() => setMode("image")}><span>✦</span> Image creation</button>
        </div>

        <div className="side-section history">
          <small>Recent</small>
          {visible.slice().reverse().slice(0, 8).map((chat) => (
            <button className={`history-item ${chat.id === active ? "selected" : ""}`} key={chat.id} onClick={() => { setActive(chat.id); setMobile(false); }}>
              {chat.title}
            </button>
          ))}
          {!visible.length && <p className="muted">No conversations yet.</p>}
        </div>

        <div className="side-bottom">
          <button className="nav" onClick={() => setSettingsOpen(true)}><span>⚙</span> Settings</button>
          <div className="profile"><div className="avatar">O</div><div><strong>OZLIND</strong><small>Personal workspace</small></div></div>
        </div>
      </aside>

      {mobile && <button className="scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}

      <main className="main">
        <header>
          <button className="icon menu" onClick={() => setMobile(true)} aria-label="Open menu">☰</button>
          <div className="top-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /><kbd>/</kbd></div>
          <button className="icon" onClick={newChat} aria-label="New conversation">＋</button>
        </header>

        <section className="workspace">
          {!current || !current.messages.length ? (
            <div className="welcome">
              <div className="hero-mark"><span className="mark big" aria-hidden="true"><i /></span></div>
              <p className="eyebrow">INTELLIGENCE, REFINED</p>
              <h1>What can OZLIND<br /><span>help you create?</span></h1>
              <p className="lead">A focused AI workspace for thinking, researching and making progress.</p>
              <div className="prompts">
                <button onClick={() => send("Explain this concept simply")}>Explain something simply <span>→</span></button>
                <button onClick={() => send("Help me plan a project")}>Help me plan a project <span>→</span></button>
                <button onClick={() => { setMode("research"); setInput("Research a current topic"); }}>Research a current topic <span>→</span></button>
              </div>
            </div>
          ) : (
            <div className="conversation">
              <div className="conversation-head"><div><span className="eyebrow">CONVERSATION</span><h2>{current.title}</h2></div><div className="head-actions"><button onClick={clearChat}>Clear</button></div></div>
              <div className="messages">
                {current.messages.map((message, index) => (
                  <article className={`message ${message.role} ${message.error ? "error" : ""}`} key={message.id}>
                    <div className="message-label">{message.role === "user" ? "YOU" : "OZLIND"}</div>
                    <div className="message-body">
                      {message.content ? <Markdown content={message.content} /> : <span className="thinking"><i /><i /><i /></span>}
                      {message.image && <img className="generated-image" src={message.image} alt="Generated by OZLIND" />}
                      {message.streaming && message.content && <span className="cursor" aria-label="Generating" />}
                      {message.sources?.length > 0 && (
                        <details className="sources">
                          <summary>Sources · {message.sources.length}</summary>
                          {message.sources.map((source, sourceIndex) => (
                            <a key={`${source.url}-${sourceIndex}`} href={source.url} target="_blank" rel="noreferrer">
                              <span>{source.domain || sourceIndex + 1}</span>{source.title || source.url}
                            </a>
                          ))}
                        </details>
                      )}
                    </div>
                    {!message.streaming && (
                      <div className="message-actions">
                        {message.content && <button onClick={() => navigator.clipboard?.writeText(message.content)}>Copy</button>}
                        {message.role === "user" && <button onClick={() => editMessage(message)}>Edit</button>}
                        {message.role === "assistant" && <button onClick={() => regenerate(index)}>Regenerate</button>}
                        <button onClick={() => removeMessage(message.id)}>Delete</button>
                      </div>
                    )}
                  </article>
                ))}
                <div ref={endRef} />
              </div>
            </div>
          )}

          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

          <div className="composer-wrap">
            <div className="mode-row" aria-label="AI mode">
              {MODES.map(([id, label]) => <button key={id} className={mode === id ? "chosen" : ""} onClick={() => setMode(id)}>{label}</button>)}
            </div>
            {attachments.length > 0 && (
              <div className="attachment-row" aria-label="Selected attachments">
                {attachments.map((file) => <button key={`${file.name}-${file.mimeType}`} onClick={() => setAttachments((items) => items.filter((item) => item.name !== file.name))} title="Remove attachment">{file.name} ×</button>)}
              </div>
            )}
            <div className="composer">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={mode === "image" ? "Describe the image you want…" : "Ask OZLIND anything…"} rows={1} aria-label="Message OZLIND" />
              <div className="composer-tools">
                <div>
                  <button className="attach" onClick={() => fileRef.current?.click()} aria-label="Attach file">＋</button>
                  <input ref={fileRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv" onChange={handleFiles} />
                  <span className="hint">Shift + Enter for new line</span>
                </div>
                {busy ? <button className="send stop" onClick={stop} aria-label="Stop generation">■</button> : <button className="send" onClick={() => send()} disabled={!input.trim()} aria-label="Send message">↑</button>}
              </div>
            </div>
            <p className="disclaimer">OZLIND can make mistakes. Check important information.</p>
          </div>
        </section>
      </main>

      {settingsOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="modal">
            <div className="modal-head"><div><span className="eyebrow">PREFERENCES</span><h2>Settings</h2></div><button className="icon" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
            <label>Custom instructions<textarea value={custom} onChange={(event) => setCustom(event.target.value.slice(0, 3000))} placeholder="Tell OZLIND how you prefer to work…" /></label>
            <p>These preferences apply to future AI responses and stay on this device.</p>
            <button className="primary" onClick={() => setSettingsOpen(false)}>Save preferences</button>
          </div>
        </div>
      )}
    </div>
  );
}
