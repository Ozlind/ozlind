"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronDown,
  Code2,
  Copy,
  FileText,
  Lightbulb,
  Map,
  Menu,
  MessageSquare,
  Moon,
  Paperclip,
  PanelLeftClose,
  PenLine,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Telescope,
  Trash2,
  X,
  Zap,
  Sun,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const HISTORY_KEY = "ozlind_history_v2";
const SETTINGS_KEY = "ozlind_settings_v2";

const MODES = [
  { id: "auto", label: "Auto", icon: Sparkles },
  { id: "fast", label: "Fast", icon: Zap },
  { id: "pro", label: "Pro", icon: BrainCircuit },
  { id: "vision", label: "Vision", icon: Sparkles },
  { id: "research", label: "Research", icon: Telescope },
];

const suggestions = [
  ["Strategy", Rocket, "Design a launch strategy for my sustainable skincare brand."],
  ["Writing", PenLine, "Turn my rough notes into a polished client proposal."],
  ["Planning", Map, "Build a seven-day Japan itinerary focused on design and food."],
  ["Analysis", Code2, "Analyze this quarter's customer data and surface the key trends."],
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function favicon(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      new URL(url).hostname
    )}&sz=32`;
  } catch {
    return "";
  }
}

function OzlindIcon({ id, size = 18, className = "", title }) {
  return (
    <svg
      className={`ozlind-svg-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <use href={`/ozlind-icons.svg#${id}`} />
    </svg>
  );
}

function OzlindMark({ className = "", size = 35 }) {
  return (
    <svg
      className={`ozlind-mark-svg ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      aria-hidden="true"
    >
      <use href="/ozlind-icons.svg#ozl-mark" />
    </svg>
  );
}

export default function OzlindApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [research, setResearch] = useState(false);
  const [file, setFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [settings, setSettings] = useState({
    memory: true,
    saveHistory: true,
    style: "balanced",
    length: "medium",
    customInstructions: "",
  });

  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const endRef = useRef(null);

  const title = messages[0]?.content
    ? messages.find((message) => message.role === "user")?.content.slice(0, 42) ||
      "New conversation"
    : "New conversation";

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return history;
    return history.filter((item) => item.title.toLowerCase().includes(query));
  }, [history, historySearch]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("ozlind-theme");
    const preferred =
      savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setDark(preferred === "dark");
    setHistory(readJSON(HISTORY_KEY, []));
    setSettings({
      memory: true,
      saveHistory: true,
      style: "balanced",
      length: "medium",
      customInstructions: "",
      ...readJSON(SETTINGS_KEY, {}),
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("ozlind-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function toast(message) {
    setNotice(message);
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => setNotice(""), 2600);
  }

  function autosize() {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }

  function persistHistory(next) {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 50)));
    } catch {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
    setSettingsOpen(false);
    toast("Preferences saved");
  }

  function newConversation() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages([]);
    setInput("");
    setFile(null);
    setSidebarOpen(false);
    toast("New conversation");
    requestAnimationFrame(autosize);
  }

  function loadConversation(item) {
    setMessages(item.messages || []);
    setSidebarOpen(false);
  }

  async function copyMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(""), 1400);
    } catch {
      toast("Copy failed");
    }
  }

  async function shareConversation() {
    const text = messages
      .map((message) => `${message.role === "user" ? "You" : "OZLIND"}:\n${message.content}`)
      .join("\n\n");

    if (!text) {
      toast("Nothing to share yet");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} 鈥� Ozlind AI`, text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(text);
    toast("Conversation copied");
  }

  async function sendMessage(text = input) {
    const prompt = text.trim();
    if (!prompt || isStreaming) return;

    const userMessage = {
      id: makeId(),
      role: "user",
      content: prompt,
      attachments: file ? [{ name: file.name, mimeType: file.type }] : [],
    };

    const assistantId = makeId();
    const nextMessages = [...messages, userMessage];

    setMessages([
      ...nextMessages,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setFile(null);
    setSidebarOpen(false);
    setIsStreaming(true);
    requestAnimationFrame(autosize);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let userContent = prompt;

      // Images are sent as data URLs for Gemini vision.
      if (file && file.type.startsWith("image/")) {
        const dataUrl = await fileToDataUrl(file);
        userContent = [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ];
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userContent }],
          mode: mode === "research" ? "research" : mode,
          research: research || mode === "research",
          memory: settings.memory,
          responseStyle: settings.style,
          responseLength: settings.length,
          customInstructions: settings.customInstructions,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "OZLIND could not complete the request.");
      }

      if (!response.body) throw new Error("The AI response stream is unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let sources = [];

      const updateAssistant = (patch) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, ...patch } : message
          )
        );
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;

          let event;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.type === "delta") {
            assistantText += event.content || "";
            updateAssistant({ content: assistantText });
          }

          if (event.type === "sources") {
            sources = event.sources || [];
            updateAssistant({ sources });
          }

          if (event.type === "error") {
            throw new Error(event.error || "Generation failed.");
          }
        }
      }

      updateAssistant({ content: assistantText || "I couldn't generate a response.", streaming: false });

      if (settings.saveHistory) {
        const item = {
          id: makeId(),
          title: prompt.slice(0, 64),
          updatedAt: Date.now(),
          messages: [...nextMessages, {
            id: assistantId,
            role: "assistant",
            content: assistantText,
            sources,
          }],
        };
        persistHistory([item, ...history.filter((entry) => entry.title !== item.title)]);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: error?.message || "Something went wrong.",
                  streaming: false,
                  error: true,
                }
              : message
          )
        );
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((current) =>
      current.map((message) =>
        message.streaming ? { ...message, streaming: false } : message
      )
    );
  }

  async function regenerate(index) {
    const target = messages[index - 1];
    if (!target || target.role !== "user" || isStreaming) return;
    setMessages(messages.slice(0, index));
    await sendMessage(target.content);
  }

  function editMessage(message) {
    setInput(message.content);
    setMessages((current) => current.filter((item) => item.id !== message.id));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autosize();
    });
  }

  function deleteMessage(id) {
    setMessages((current) => current.filter((message) => message.id !== id));
  }

  function onFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!selected.type.startsWith("image/") && !allowed.includes(selected.type)) {
      toast("This file type is not supported.");
      event.target.value = "";
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast("File is too large. Keep attachments under 10 MB.");
      event.target.value = "";
      return;
    }
    setFile(selected);
    toast("File attached");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`} aria-label="Ozlind navigation">
        <div className="brand-row">
          <button className="brand" onClick={newConversation} aria-label="Ozlind AI home">
            <span className="brand-mark" aria-hidden="true"><OzlindMark size={35} /></span>
            <span className="brand-name">Ozlind <span>AI</span></span>
          </button>
          <button className="sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
            <OzlindIcon id="i-close" size={18} />
          </button>
        </div>

        <button className="primary-action" type="button" onClick={newConversation}>
          <span className="primary-action-left"><OzlindIcon id="i-new-conversation" size={17} /> New conversation</span>
          <span className="shortcut">鈱� N</span>
        </button>

        <div className="search-wrap">
          <OzlindIcon id="i-search" size={16} />
          <input
            className="search-input"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            type="search"
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </div>

        <div className="history-scroll">
          <p className="history-label">Conversations</p>
          {filteredHistory.length === 0 ? (
            <p className="history-empty">No saved conversations yet.</p>
          ) : (
            filteredHistory.map((item) => (
              <button
                className="history-item"
                key={item.id}
                type="button"
                onClick={() => loadConversation(item)}
              >
                <OzlindIcon id="i-history" size={15} />
                <span>{item.title}</span>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <strong>Unlock Ozlind Pro</strong>
            <p>More intelligence, longer context, and priority access.</p>
            <button type="button" onClick={() => toast("Pro plans are coming soon")}>View plans</button>
          </div>

          <button className="user-row" type="button" onClick={() => setSettingsOpen(true)}>
            <span className="user-avatar">OS</span>
            <span className="user-details">
              <strong>Ozlind Studio</strong>
              <small>Personal workspace</small>
            </span>
            <OzlindIcon id="i-settings" size={17} />
          </button>
        </div>
      </aside>

      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <OzlindIcon id="i-menu" size={19} />
            </button>

            <span className="top-title">{title}</span>
            <span className="top-divider" aria-hidden="true" />

            <div className={`model-switcher ${modelOpen ? "open" : ""}`}>
              <button
                className="model-button"
                onClick={() => setModelOpen((value) => !value)}
                aria-haspopup="true"
                aria-expanded={modelOpen}
              >
                <span className="model-gem"><Sparkles size={14} /></span>
                <strong>{MODES.find((item) => item.id === mode)?.label || "Auto"}</strong>
                <ChevronDown size={14} />
              </button>

              <div className="model-menu" role="menu">
                <div className="model-menu-title">Choose a mode</div>
                {MODES.map(({ id, label, icon: Icon }) => (
                  <button
                    className={`model-option ${mode === id ? "active" : ""}`}
                    key={id}
                    type="button"
                    onClick={() => {
                      setMode(id);
                      setResearch(id === "research");
                      setModelOpen(false);
                    }}
                  >
                    <span className="model-option-icon"><Icon size={16} /></span>
                    <span>
                      <strong>{label}</strong>
                      <small>
                        {id === "auto" ? "Automatic routing" :
                          id === "fast" ? "Quick everyday responses" :
                          id === "pro" ? "Deeper reasoning" :
                          id === "vision" ? "Images and visual understanding" :
                          "Current web information"}
                      </small>
                    </span>
                    {mode === id && <Check className="check" size={15} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <span className="privacy-pill"><ShieldCheck size={14} /> Private</span>
            <button className="icon-button share-button" onClick={shareConversation} aria-label="Share conversation">
              <Share2 size={17} />
            </button>
            <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Switch theme">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <main className="conversation">
          {messages.length === 0 ? (
            <section className="welcome">
              <div className="welcome-kicker">
                <span className="pulse-dot" />
                Ozlind is ready to create
              </div>

              <h1>What will we <span className="gradient-text">make possible</span> today?</h1>
              <p className="welcome-subtitle">
                Think, write, research, and build with an AI workspace designed to keep your ideas clear and moving forward.
              </p>

              <div className="suggestion-grid">
                {suggestions.map(([tag, Icon, prompt]) => (
                  <button className="suggestion-card" key={tag} type="button" onClick={() => sendMessage(prompt)}>
                    <span className="suggestion-top">
                      <span className="suggestion-icon"><Icon size={17} /></span>
                      <span className="suggestion-tag">{tag}</span>
                    </span>
                    <p>{prompt}</p>
                  </button>
                ))}
              </div>

              <div className="capabilities">
                <span className="capability-label">Start with</span>
                {[
                  ["Brainstorm", Lightbulb, "Help me brainstorm "],
                  ["Write", FileText, "Help me write "],
                  ["Research", Telescope, "Research and summarize "],
                  ["Code", Code2, "Help me code "],
                ].map(([label, Icon, value]) => (
                  <button className="capability" key={label} type="button" onClick={() => {
                    setInput(value);
                    requestAnimationFrame(() => {
                      autosize();
                      textareaRef.current?.focus();
                    });
                  }}>
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="messages" aria-live="polite">
              {messages.map((message, index) => (
                <article className={`message-row ${message.role}`} key={message.id}>
                  <div className="assistant-avatar" aria-hidden="true">
                    {message.role === "user" ? "Y" : ""}
                  </div>

                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.role === "user" ? "You" : "OZLIND"}</strong>
                      {message.streaming && <span className="streaming-label"><i /> Generating</span>}
                    </div>

                    <div className="message-content">
                      {message.content ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        <div className="thinking"><i /><i /><i /></div>
                      )}
                      {message.streaming && message.content && <span className="typing-cursor" />}
                    </div>

                    {message.attachments?.length > 0 && (
                      <div className="message-files">
                        {message.attachments.map((attachment) => (
                          <span key={`${attachment.name}-${attachment.mimeType}`}>
                            <Paperclip size={12} /> {attachment.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {message.sources?.length > 0 && (
                      <details className="sources-panel">
                        <summary>
                          <span className="source-icons">
                            {message.sources.slice(0, 4).map((source) => (
                              <img key={source.url} src={favicon(source.url)} alt="" />
                            ))}
                          </span>
                          <span>Sources</span>
                          <b>{message.sources.length}</b>
                          <ChevronDown size={13} />
                        </summary>
                        <div className="source-list">
                          {message.sources.map((source) => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                              <img src={favicon(source.url)} alt="" />
                              <span><strong>{source.title || source.domain}</strong><small>{source.domain}</small></span>
                              <ArrowUp size={13} style={{ transform: "rotate(45deg)" }} />
                            </a>
                          ))}
                        </div>
                      </details>
                    )}

                    {!message.streaming && (
                      <div className="message-actions">
                        <button onClick={() => copyMessage(message)}>
                          <OzlindIcon id="i-copy" size={13} /> {copiedId === message.id ? "Copied" : "Copy"}
                        </button>
                        {message.role === "user" && (
                          <button onClick={() => editMessage(message)}>Edit</button>
                        )}
                        {message.role === "assistant" && (
                          <button onClick={() => regenerate(index)}>
                            <OzlindIcon id="i-regenerate" size={13} /> Regenerate
                          </button>
                        )}
                        <button onClick={() => deleteMessage(message.id)}>
                          <OzlindIcon id="i-delete" size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <div ref={endRef} />
            </section>
          )}
        </main>

        <footer className="composer-wrap">
          {file && (
            <div className="attached-file">
              <span><OzlindIcon id="i-attach" size={14} /><span>{file.name}</span></span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove file"><OzlindIcon id="i-close" size={14} /></button>
            </div>
          )}

          <form className="composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
            <textarea
              ref={textareaRef}
              className="prompt-input"
              rows={1}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                requestAnimationFrame(autosize);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={mode === "research" ? "What should OZLIND research?" : "Ask Ozlind anything..."}
              aria-label="Message Ozlind"
            />

            <div className="composer-footer">
              <div className="composer-tools">
                <button className="tool-button" type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a file">
                  <OzlindIcon id="i-attach" size={17} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept=".pdf,.txt,.md,.doc,.docx,.csv,.png,.jpg,.jpeg"
                  onChange={onFileChange}
                />
                <button
                  className={`tool-button web-label ${research ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setResearch((value) => !value);
                    setMode((current) => current === "research" ? "auto" : "research");
                  }}
                  aria-label="Search the web"
                >
                  <OzlindIcon id="i-web-research" size={17} />
                  <span>Web</span>
                </button>
              </div>

              <div className="composer-send">
                {isStreaming ? (
                  <button className="send-button" type="button" onClick={stopGeneration} aria-label="Stop generation">
                    <span className="stop-square" />
                  </button>
                ) : (
                  <button className="send-button" type="submit" disabled={!input.trim()} aria-label="Send message">
                    <OzlindIcon id="i-send" size={18} />
                  </button>
                )}
              </div>
            </div>
          </form>

          <p className="composer-note">Ozlind may make mistakes. Verify important information.</p>
        </footer>
      </section>

      {settingsOpen && (
        <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="Preferences">
            <div className="dialog-header">
              <div>
                <strong>Preferences</strong>
                <small>Control how OZLIND behaves on this device.</small>
              </div>
              <button className="dialog-close" onClick={() => setSettingsOpen(false)} aria-label="Close preferences">
                <X size={17} />
              </button>
            </div>

            <div className="settings-profile">
              <span className="user-avatar">OS</span>
              <span><strong>Ozlind Studio</strong><small>Personal workspace</small></span>
            </div>

            <label className="setting-row">
              <span><strong>Save conversation history</strong><small>Keep chats on this device.</small></span>
              <input type="checkbox" checked={settings.saveHistory} onChange={(event) => setSettings({ ...settings, saveHistory: event.target.checked })} />
            </label>

            <label className="setting-row">
              <span><strong>Memory</strong><small>Use relevant supplied conversation context.</small></span>
              <input type="checkbox" checked={settings.memory} onChange={(event) => setSettings({ ...settings, memory: event.target.checked })} />
            </label>

            <div className="setting-field">
              <label htmlFor="responseStyle">Response style</label>
              <select id="responseStyle" value={settings.style} onChange={(event) => setSettings({ ...settings, style: event.target.value })}>
                <option value="balanced">Balanced</option>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
              </select>
            </div>

            <div className="setting-field">
              <label htmlFor="responseLength">Response length</label>
              <select id="responseLength" value={settings.length} onChange={(event) => setSettings({ ...settings, length: event.target.value })}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>

            <div className="setting-field">
              <label htmlFor="customInstructions">Custom instructions</label>
              <textarea
                id="customInstructions"
                rows={4}
                value={settings.customInstructions}
                maxLength={5000}
                onChange={(event) => setSettings({ ...settings, customInstructions: event.target.value })}
                placeholder="Tell OZLIND how you want responses written."
              />
            </div>

            <div className="dialog-actions">
              <button className="dialog-button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="dialog-button primary" onClick={saveSettings}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-icon"><Check size={15} /></span>
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
      }
