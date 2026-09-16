'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_SETTINGS = {
  provider: 'auto',
  length: 'medium',
  style: 'balanced',
  memory: true,
  research: false,
  custom: '',
};

const PROVIDERS = {
  auto: {
    label: 'Auto',
    description: 'Recommended routing',
  },
  groq: {
    label: 'Groq',
    description: 'Fast text generation',
  },
  gemini: {
    label: 'Gemini',
    description: 'Multimodal and vision',
  },
  experiential: {
    label: 'Experiential',
    description: 'Alternative provider',
  },
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeTitle(text) {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  return value.slice(0, 54) || 'New conversation';
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id || makeId()),
      title: String(item.title || 'New conversation'),
      updatedAt: Number(item.updatedAt || Date.now()),
      messages: Array.isArray(item.messages)
        ? item.messages.filter(
            (message) =>
              message &&
              typeof message === 'object' &&
              (message.role === 'user' || message.role === 'assistant')
          )
        : [],
    }))
    .filter((item) => item.messages.length > 0)
    .slice(0, 40);
}

function cleanSettings(value) {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    provider: PROVIDERS[value.provider] ? value.provider : 'auto',
    length: ['short', 'medium', 'long'].includes(value.length)
      ? value.length
      : 'medium',
    style: ['balanced', 'concise', 'detailed'].includes(value.style)
      ? value.style
      : 'balanced',
    memory: value.memory !== false,
    research: value.research === true,
    custom: typeof value.custom === 'string' ? value.custom : '',
  };
}

function wantsImage(text) {
  return /\b(create|generate|make|draw|design|render|produce)\b.{0,100}\b(image|picture|photo|poster|illustration|wallpaper|portrait|logo|artwork)\b/i.test(
    String(text || '')
  );
}

function renderText(text) {
  const lines = String(text || '').split('\n');

  return lines.map((line, lineIndex) => {
    const parts = line
      .split(/(\*\*.*?\*\*|`.*?`)/g)
      .filter(Boolean);

    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={`part-${partIndex}`}>
                {part.slice(2, -2)}
              </strong>
            );
          }

          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code key={`part-${partIndex}`}>
                {part.slice(1, -1)}
              </code>
            );
          }

          return (
            <span key={`part-${partIndex}`}>
              {part}
            </span>
          );
        })}

        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

function Icon({ name, className = 'icon' }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <use href={`/ozlind-icons.svg#${name}`} />
    </svg>
  );
}

export default function OzlindApp() {
  const [boot, setBoot] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('chat');

  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [notice, setNotice] = useState('');

  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  /*
   * BOOT + SAFE LOCAL STORAGE
   */
  useEffect(() => {
    let savedHistory = [];
    let savedSettings = DEFAULT_SETTINGS;

    try {
      const rawHistory = window.localStorage.getItem('ozlind.history');
      const rawSettings = window.localStorage.getItem('ozlind.settings');

      savedHistory = cleanHistory(
        safeJsonParse(rawHistory || '[]', [])
      );

      savedSettings = cleanSettings(
        safeJsonParse(rawSettings || 'null', null)
      );
    } catch {
      savedHistory = [];
      savedSettings = DEFAULT_SETTINGS;
    }

    setHistory(savedHistory);
    setSettings(savedSettings);

    const timer = window.setTimeout(() => {
      setBoot(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, []);

  /*
   * PERSIST HISTORY SAFELY
   */
  useEffect(() => {
    if (boot) return;

    try {
      window.localStorage.setItem(
        'ozlind.history',
        JSON.stringify(history.slice(0, 40))
      );
    } catch {
      // Ignore storage errors.
    }
  }, [history, boot]);

  /*
   * PERSIST SETTINGS SAFELY
   */
  useEffect(() => {
    if (boot) return;

    try {
      window.localStorage.setItem(
        'ozlind.settings',
        JSON.stringify(settings)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [settings, boot]);

  const filteredHistory = useMemo(() => {
    const query = String(historySearch || '')
      .trim()
      .toLowerCase();

    if (!query) return history;

    return history.filter((item) =>
      String(item?.title || '')
        .toLowerCase()
        .includes(query)
    );
  }, [history, historySearch]);

  function showNotice(message) {
    setNotice(message);

    window.setTimeout(() => {
      setNotice('');
    }, 1400);
  }

  function updateSettings(patch) {
    setSettings((current) => ({
      ...current,
      ...patch,
    }));
  }

  function newChat() {
    abortRef.current?.abort();

    setLoading(false);
    setMessages([]);
    setAttachments([]);
    setInput('');
    setView('chat');
    setSidebarOpen(false);
    setModelOpen(false);
  }

  function openConversation(item) {
    if (!item || !Array.isArray(item.messages)) return;

    setMessages(item.messages);
    setView('chat');
    setSidebarOpen(false);
    setModelOpen(false);
  }

  function saveConversation(nextMessages) {
    if (!Array.isArray(nextMessages) || nextMessages.length === 0) {
      return;
    }

    const firstUserMessage = nextMessages.find(
      (message) => message?.role === 'user'
    );

    const firstMessageId = nextMessages[0]?.id;

    const existing = history.find((item) =>
      Array.isArray(item.messages) &&
      item.messages.some(
        (message) => message?.id === firstMessageId
      )
    );

    const conversationId = existing?.id || makeId();

    const entry = {
      id: conversationId,
      title: makeTitle(firstUserMessage?.content),
      updatedAt: Date.now(),
      messages: nextMessages.slice(-40),
    };

    setHistory((current) =>
      [entry, ...current.filter((item) => item.id !== conversationId)]
        .slice(0, 40)
    );
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(String(text || ''));
        showNotice('Copied');
      }
    } catch {
      showNotice('Copy failed');
    }
  }

  function editMessage(message) {
    if (!message || message.role !== 'user') return;

    setInput(String(message.content || ''));
    setView('chat');

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  function deleteMessage(id) {
    setMessages((current) =>
      current.filter((message) => message.id !== id)
    );
  }

  async function readStream(response, assistantId) {
    if (!response.body) {
      throw new Error('No response stream received.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
      const result = await reader.read();

      if (result.done) break;

      buffer += decoder.decode(result.value, {
        stream: true,
      });

      const chunks = buffer.split('\n\n');

      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const line = chunk
          .split('\n')
          .find((item) => item.startsWith('data: '));

        if (!line) continue;

        try {
          const payload = JSON.parse(line.slice(6));

          if (payload.type === 'delta') {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      thinking: false,
                      content:
                        String(message.content || '') +
                        String(payload.text || ''),
                      provider: payload.provider,
                      model: payload.model,
                    }
                  : message
              )
            );
          }

          if (
            payload.type === 'done' &&
            Array.isArray(payload.sources) &&
            payload.sources.length
          ) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      sources: payload.sources,
                    }
                  : message
              )
            );
          }
        } catch {
          // Ignore malformed stream chunks.
        }
      }
    }
  }

  async function sendMessage(overrideText) {
    const text = String(
      overrideText !== undefined ? overrideText : input
    ).trim();

    const currentAttachments = attachments;

    if (
      (!text && currentAttachments.length === 0) ||
      loading
    ) {
      return;
    }

    setNotice('');
    setInput('');
    setView('chat');
    setModelOpen(false);

    const userMessage = {
      id: makeId(),
      role: 'user',
      content:
        text || 'Analyze the attached image.',
      attachments: currentAttachments.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
      })),
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);
    setAttachments([]);
    setLoading(true);

    /*
     * IMAGE GENERATION
     */
    if (wantsImage(text)) {
      const assistantId = makeId();

      const imageMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        imageLoading: true,
      };

      setMessages([
        ...nextMessages,
        imageMessage,
      ]);

      try {
        const response = await fetch(
          '/api/image-generate',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              prompt: text,
            }),
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error ||
              'Image generation failed.'
          );
        }

        const finalMessages = [
          ...nextMessages,
          {
            id: assistantId,
            role: 'assistant',
            content: 'Generated image.',
            imageUrl: data.imageUrl,
            provider: data.provider,
            model: data.model,
          },
        ];

        setMessages(finalMessages);
        saveConversation(finalMessages);
      } catch (error) {
        const finalMessages = [
          ...nextMessages,
          {
            id: assistantId,
            role: 'assistant',
            content:
              "I couldn't generate the image. " +
              String(
                error?.message ||
                  'Please try again.'
              ),
          },
        ];

        setMessages(finalMessages);
        saveConversation(finalMessages);
      } finally {
        setLoading(false);
      }

      return;
    }

    /*
     * NORMAL CHAT
     */
    const assistantId = makeId();

    setMessages([
      ...nextMessages,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinking: true,
      },
    ]);

    const controller = new AbortController();

    abortRef.current = controller;

    try {
      const requestMessages = nextMessages.map(
        (message) => ({
          role: message.role,
          content: String(
            message.content || ''
          ),
        })
      );

      const body = {
        message: text,
        messages: requestMessages,

        provider: settings.provider,
        length: settings.length,
        style: settings.style,

        memory: settings.memory,
        research: settings.research,

        customInstructions:
          settings.custom,

        attachments:
          currentAttachments.map((file) => ({
            mimeType: file.mimeType,
            data: file.data,
          })),
      };

      const response = await fetch(
        '/api/chat',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.error ||
            `Request failed (${response.status})`
        );
      }

      const contentType =
        response.headers.get('content-type') ||
        '';

      /*
       * STREAMING RESPONSE
       */
      if (
        contentType.includes(
          'text/event-stream'
        )
      ) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  thinking: false,
                }
              : message
          )
        );

        await readStream(
          response,
          assistantId
        );
      } else {
        /*
         * NORMAL JSON RESPONSE
         */
        const data = await response
          .json();

        const finalText =
          String(data.text || '');

        let displayed = '';

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  thinking: false,
                }
              : message
          )
        );

        for (const character of finalText) {
          displayed += character;

          await new Promise((resolve) =>
            window.setTimeout(resolve, 4)
          );

          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    thinking: false,
                    content: displayed,
                    provider: data.provider,
                    model: data.model,
                    sources: data.sources,
                  }
                : message
            )
          );
        }
      }

      /*
       * Save latest conversation after response.
       */
      setMessages((current) => {
        saveConversation(current);
        return current;
      });
    } catch (error) {
      if (
        error?.name === 'AbortError'
      ) {
        return;
      }

      const failedMessages = [
        ...nextMessages,
        {
          id: assistantId,
          role: 'assistant',
          content:
            "I couldn't complete that request. " +
            String(
              error?.message ||
                'Please try again.'
            ),
        },
      ];

      setMessages(failedMessages);
      saveConversation(failedMessages);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setLoading(false);
  }

  async function regenerate(messageId) {
    const index = messages.findIndex(
      (message) =>
        message.id === messageId
    );

    if (index < 0) return;

    const previousUser = [
      ...messages.slice(0, index),
    ]
      .reverse()
      .find(
        (message) =>
          message.role === 'user'
      );

    if (!previousUser) return;

    const trimmedMessages =
      messages.slice(0, index);

    setMessages(trimmedMessages);

    window.setTimeout(() => {
      sendMessage(previousUser.content);
    }, 0);
  }

  async function handleFiles(event) {
    const selected = Array.from(
      event.target.files || []
    ).slice(0, 3);

    if (!selected.length) return;

    const loaded = await Promise.all(
      selected.map(
        (file) =>
          new Promise((resolve) => {
            const reader =
              new FileReader();

            reader.onload = () => {
              const result =
                String(
                  reader.result || ''
                );

              resolve({
                name: file.name,
                mimeType:
                  file.type ||
                  'application/octet-stream',
                data:
                  result.includes(',')
                    ? result.split(',')[1]
                    : '',
              });
            };

            reader.onerror = () => {
              resolve(null);
            };

            reader.readAsDataURL(file);
          })
      )
    );

    setAttachments(
      loaded.filter(Boolean)
    );

    event.target.value = '';
  }

  function clearHistory() {
    setHistory([]);
    showNotice('History cleared');
  }

  function roadmapNotice(label) {
    showNotice(
      `${label} is on the roadmap.`
    );
  }

  /*
   * BOOT SCREEN
   */
  if (boot) {
    return (
      <div className="boot">
        <div className="boot-logo">
          <Icon
            name="ozl-mark"
            className="icon"
          />
        </div>

        <div className="boot-name">
          OZLIND
        </div>

        <div className="boot-sub">
          AI PLATFORM
        </div>

        <div className="boot-loader">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  const modelInfo =
    PROVIDERS[settings.provider] ||
    PROVIDERS.auto;

  const navWorkspace = [
    {
      key: 'chat',
      icon: 'i-chat',
      label: 'AI Chat',
      badge: 'LIVE',
    },
    {
      key: 'history',
      icon: 'i-history',
      label: 'History',
      badge: '',
    },
    {
      key: 'research',
      icon: 'i-globe',
      label: 'Web Research',
      badge: 'LIVE',
    },
  ];

  const navTools = [
    {
      key: 'photo',
      icon: 'i-image',
      label: 'Photo Editor',
    },
    {
      key: 'code',
      icon: 'i-chat',
      label: 'Code Assistant',
    },
    {
      key: 'documents',
      icon: 'i-history',
      label: 'Documents',
    },
    {
      key: 'voice',
      icon: 'i-chat',
      label: 'Voice AI',
    },
  ];

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          sidebarOpen ? 'open' : ''
        }`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Icon name="ozl-mark" />
          </div>

          <div>
            <b>OZLIND</b>
            <span>AI WORKSPACE</span>
          </div>
        </div>

        <button
          className="new-chat"
          onClick={newChat}
        >
          <Icon name="i-plus" />
          <span>New chat</span>
        </button>

        <div className="nav-label">
          WORKSPACE
        </div>

        {navWorkspace.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${
              view === item.key
                ? 'active'
                : ''
            }`}
            onClick={() => {
              setView(item.key);
              setSidebarOpen(false);
            }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>

            {item.badge && (
              <em>{item.badge}</em>
            )}
          </button>
        ))}

        <div className="nav-label">
          AI TOOLS
        </div>

        {navTools.map((item) => (
          <button
            key={item.key}
            className="nav-item disabled"
            onClick={() =>
              roadmapNotice(item.label)
            }
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            <em>NEXT</em>
          </button>
        ))}

        <div className="nav-label">
          PERSONAL
        </div>

        <button
          className={`nav-item ${
            view === 'settings'
              ? 'active'
              : ''
          }`}
          onClick={() => {
            setView('settings');
            setSidebarOpen(false);
          }}
        >
          <Icon name="i-settings" />
          <span>Settings</span>
        </button>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">
              A
            </div>

            <div>
              <b>Athul</b>
              <span>OZLIND User</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          className="overlay"
          aria-label="Close menu"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* MAIN */}
      <main className="main">

        {/* TOP BAR */}
        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open menu"
          >
            <Icon name="i-menu" />
          </button>

          <div className="crumb">
            {view === 'chat'
              ? 'AI Chat'
              : view === 'history'
              ? 'History'
              : view === 'research'
              ? 'Web Research'
              : view === 'settings'
              ? 'Settings'
              : 'OZLIND'}
          </div>

          <div className="top-actions">
            <span className="ready">
              <i />
              Ready
            </span>

            <button
              className="top-btn"
              onClick={() =>
                setView('settings')
              }
              aria-label="Settings"
            >
              <Icon name="i-settings" />
            </button>
          </div>
        </header>

        {notice && (
          <div className="toast">
            {notice}
          </div>
        )}

        {/* CHAT */}
        {view === 'chat' && (
          <section className="chat-page">

            <div className="chat-head">

              <div>
                <div className="eyebrow">
                  PRIVATE AI WORKSPACE
                </div>

                <h1>
                  How can I{' '}
                  <strong>help?</strong>
                </h1>

                <p>
                  Clear answers, focused
                  research and intelligent
                  conversation.
                </p>
              </div>

              <div className="controls">

                <div className="model-control">

                  <button
                    className="model-button"
                    onClick={() =>
                      setModelOpen(
                        (value) => !value
                      )
                    }
                  >
                    <span>
                      <small>MODEL</small>
                      <b>
                        {modelInfo.label}
                      </b>
                    </span>

                    <Icon name="i-settings" />
                  </button>

                  {modelOpen && (
                    <div className="model-menu">

                      {Object.entries(
                        PROVIDERS
                      ).map(
                        ([key, provider]) => (
                          <button
                            key={key}
                            onClick={() => {
                              updateSettings(
                                {
                                  provider:
                                    key,
                                }
                              );

                              setModelOpen(
                                false
                              );
                            }}
                          >
                            <span>
                              <b>
                                {
                                  provider.label
                                }
                              </b>

                              <small>
                                {
                                  provider.description
                                }
                              </small>
                            </span>

                            {settings.provider ===
                              key && (
                              <Icon name="i-check" />
                            )}
                          </button>
                        )
                      )}

                    </div>
                  )}
                </div>

                <button
                  className={`research-pill ${
                    settings.research
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    updateSettings({
                      research:
                        !settings.research,
                    })
                  }
                >
                  <Icon name="i-globe" />
                  Research
                  <b>
                    {settings.research
                      ? 'ON'
                      : 'OFF'}
                  </b>
                </button>

              </div>
            </div>

            {/* MESSAGES */}
            <div
              className="messages"
              aria-live="polite"
            >

              {messages.length === 0 && (
                <div className="empty">

                  <div className="empty-mark">
                    <Icon name="ozl-mark" />
                  </div>

                  <span>
                    OZLIND AI
                  </span>

                  <h2>
                    Start a conversation
                  </h2>

                  <p>
                    Ask a question, explore
                    an idea, or create
                    something.
                  </p>

                  <div className="suggestions">

                    <button
                      onClick={() =>
                        sendMessage(
                          'Explain quantum computing simply.'
                        )
                      }
                    >
                      Explain something
                    </button>

                    <button
                      onClick={() =>
                        sendMessage(
                          'Help me plan a productive week.'
                        )
                      }
                    >
                      Plan something
                    </button>

                    <button
                      onClick={() =>
                        sendMessage(
                          'Write a clean JavaScript function for me.'
                        )
                      }
                    >
                      Write code
                    </button>

                    <button
                      onClick={() =>
                        sendMessage(
                          'Create an image of a cinematic Kerala landscape at golden hour.'
                        )
                      }
                    >
                      Create an image
                    </button>

                  </div>
                </div>
              )}

              {messages.map((message) => (
                <article
                  className={`message ${
                    message.role
                  }`}
                  key={message.id}
                >

                  <div className="message-avatar">
                    {message.role ===
                    'assistant' ? (
                      <Icon name="ozl-mark" />
                    ) : (
                      'A'
                    )}
                  </div>

                  <div className="message-body">

                    <div className="message-meta">
                      <b>
                        {message.role ===
                        'assistant'
                          ? 'OZLIND'
                          : 'You'}
                      </b>

                      {message.provider && (
                        <span>
                          {
                            message.provider
                          }

                          {message.model
                            ? ` · ${message.model}`
                            : ''}
                        </span>
                      )}
                    </div>

                    {message.thinking ? (
                      <div className="typing">
                        <i />
                        <i />
                        <i />
                      </div>
                    ) : (
                      <>
                        {message.imageUrl ? (
                          <img
                            className="generated-image"
                            src={
                              message.imageUrl
                            }
                            alt="AI generated result"
                          />
                        ) : (
                          <div className="message-text">
                            {renderText(
                              message.content
                            )}
                          </div>
                        )}

                        {Array.isArray(
                          message.sources
                        ) &&
                          message.sources.length >
                            0 && (
                            <div className="sources">
                              <b>
                                Sources
                              </b>

                              {message.sources.map(
                                (
                                  source,
                                  index
                                ) => {
                                  const url =
                                    String(
                                      source?.url ||
                                        ''
                                    );

                                  if (!url) {
                                    return null;
                                  }

                                  return (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      key={`${url}-${index}`}
                                    >
                                      {String(
                                        source?.title ||
                                          url
                                      )}
                                    </a>
                                  );
                                }
                              )}
                            </div>
                          )}
                      </>
                    )}

                    {!message.thinking && (
                      <div className="message-actions">

                        {message.role ===
                          'assistant' && (
                          <>
                            <button
                              onClick={() =>
                                copyText(
                                  message.content
                                )
                              }
                              title="Copy"
                            >
                              <Icon name="i-copy" />
                            </button>

                            <button
                              onClick={() =>
                                regenerate(
                                  message.id
                                )
                              }
                              title="Regenerate"
                            >
                              <Icon name="i-refresh" />
                            </button>
                          </>
                        )}

                        {message.role ===
                          'user' && (
                          <button
                            onClick={() =>
                              editMessage(
                                message
                              )
                            }
                            title="Edit"
                          >
                            <Icon name="i-edit" />
                          </button>
                        )}

                        <button
                          onClick={() =>
                            deleteMessage(
                              message.id
                            )
                          }
                          title="Delete"
                        >
                          <Icon name="i-trash" />
                        </button>

                      </div>
                    )}

                  </div>
                </article>
              ))}

            </div>

            {/* COMPOSER */}
            <div className="composer">

              {attachments.length > 0 && (
                <div className="attachments">

                  {attachments.map(
                    (file, index) => (
                      <span
                        key={`${file.name}-${index}`}
                      >
                        {file.name}

                        <button
                          onClick={() =>
                            setAttachments(
                              (current) =>
                                current.filter(
                                  (
                                    _,
                                    itemIndex
                                  ) =>
                                    itemIndex !==
                                    index
                                )
                            )
                          }
                          aria-label={`Remove ${file.name}`}
                        >
                          <Icon name="i-close" />
                        </button>
                      </span>
                    )
                  )}

                </div>
              )}

              <div className="composer-row">

                <label
                  className="attach"
                  title="Attach image"
                >
                  <Icon name="i-plus" />

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleFiles}
                  />
                </label>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      if (loading) {
                        stopGeneration();
                      } else {
                        sendMessage();
                      }
                    }
                  }}
                  placeholder="Message OZLIND..."
                  aria-label="Message OZLIND"
                  rows={1}
                />

                <button
                  className="send"
                  onClick={() => {
                    if (loading) {
                      stopGeneration();
                    } else {
                      sendMessage();
                    }
                  }}
                  disabled={
                    !loading &&
                    !input.trim() &&
                    attachments.length === 0
                  }
                  title={
                    loading
                      ? 'Stop'
                      : 'Send'
                  }
                >
                  <Icon
                    name={
                      loading
                        ? 'i-stop'
                        : 'i-send'
                    }
                  />
                </button>

              </div>

              <div className="composer-foot">
                <span>
                  OZLIND can make mistakes.
                  Verify important information.
                </span>

                <span>
                  Enter to send · Shift + Enter
                  for new line
                </span>
              </div>

            </div>

          </section>
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <section className="page-section">

            <div className="page-title">
              <div>
                <div className="eyebrow">
                  PERSONAL
                </div>

                <h2>
                  Conversation history
                </h2>

                <p>
                  Your locally saved OZLIND
                  conversations.
                </p>
              </div>

              {history.length > 0 && (
                <button
                  className="danger-button"
                  onClick={clearHistory}
                >
                  <Icon name="i-trash" />
                  Clear
                </button>
              )}
            </div>

            <div className="searchbox">
              <Icon name="i-search" />

              <input
                value={historySearch}
                onChange={(event) =>
                  setHistorySearch(
                    event.target.value
                  )
                }
                placeholder="Search conversations..."
              />
            </div>

            {filteredHistory.length === 0 ? (
              <div className="empty-card">
                No conversations found.
              </div>
            ) : (
              <div className="history-list">

                {filteredHistory.map(
                  (item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        openConversation(
                          item
                        )
                      }
                    >
                      <span>
                        {String(
                          item.title ||
                            'New conversation'
                        )}
                      </span>

                      <small>
                        {new Date(
                          item.updatedAt
                        ).toLocaleDateString()}
                      </small>
                    </button>
                  )
                )}

              </div>
            )}

          </section>
        )}

        {/* WEB RESEARCH */}
        {view === 'research' && (
          <section className="page-section">

            <div className="page-title">
              <div>
                <div className="eyebrow">
                  LIVE
                </div>

                <h2>
                  Web Research
                </h2>

                <p>
                  Search current information
                  through OZLIND chat.
                </p>
              </div>
            </div>

            <div className="research-card">

              <div className="research-icon">
                <Icon name="i-globe" />
              </div>

              <h3>
                Research is integrated
                into chat
              </h3>

              <p>
                Enable the Research switch
                in AI Chat and ask OZLIND
                for current information.
                Sources will appear below
                supported answers.
              </p>

              <button
                className={`research-pill ${
                  settings.research
                    ? 'on'
                    : ''
                }`}
                onClick={() => {
                  updateSettings({
                    research:
                      !settings.research,
                  });

                  setView('chat');
                }}
              >
                <Icon name="i-globe" />
                Research
                <b>
                  {settings.research
                    ? 'ON'
                    : 'OFF'}
                </b>
              </button>

            </div>

          </section>
        )}

        {/* SETTINGS */}
        {view === 'settings' && (
          <section className="page-section">

            <div className="page-title">
              <div>
                <div className="eyebrow">
                  OZLIND
                </div>

                <h2>
                  Settings
                </h2>

                <p>
                  Control how OZLIND responds
                  and stores conversations.
                </p>
              </div>
            </div>

            <div className="settings-grid">

              <div className="setting-card">

                <h3>
                  Response
                </h3>

                <label>
                  Answer length

                  <select
                    value={settings.length}
                    onChange={(event) =>
                      updateSettings({
                        length:
                          event.target.value,
                      })
                    }
                  >
                    <option value="short">
                      Short
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="long">
                      Long
                    </option>
                  </select>
                </label>

                <label>
                  Response style

                  <select
                    value={settings.style}
                    onChange={(event) =>
                      updateSettings({
                        style:
                          event.target.value,
                      })
                    }
                  >
                    <option value="balanced">
                      Balanced
                    </option>

                    <option value="concise">
                      Concise
                    </option>

                    <option value="detailed">
                      Detailed
                    </option>
                  </select>
                </label>

              </div>

              <div className="setting-card">

                <h3>
                  AI routing
                </h3>

                <label>
                  Preferred provider

                  <select
                    value={settings.provider}
                    onChange={(event) =>
                      updateSettings({
                        provider:
                          event.target.value,
                      })
                    }
                  >
                    <option value="auto">
                      Auto
                    </option>

                    <option value="groq">
                      Groq
                    </option>

                    <option value="gemini">
                      Gemini
                    </option>

                    <option value="experiential">
                      Experiential
                    </option>
                  </select>
                </label>

                <button
                  className={`switch ${
                    settings.research
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    updateSettings({
                      research:
                        !settings.research,
                    })
                  }
                >
                  <span>
                    Web Research
                  </span>

                  <i />
                </button>

              </div>

              <div className="setting-card">

                <h3>
                  Conversation
                </h3>

                <button
                  className={`switch ${
                    settings.memory
                      ? 'on'
                      : ''
                  }`}
                  onClick={() =>
                    updateSettings({
                      memory:
                        !settings.memory,
                    })
                  }
                >
                  <span>
                    Conversation context
                  </span>

                  <i />
                </button>

                <label>
                  Custom instructions

                  <textarea
                    value={settings.custom}
                    onChange={(event) =>
                      updateSettings({
                        custom:
                          event.target.value,
                      })
                    }
                    placeholder="Tell OZLIND how you prefer responses..."
                  />
                </label>

              </div>

              <div className="setting-card">

                <h3>
                  Local data
                </h3>

                <p>
                  Conversation history and
                  settings are stored locally
                  in this browser.
                </p>

                <button
                  className="danger-button"
                  onClick={() => {
                    clearHistory();
                    setMessages([]);
                  }}
                >
                  <Icon name="i-trash" />
                  Clear local history
                </button>

              </div>

            </div>

          </section>
        )}

        {/* ROADMAP / FUTURE VIEWS */}
        {[
          'photo',
          'code',
          'documents',
          'voice',
        ].includes(view) && (
          <section className="page-section">

            <div className="roadmap">
              <Icon name="ozl-mark" />

              <b>
                {view === 'photo'
                  ? 'Photo Editor'
                  : view === 'code'
                  ? 'Code Assistant'
                  : view === 'documents'
                  ? 'Documents'
                  : 'Voice AI'}
              </b>

              <span>
                This capability is part of
                the OZLIND roadmap.
              </span>

              <button
                className="research-pill"
                onClick={() =>
                  setView('chat')
                }
              >
                Back to AI Chat
              </button>
            </div>

          </section>
        )}

      </main>
    </div>
  );
          }
