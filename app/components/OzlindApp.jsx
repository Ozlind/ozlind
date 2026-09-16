"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_HISTORY = "ozlind_history_v2";
const STORAGE_SETTINGS = "ozlind_settings_v2";

const DEFAULT_SETTINGS = {
  provider: "auto",
  research: false,
  memory: true,
  style: "balanced",
  length: "medium",
  customInstructions: "",
};

const PROVIDERS = [
  { id: "auto", label: "Auto", description: "OZLIND chooses the available provider" },
  { id: "groq", label: "Groq", description: "Fast primary model" },
  { id: "gemini", label: "Gemini", description: "Vision and Gemini models" },
  { id: "experiential", label: "Experiential", description: "Alternative AI provider" },
];

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createConversation() {
  return {
    id: makeId("chat"),
    title: "New conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function titleFromMessage(text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "New conversation";

  if (clean.length <= 42) return clean;

  return `${clean.slice(0, 42).trim()}…`;
}

function isImageRequest(text) {
  const value = String(text || "").toLowerCase();

  const patterns = [
    "create an image",
    "create image",
    "generate an image",
    "generate image",
    "make an image",
    "make image",
    "draw an image",
    "draw image",
    "create a picture",
    "generate a picture",
    "make a picture",
    "image of",
    "picture of",
  ];

  return patterns.some((pattern) => value.includes(pattern));
}

function extractImagePrompt(text) {
  return String(text || "")
    .replace(
      /^(please\s+)?(create|generate|make|draw)\s+(an?\s+)?(image|picture)\s*(of)?/i,
      ""
    )
    .trim();
}

function Icon({ name, size = 18 }) {
  const icons = {
    plus: "+",
    menu: "☰",
    search: "⌕",
    history: "◷",
    settings: "⚙",
    close: "×",
    send: "↑",
    stop: "■",
    copy: "▣",
    edit: "✎",
    refresh: "↻",
    trash: "⌫",
    globe: "◎",
    image: "▧",
    chevron: "›",
    check: "✓",
  };

  return (
    <span
      className="icon"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(12, size - 2) }}
    >
      {icons[name] || "•"}
    </span>
  );
}

export default function OzlindApp() {
  const [booting, setBooting] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState("chat");

  const [conversation, setConversation] = useState(() =>
    createConversation()
  );

  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBooting(false);
    }, 850);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const storedHistory = safeParse(
        window.localStorage.getItem(STORAGE_HISTORY),
        []
      );

      const storedSettings = safeParse(
        window.localStorage.getItem(STORAGE_SETTINGS),
        DEFAULT_SETTINGS
      );

      if (Array.isArray(storedHistory)) {
        setHistory(storedHistory);
      }

      if (storedSettings && typeof storedSettings === "object") {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...storedSettings,
        });
      }
    } catch {
      // Local storage can fail in privacy-restricted browsers.
    }
  }, []);

  useEffect(() => {
    if (booting) return;

    try {
      window.localStorage.setItem(
        STORAGE_SETTINGS,
        JSON.stringify(settings)
      );
    } catch {
      // Ignore storage failures.
    }
  }, [settings, booting]);

  useEffect(() => {
    if (!booting) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [conversation.messages, booting]);

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return history;

    return history.filter((item) =>
      String(item.title || "").toLowerCase().includes(query)
    );
  }, [history, search]);

  function showNotice(message) {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2600);
  }

  function persistConversation(nextConversation) {
    setHistory((current) => {
      const exists = current.some(
        (item) => item.id === nextConversation.id
      );

      const updated = exists
        ? current.map((item) =>
            item.id === nextConversation.id ? nextConversation : item
          )
        : [nextConversation, ...current];

      const trimmed = updated
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50);

      try {
        window.localStorage.setItem(
          STORAGE_HISTORY,
          JSON.stringify(trimmed)
        );
      } catch {
        // Ignore storage failures.
      }

      return trimmed;
    });
  }

  function startNewChat() {
    abortRef.current?.abort();

    setSending(false);
    setEditingId(null);
    setInput("");
    setConversation(createConversation());
    setView("chat");
    setSidebarOpen(false);
  }

  function openConversation(item) {
    setConversation(item);
    setView("chat");
    setSidebarOpen(false);
  }

  function clearCurrentChat() {
    setConversation((current) => ({
      ...current,
      title: "New conversation",
      messages: [],
      updatedAt: Date.now(),
    }));

    setEditingId(null);
  }

  function updateConversationMessages(messages, title) {
    const next = {
      ...conversation,
      messages,
      title: title || conversation.title,
      updatedAt: Date.now(),
    };

    setConversation(next);
    persistConversation(next);
  }

  function handleTextareaKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  async function generateImage(prompt) {
    const response = await fetch("/api/image-generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        aspect: "square",
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Image generation could not be completed."
      );
    }

    return data;
  }

  async function sendMessage() {
    const message = input.trim();

    if (!message || sending) return;

    setInput("");
    setEditingId(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage = {
      id: makeId("msg"),
      role: "user",
      content: message,
      createdAt: Date.now(),
    };

    const nextMessages = [...conversation.messages, userMessage];

    const nextTitle =
      conversation.messages.length === 0
        ? titleFromMessage(message)
        : conversation.title;

    updateConversationMessages(nextMessages, nextTitle);

    setSending(true);

    const imageRequest = isImageRequest(message);

    if (imageRequest) {
      const assistantId = makeId("msg");

      const loadingMessage = {
        id: assistantId,
        role: "assistant",
        content: "Creating your image…",
        createdAt: Date.now(),
        imageLoading: true,
      };

      const withLoading = [...nextMessages, loadingMessage];

      updateConversationMessages(withLoading, nextTitle);

      try {
        const result = await generateImage(
          extractImagePrompt(message) || message
        );

        const finalMessages = withLoading.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: "Image created.",
                imageUrl: result.imageUrl,
                imageLoading: false,
                provider: result.provider,
                model: result.model,
              }
            : item
        );

        updateConversationMessages(finalMessages, nextTitle);
      } catch (error) {
        const finalMessages = withLoading.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content:
                  error?.message ||
                  "Image generation failed. Please try again.",
                imageLoading: false,
                error: true,
              }
            : item
        );

        updateConversationMessages(finalMessages, nextTitle);
      } finally {
        setSending(false);
      }

      return;
    }

    const assistantId = makeId("msg");

    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      streaming: true,
    };

    const messagesWithAssistant = [
      ...nextMessages,
      assistantMessage,
    ];

    updateConversationMessages(messagesWithAssistant, nextTitle);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          messages: nextMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          provider: settings.provider,
          research: settings.research,
          memory: settings.memory,
          style: settings.style,
          length: settings.length,
          customInstructions: settings.customInstructions,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Request failed with status ${response.status}`
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("text/event-stream")) {
        const data = await response.json();

        if (!data?.text) {
          throw new Error("The AI returned an empty response.");
        }

        const finalMessages = messagesWithAssistant.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: data.text,
                streaming: false,
                provider: data.provider,
                model: data.model,
                sources: data.sources || [],
              }
            : item
        );

        updateConversationMessages(finalMessages, nextTitle);
        return;
      }

      if (!response.body) {
        throw new Error("The AI stream was unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let accumulated = "";
      let provider = "";
      let model = "";
      let sources = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const raw = line.slice(5).trim();

          if (!raw || raw === "[DONE]") continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === "delta") {
              accumulated += event.text || "";
              provider = event.provider || provider;
              model = event.model || model;

              setConversation((current) => {
                const updatedMessages = current.messages.map(
                  (item) =>
                    item.id === assistantId
                      ? {
                          ...item,
                          content: accumulated,
                          streaming: true,
                          provider,
                          model,
                        }
                      : item
                );

                return {
                  ...current,
                  messages: updatedMessages,
                  updatedAt: Date.now(),
                };
              });
            }

            if (event.type === "done") {
              sources = Array.isArray(event.sources)
                ? event.sources
                : [];
            }
          } catch {
            // Ignore malformed SSE chunks.
          }
        }
      }

      setConversation((current) => {
        const finalMessages = current.messages.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content:
                  accumulated ||
                  "The AI returned an empty response.",
                streaming: false,
                provider,
                model,
                sources,
              }
            : item
        );

        const next = {
          ...current,
          messages: finalMessages,
          updatedAt: Date.now(),
        };

        persistConversation(next);

        return next;
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        setConversation((current) => {
          const finalMessages = current.messages.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content:
                    item.content ||
                    "Generation stopped.",
                  streaming: false,
                }
              : item
          );

          const next = {
            ...current,
            messages: finalMessages,
            updatedAt: Date.now(),
          };

          persistConversation(next);

          return next;
        });

        return;
      }

      const errorText =
        error?.message ||
        "Something went wrong while contacting OZLIND.";

      setConversation((current) => {
        const finalMessages = current.messages.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: errorText,
                streaming: false,
                error: true,
              }
            : item
        );

        const next = {
          ...current,
          messages: finalMessages,
          updatedAt: Date.now(),
        };

        persistConversation(next);

        return next;
      });
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function copyMessage(content) {
    try {
      await navigator.clipboard.writeText(content);
      showNotice("Copied");
    } catch {
      showNotice("Copy failed");
    }
  }

  function editMessage(message) {
    setInput(message.content);
    setEditingId(message.id);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  function deleteMessage(messageId) {
    const nextMessages = conversation.messages.filter(
      (item) => item.id !== messageId
    );

    updateConversationMessages(nextMessages);
  }

  async function regenerateMessage(messageId) {
    const index = conversation.messages.findIndex(
      (item) => item.id === messageId
    );

    if (index < 0) return;

    const assistant = conversation.messages[index];

    if (assistant.role !== "assistant") return;

    const previousUser = conversation.messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user");

    if (!previousUser) return;

    const messagesBeforeAssistant =
      conversation.messages.slice(0, index);

    setConversation((current) => ({
      ...current,
      messages: messagesBeforeAssistant,
    }));

    setInput(previousUser.content);

    window.setTimeout(() => {
      setInput("");
      sendMessage();
    }, 100);
  }

  function handleInputChange(event) {
    setInput(event.target.value);

    const target = event.target;

    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  }

  function renderMessage(message) {
    const isUser = message.role === "user";

    return (
      <article
        key={message.id}
        className={`message-row ${isUser ? "message-user" : "message-ai"}`}
      >
        {!isUser && (
          <div className="assistant-avatar">
            <span>O</span>
          </div>
        )}

        <div className="message-column">
          <div
            className={`message-bubble ${
              isUser ? "user-bubble" : "ai-bubble"
            }`}
          >
            {!isUser && (
              <div className="message-author">
                <span>OZLIND</span>
                {message.streaming && (
                  <span className="thinking-label">
                    thinking
                  </span>
                )}
              </div>
            )}

            <div className="message-content">
              {message.content || (
                <span className="typing-dots">
                  <i />
                  <i />
                  <i />
                </span>
              )}

              {message.imageLoading && (
                <div className="image-loading">
                  <span className="loader" />
                  <span>Generating image…</span>
                </div>
              )}

              {message.imageUrl && (
                <div className="generated-image">
                  <img
                    src={message.imageUrl}
                    alt="Generated by OZLIND"
                  />
                </div>
              )}
            </div>

            {message.sources?.length > 0 && (
              <div className="sources-box">
                <div className="sources-title">
                  <Icon name="globe" size={14} />
                  Web sources
                </div>

                {message.sources.slice(0, 5).map((source, index) => (
                  <a
                    key={`${source.url}-${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="source-item"
                  >
                    <span>{index + 1}</span>
                    <span>{source.title || source.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {!message.streaming && (
            <div className="message-actions">
              <button
                onClick={() => copyMessage(message.content)}
                title="Copy"
              >
                <Icon name="copy" size={14} />
              </button>

              {isUser && (
                <button
                  onClick={() => editMessage(message)}
                  title="Edit"
                >
                  <Icon name="edit" size={14} />
                </button>
              )}

              {!isUser && (
                <button
                  onClick={() => regenerateMessage(message.id)}
                  title="Regenerate"
                >
                  <Icon name="refresh" size={14} />
                </button>
              )}

              <button
                onClick={() => deleteMessage(message.id)}
                title="Delete"
              >
                <Icon name="trash" size={14} />
              </button>

              {message.provider && (
                <span className="message-provider">
                  {message.provider}
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  function renderChat() {
    const hasMessages = conversation.messages.length > 0;

    return (
      <section className="chat-view">
        <div className="chat-header">
          <div className="chat-heading">
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" size={20} />
            </button>

            <div>
              <div className="eyebrow">WORKSPACE</div>
              <h1>AI Chat</h1>
            </div>
          </div>

          <div className="header-actions">
            {hasMessages && (
              <button
                className="ghost-button"
                onClick={clearCurrentChat}
              >
                Clear
              </button>
            )}

            <button
              className="new-chat-button"
              onClick={startNewChat}
            >
              <Icon name="plus" size={17} />
              <span>New Chat</span>
            </button>
          </div>
        </div>

        {!hasMessages ? (
          <div className="empty-chat">
            <div className="hero-mark">
              <span>O</span>
            </div>

            <div className="hero-kicker">
              INTELLIGENCE, REFINED.
            </div>

            <h2>What can OZLIND help you with?</h2>

            <p>
              Ask questions, explore ideas, research the web,
              analyze images, or create something new.
            </p>

            <div className="prompt-grid">
              <button
                onClick={() =>
                  setInput("Explain quantum computing simply")
                }
              >
                <strong>Explain something</strong>
                <span>Make a complex topic simple</span>
              </button>

              <button
                onClick={() =>
                  setInput("Research the latest AI developments")
                }
              >
                <strong>Research the web</strong>
                <span>Find current information</span>
              </button>

              <button
                onClick={() =>
                  setInput(
                    "Create an image of a cinematic Kerala landscape at sunset"
                  )
                }
              >
                <strong>Create an image</strong>
                <span>Generate directly in chat</span>
              </button>

              <button
                onClick={() =>
                  setInput("Help me plan a productive week")
                }
              >
                <strong>Plan something</strong>
                <span>Turn ideas into an action plan</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-area">
            <div className="messages-inner">
              {conversation.messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <div className="composer-zone">
          <div className="composer">
            <div className="composer-top">
              {settings.research && (
                <span className="composer-chip">
                  <Icon name="globe" size={13} />
                  Web Research
                </span>
              )}

              {settings.memory && (
                <span className="composer-chip muted">
                  Context on
                </span>
              )}

              {editingId && (
                <span className="composer-chip editing">
                  Editing message
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setInput("");
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Message OZLIND…"
              rows={1}
              disabled={sending}
            />

            <div className="composer-bottom">
              <div className="composer-tools">
                <button
                  className={`tool-button ${
                    settings.research ? "active" : ""
                  }`}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      research: !current.research,
                    }))
                  }
                  title="Toggle web research"
                >
                  <Icon name="globe" size={17} />
                </button>

                <button
                  className="tool-button"
                  onClick={() =>
                    showNotice("Image attachments coming next")
                  }
                  title="Attach image"
                >
                  <Icon name="image" size={17} />
                </button>

                <div className="provider-select-wrap">
                  <select
                    value={settings.provider}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        provider: event.target.value,
                      }))
                    }
                    aria-label="AI provider"
                  >
                    {PROVIDERS.map((provider) => (
                      <option
                        key={provider.id}
                        value={provider.id}
                      >
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className={`send-button ${
                  sending ? "stop-button" : ""
                }`}
                onClick={sending ? stopGeneration : sendMessage}
                disabled={!sending && !input.trim()}
                aria-label={sending ? "Stop" : "Send"}
              >
                <Icon
                  name={sending ? "stop" : "send"}
                  size={17}
                />
              </button>
            </div>
          </div>

          <div className="composer-note">
            OZLIND can make mistakes. Verify important information.
          </div>
        </div>
      </section>
    );
  }

  function renderHistory() {
    return (
      <section className="secondary-view">
        <div className="secondary-header">
          <div>
            <div className="eyebrow">PERSONAL</div>
            <h1>History</h1>
          </div>

          <button
            className="new-chat-button"
            onClick={startNewChat}
          >
            <Icon name="plus" size={17} />
            New Chat
          </button>
        </div>

        <div className="history-search">
          <Icon name="search" size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations…"
          />
        </div>

        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon name="history" size={22} />
              </div>
              <h3>No conversations yet</h3>
              <p>Your conversations will appear here.</p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <button
                className="history-card"
                key={item.id}
                onClick={() => openConversation(item)}
              >
                <div className="history-card-icon">
                  <Icon name="history" size={17} />
                </div>

                <div className="history-card-body">
                  <strong>{item.title}</strong>
                  <span>
                    {item.messages?.length || 0} messages
                  </span>
                </div>

                <Icon name="chevron" size={18} />
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderResearch() {
    return (
      <section className="secondary-view">
        <div className="secondary-header">
          <div>
            <div className="eyebrow">AI TOOLS</div>
            <h1>Web Research</h1>
          </div>

          <button
            className="new-chat-button"
            onClick={() => {
              setSettings((current) => ({
                ...current,
                research: true,
              }));
              setView("chat");
            }}
          >
            <Icon name="globe" size={17} />
            Use in Chat
          </button>
        </div>

        <div className="research-hero">
          <div className="research-icon">
            <Icon name="globe" size={30} />
          </div>

          <h2>Live information, inside OZLIND.</h2>

          <p>
            Turn on Web Research in chat when you need
            current information, sources and recent facts.
          </p>

          <button
            className={`research-toggle ${
              settings.research ? "enabled" : ""
            }`}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                research: !current.research,
              }))
            }
          >
            <span className="toggle-dot" />
            {settings.research
              ? "Research enabled"
              : "Enable research"}
          </button>
        </div>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="secondary-view">
        <div className="secondary-header">
          <div>
            <div className="eyebrow">PERSONAL</div>
            <h1>Settings</h1>
          </div>
        </div>

        <div className="settings-panel">
          <div className="settings-section">
            <div>
              <strong>Conversation memory</strong>
              <p>
                Keep recent messages in the context sent to the AI.
              </p>
            </div>

            <button
              className={`switch ${
                settings.memory ? "on" : ""
              }`}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  memory: !current.memory,
                }))
              }
              aria-label="Toggle memory"
            >
              <span />
            </button>
          </div>

          <div className="settings-section">
            <div>
              <strong>Web Research</strong>
              <p>
                Allow current web information to be added to chat
                requests.
              </p>
            </div>

            <button
              className={`switch ${
                settings.research ? "on" : ""
              }`}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  research: !current.research,
                }))
              }
              aria-label="Toggle research"
            >
              <span />
            </button>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>Answer length</strong>
              <p>Control how much detail OZLIND uses.</p>
            </div>

            <div className="segmented">
              {["short", "medium", "long"].map((value) => (
                <button
                  key={value}
                  className={
                    settings.length === value ? "selected" : ""
                  }
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      length: value,
                    }))
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>Response style</strong>
              <p>Choose the default communication style.</p>
            </div>

            <div className="segmented wrap">
              {[
                "balanced",
                "professional",
                "friendly",
                "direct",
                "creative",
              ].map((value) => (
                <button
                  key={value}
                  className={
                    settings.style === value ? "selected" : ""
                  }
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      style: value,
                    }))
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section stacked">
            <div>
              <strong>Custom instructions</strong>
              <p>
                Optional preferences that OZLIND can use when
                answering.
              </p>
            </div>

            <textarea
              className="settings-textarea"
              value={settings.customInstructions}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  customInstructions: event.target.value,
                }))
              }
              placeholder="Example: Keep answers concise and use bullet points when useful."
              maxLength={3000}
            />
          </div>
        </div>
      </section>
    );
  }

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="boot-logo">
          <span>O</span>
        </div>

        <div className="boot-wordmark">OZLIND</div>

        <div className="boot-line">
          <span />
        </div>

        <div className="boot-status">
          Initializing intelligence
        </div>
      </div>
    );
  }

  return (
    <div className="ozlind-shell">
      {sidebarOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <button
            className="brand"
            onClick={() => {
              setView("chat");
              setSidebarOpen(false);
            }}
          >
            <div className="brand-mark">
              <span>O</span>
            </div>

            <div className="brand-text">
              <strong>OZLIND</strong>
              <span>AI PLATFORM</span>
            </div>
          </button>

          <button
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <button
          className="sidebar-new-chat"
          onClick={startNewChat}
        >
          <Icon name="plus" size={18} />
          <span>New Chat</span>
          <kbd>⌘ N</kbd>
        </button>

        <nav className="sidebar-nav">
          <div className="nav-label">WORKSPACE</div>

          <button
            className={`nav-item ${
              view === "chat" ? "active" : ""
            }`}
            onClick={() => {
              setView("chat");
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">
              <Icon name="search" size={17} />
            </span>
            <span>AI Chat</span>
            <span className="live-dot">LIVE</span>
          </button>

          <div className="nav-label tools-label">
            AI TOOLS
          </div>

          <button className="nav-item disabled">
            <span className="nav-icon">
              <Icon name="image" size={17} />
            </span>
            <span>Image Generator</span>
            <span className="next-badge">NEXT</span>
          </button>

          <button className="nav-item disabled">
            <span className="nav-icon">◫</span>
            <span>Photo Editor</span>
            <span className="next-badge">NEXT</span>
          </button>

          <button className="nav-item disabled">
            <span className="nav-icon">⌘</span>
            <span>Code Assistant</span>
            <span className="next-badge">NEXT</span>
          </button>

          <button className="nav-item disabled">
            <span className="nav-icon">▤</span>
            <span>Documents</span>
            <span className="next-badge">NEXT</span>
          </button>

          <button className="nav-item disabled">
            <span className="nav-icon">◉</span>
            <span>Voice AI</span>
            <span className="next-badge">NEXT</span>
          </button>

          <button
            className={`nav-item ${
              view === "research" ? "active" : ""
            }`}
            onClick={() => {
              setView("research");
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">
              <Icon name="globe" size={17} />
            </span>
            <span>Web Research</span>
            <span className="live-dot">LIVE</span>
          </button>

          <div className="nav-label personal-label">
            PERSONAL
          </div>

          <button
            className={`nav-item ${
              view === "history" ? "active" : ""
            }`}
            onClick={() => {
              setView("history");
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">
              <Icon name="history" size={17} />
            </span>
            <span>History</span>
          </button>

          <button
            className={`nav-item ${
              view === "settings" ? "active" : ""
            }`}
            onClick={() => {
              setView("settings");
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon">
              <Icon name="settings" size={17} />
            </span>
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="profile-avatar">A</div>

            <div className="profile-copy">
              <strong>Athul</strong>
              <span>OZLIND User</span>
            </div>

            <span className="profile-more">•••</span>
          </div>

          <div className="sidebar-version">
            OZLIND AI <span>v1</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="top-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="global-search">
            <Icon name="search" size={17} />
            <input
              placeholder="Search anything…"
              aria-label="Search"
            />
            <kbd>/</kbd>
          </div>

          <div className="topbar-status">
            <span className="status-dot" />
            <span>Online</span>
          </div>
        </header>

        <div className="workspace">
          {view === "chat" && renderChat()}
          {view === "history" && renderHistory()}
          {view === "research" && renderResearch()}
          {view === "settings" && renderSettings()}
        </div>
      </main>

      {notice && (
        <div className="toast">
          <Icon name="check" size={15} />
          {notice}
        </div>
      )}
    </div>
  );
    }
