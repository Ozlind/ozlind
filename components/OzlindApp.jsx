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
  Paperclip,
  PanelLeftClose,
  PenLine,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Telescope,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const HISTORY_KEY = "ozlind_history_v2";
const SETTINGS_KEY = "ozlind_settings_v2";

const DEFAULT_SETTINGS = {
  provider: "auto",
  research: false,
  memory: true,
  style: "balanced",
  length: "medium",
  customInstructions: "",
};

const MODES = [
  {
    id: "auto",
    label: "Auto",
    description: "Balanced reasoning and speed",
    icon: Sparkles,
  },
  {
    id: "fast",
    label: "Fast",
    description: "Quick answers for everyday tasks",
    icon: Zap,
  },
  {
    id: "pro",
    label: "Pro",
    description: "Deeper reasoning and complex tasks",
    icon: BrainCircuit,
  },
  {
    id: "vision",
    label: "Vision",
    description: "Understand images and visual files",
    icon: Telescope,
  },
];

const SUGGESTIONS = [
  {
    icon: Lightbulb,
    title: "Explain something",
    prompt: "Explain a difficult topic in a simple way.",
  },
  {
    icon: Code2,
    title: "Write code",
    prompt: "Help me build a clean production-ready solution.",
  },
  {
    icon: FileText,
    title: "Analyze an image",
    prompt: "Analyze the attached image and explain the important details.",
  },
  {
    icon: Map,
    title: "Plan something",
    prompt: "Create a practical step-by-step plan for my goal.",
  },
];

export default function OzlindApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const bottomRef = useRef(null);
  const modeRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const selectedMode = useMemo(
    () => MODES.find((item) => item.id === mode) || MODES[0],
    [mode]
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();

    if (!query) {
      return history;
    }

    return history.filter((item) =>
      String(item.title || "")
        .toLowerCase()
        .includes(query)
    );
  }, [history, historySearch]);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      const storedSettings = localStorage.getItem(SETTINGS_KEY);

      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);

        if (Array.isArray(parsedHistory)) {
          setHistory(parsedHistory);
        }
      }

      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);

        if (
          parsedSettings &&
          typeof parsedSettings === "object"
        ) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsedSettings,
          });
        }
      }
    } catch (storageError) {
      console.error(
        "Ozlind local storage initialization failed:",
        storageError
      );

      setHistory([]);
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
      );
    } catch (storageError) {
      console.error(
        "Could not save Ozlind history:",
        storageError
      );
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
      );
    } catch (storageError) {
      console.error(
        "Could not save Ozlind settings:",
        storageError
      );
    }
  }, [settings]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        modeRef.current &&
        !modeRef.current.contains(event.target)
      ) {
        setModeOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    clearTimeout(noticeTimerRef.current);

    noticeTimerRef.current = setTimeout(() => {
      setNotice("");
    }, 2600);

    return () => {
      clearTimeout(noticeTimerRef.current);
    };
  }, [notice]);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        textareaRef.current?.focus();
      }

      if (event.key === "Escape") {
        setModeOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      clearTimeout(noticeTimerRef.current);
    };
  }, []);

  function showNotice(message) {
    setNotice(message);
  }

  function createId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  function createTitle(text) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return "New conversation";
    }

    return cleaned.length > 52
      ? `${cleaned.slice(0, 52).trim()}…`
      : cleaned;
  }

  function getMessageText(message) {
    if (!message) {
      return "";
    }

    if (typeof message.content === "string") {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          return part?.text || "";
        })
        .join("");
    }

    return "";
  }

  function updateHistoryFromMessages(
    nextMessages,
    chatId = activeChatId
  ) {
    if (!chatId || !Array.isArray(nextMessages)) {
      return;
    }

    const firstUserMessage = nextMessages.find(
      (item) => item.role === "user"
    );

    if (!firstUserMessage) {
      return;
    }

    const title = createTitle(
      getMessageText(firstUserMessage)
    );

    const updatedAt = Date.now();

    setHistory((current) => {
      const existing = current.find(
        (item) => item.id === chatId
      );

      const record = {
        id: chatId,
        title: existing?.title || title,
        messages: nextMessages,
        updatedAt,
      };

      return [
        record,
        ...current.filter(
          (item) => item.id !== chatId
        ),
      ];
    });
  }

  function startNewChat() {
    abortControllerRef.current?.abort();

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setActiveChatId(null);
    setIsStreaming(false);
    setModeOpen(false);
    setSidebarOpen(false);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function openHistoryItem(item) {
    abortControllerRef.current?.abort();

    const restoredMessages = Array.isArray(
      item?.messages
    )
      ? item.messages
      : [];

    setMessages(restoredMessages);
    setActiveChatId(item?.id || null);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);
    setModeOpen(false);
    setSidebarOpen(false);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function deleteHistoryItem(id) {
    setHistory((current) =>
      current.filter((item) => item.id !== id)
    );

    if (activeChatId === id) {
      abortControllerRef.current?.abort();
      setMessages([]);
      setInput("");
      setSelectedFile(null);
      setError("");
      setActiveChatId(null);
      setIsStreaming(false);
    }

    showNotice("Conversation deleted");
  }

  function clearHistory() {
    if (!history.length) {
      return;
    }

    setHistory([]);
    setHistorySearch("");

    abortControllerRef.current?.abort();

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setActiveChatId(null);
    setIsStreaming(false);

    showNotice("History cleared");
  }

  function clearCurrentChat() {
    abortControllerRef.current?.abort();

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);
    setActiveChatId(null);

    showNotice("Chat cleared");
  }

  function updateSettings(patch) {
    setSettings((current) => ({
      ...current,
      ...patch,
    }));
  }

  function autoResizeTextarea() {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";

    const nextHeight = Math.min(
      Math.max(element.scrollHeight, 48),
      180
    );

    element.style.height = `${nextHeight}px`;
  }

  function handleInputChange(event) {
    setInput(event.target.value);
    autoResizeTextarea();
  }

  function handleTextareaKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent?.isComposing
    ) {
      event.preventDefault();

      if (!isStreaming) {
        sendMessage();
      }
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const maxSize = 12 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        "This image is too large. Please choose an image under 12 MB."
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(
        "Image uploads are currently supported. Document processing will be enabled separately."
      );
      return;
    }

    setError("");

    try {
      const dataUrl = await fileToDataUrl(file);

      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      });

      showNotice(`${file.name} attached`);
    } catch (fileError) {
      console.error(
        "Could not read selected image:",
        fileError
      );

      setError("Could not read the selected image.");
    }
  }

  function removeSelectedFile() {
    setSelectedFile(null);
  }

  async function copyMessage(content, index) {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        String(content)
      );

      setCopiedMessage(index);
      showNotice("Copied");

      window.setTimeout(() => {
        setCopiedMessage((current) =>
          current === index ? null : current
        );
      }, 1600);
    } catch (copyError) {
      console.error(
        "Could not copy message:",
        copyError
      );

      setError("Could not copy the message.");
    }
  }

  function buildApiMessages(currentMessages) {
    return currentMessages.map((message) => ({
      role: message.role,
      content: getMessageText(message),
    }));
  }

  async function sendMessage(customPrompt) {
    if (isStreaming) {
      return;
    }

    const prompt = String(
      customPrompt !== undefined ? customPrompt : input
    ).trim();

    const attachedFile = selectedFile;

    if (!prompt && !attachedFile) {
      textareaRef.current?.focus();
      return;
    }

    setError("");

    const chatId = activeChatId || createId();

    const userMessage = {
      id: createId(),
      role: "user",
      content:
        prompt || "Please analyze the attached image.",
      createdAt: Date.now(),
      attachment: attachedFile
        ? {
            name: attachedFile.name,
            type: attachedFile.type,
            size: attachedFile.size,
            dataUrl: attachedFile.dataUrl,
          }
        : null,
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    const assistantId = createId();

    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      streaming: true,
    };

    setActiveChatId(chatId);
    setMessages([
      ...nextMessages,
      assistantMessage,
    ]);
    setInput("");
    setSelectedFile(null);
    setIsStreaming(true);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "48px";
      }
    });

    const controller = new AbortController();

    abortControllerRef.current = controller;

    try {
      const body = {
        messages: buildApiMessages(nextMessages),
        mode,
        provider: settings.provider,
        research: settings.research,
        memory: settings.memory,
        style: settings.style,
        length: settings.length,
        customInstructions:
          settings.customInstructions,
      };

      if (attachedFile) {
        body.file = {
          name: attachedFile.name,
          type: attachedFile.type,
          size: attachedFile.size,
          dataUrl: attachedFile.dataUrl,
        };
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = "Something went wrong.";

        try {
          const data = await response.json();

          if (data?.error) {
            message = String(data.error);
          }
        } catch {
          // Ignore invalid error response bodies.
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "The server returned an empty response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = "";
      let fullText = "";

      const updateAssistant = (content) => {
        fullText = content;

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: fullText,
                  streaming: true,
                }
              : message
          )
        );
      };

      const appendAssistantText = (chunk) => {
        if (!chunk) {
          return;
        }

        updateAssistant(
          `${fullText}${chunk}`
        );
      };

      const processLine = (rawLine) => {
        const line = rawLine.trim();

        if (!line) {
          return;
        }

        if (!line.startsWith("data:")) {
          appendAssistantText(line);
          return;
        }

        const payload = line
          .slice(5)
          .trim();

        if (
          !payload ||
          payload === "[DONE]"
        ) {
          return;
        }

        let parsed;

        try {
          parsed = JSON.parse(payload);
        } catch {
          return;
        }

        if (parsed?.error) {
          throw new Error(
            String(parsed.error)
          );
        }

        const delta =
          parsed?.delta ??
          parsed?.text ??
          parsed?.content ??
          parsed?.message?.content ??
          "";

        if (
          typeof delta === "string" &&
          delta
        ) {
          appendAssistantText(delta);
        }
      };

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (const line of lines) {
          processLine(line);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processLine(buffer);
      }

      const finalContent =
        fullText.trim()
          ? fullText
          : "No response was returned.";

      const completedMessages = [
        ...nextMessages,
        {
          ...assistantMessage,
          content: finalContent,
          streaming: false,
        },
      ];

      setMessages(completedMessages);

      updateHistoryFromMessages(
        completedMessages,
        chatId
      );
    } catch (requestError) {
      if (
        requestError?.name ===
        "AbortError"
      ) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  streaming: false,
                  content:
                    getMessageText(
                      message
                    ) ||
                    "Generation stopped.",
                }
              : message
          )
        );

        return;
      }

      console.error(
        "Ozlind chat request failed:",
        requestError
      );

      const message =
        requestError?.message ||
        "Unable to connect to the AI service.";

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                streaming: false,
                content: `**Error:** ${message}`,
              }
            : item
        )
      );

      setError(message);
    } finally {
      setIsStreaming(false);

      if (
        abortControllerRef.current ===
        controller
      ) {
        abortControllerRef.current = null;
      }
    }
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }

  async function regenerateLastResponse() {
    if (
      isStreaming ||
      !messages.length
    ) {
      return;
    }

    const lastAssistantIndex =
      [...messages]
        .reverse()
        .findIndex(
          (item) =>
            item.role === "assistant"
        );

    if (lastAssistantIndex === -1) {
      return;
    }

    const assistantIndex =
      messages.length -
      1 -
      lastAssistantIndex;

    const previousMessages =
      messages.slice(
        0,
        assistantIndex
      );

    const lastUserMessage =
      [...previousMessages]
        .reverse()
        .find(
          (item) =>
            item.role === "user"
        );

    if (!lastUserMessage) {
      return;
    }

    const userText =
      getMessageText(
        lastUserMessage
      );

    setMessages(
      previousMessages
    );

    setInput("");

    await sendMessage(userText);
  }

  function editMessage(message) {
    const content =
      getMessageText(message);

    setInput(content);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  }

  async function shareConversation() {
    const text = messages
      .map((message) => {
        const role =
          message.role === "user"
            ? "You"
            : "Ozlind AI";

        return `${role}:\n${getMessageText(
          message
        )}`;
      })
      .join("\n\n");

    if (!text) {
      showNotice(
        "Nothing to share yet"
      );
      return;
    }

    try {
      if (
        typeof navigator.share ===
        "function"
      ) {
        await navigator.share({
          title:
            "Ozlind AI conversation",
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(
        text
      );

      showNotice(
        "Conversation copied"
      );
    } catch {
      // Share cancellation is intentionally ignored.
    }
  }

  function selectSuggestion(prompt) {
    setInput(prompt);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  }

  function renderMarkdown(content) {
    return (
      <ReactMarkdown
        components={{
          a: ({
            children,
            ...props
          }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),

          code: ({
            inline,
            className,
            children,
            ...props
          }) => {
            if (inline) {
              return (
                <code
                  className={className}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <pre>
                <code
                  className={className}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  const hasMessages =
    messages.length > 0;

  return (
    <div className="ozlind-app">
      {sidebarOpen && (
        <button
          className="mobile-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <aside
        className={`ozlind-sidebar ${
          sidebarOpen
            ? "is-open"
            : ""
        }`}
      >
        <div className="sidebar-header">
          <button
            className="brand-button"
            onClick={startNewChat}
            aria-label="Ozlind home"
          >
            <span className="brand-mark">
              <img
                src="/ozlind-icons.svg"
                alt=""
                aria-hidden="true"
              />
            </span>

            <span className="brand-copy">
              <strong>OZLIND</strong>
              <span>
                AI PLATFORM
              </span>
            </span>
          </button>

          <button
            className="icon-button sidebar-close"
            onClick={() =>
              setSidebarOpen(false)
            }
            aria-label="Close sidebar"
          >
            <PanelLeftClose
              size={18}
            />
          </button>
        </div>

        <div className="sidebar-content">
          <button
            className="new-chat-button"
            onClick={startNewChat}
          >
            <PenLine size={17} />
            <span>New chat</span>
          </button>

          <nav
            className="sidebar-nav"
            aria-label="Primary navigation"
          >
            <button
              className="sidebar-nav-item active"
              onClick={startNewChat}
            >
              <MessageSquare
                size={17}
              />
              <span>AI Chat</span>
              <span className="live-dot">
                LIVE
              </span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => {
                updateSettings({
                  research: true,
                });
                showNotice(
                  "Research enabled"
                );
                setSidebarOpen(false);
              }}
            >
              <Search size={17} />
              <span>
                Web Research
              </span>
              <span className="live-dot">
                LIVE
              </span>
            </button>
          </nav>

          <div className="sidebar-section">
            <div className="sidebar-section-heading">
              <span>Workspace</span>
            </div>

            <button
              className="sidebar-nav-item disabled"
              type="button"
              disabled
            >
              <Sparkles
                size={17}
              />
              <span>
                Image Generator
              </span>
              <span className="next-label">
                NEXT
              </span>
            </button>

            <button
              className="sidebar-nav-item disabled"
              type="button"
              disabled
            >
              <FileText
                size={17}
              />
              <span>
                Documents
              </span>
              <span className="next-label">
                NEXT
              </span>
            </button>

            <button
              className="sidebar-nav-item disabled"
              type="button"
              disabled
            >
              <Code2 size={17} />
              <span>
                Code Assistant
              </span>
              <span className="next-label">
                NEXT
              </span>
            </button>
          </div>

          <div className="sidebar-section history-section">
            <div className="sidebar-section-heading">
              <span>History</span>

              {history.length >
                0 && (
                <button
                  className="text-button"
                  onClick={
                    clearHistory
                  }
                >
                  Clear
                </button>
              )}
            </div>

            {history.length >
              0 && (
              <div className="history-search">
                <Search
                  size={14}
                />

                <input
                  value={
                    historySearch
                  }
                  onChange={(
                    event
                  ) =>
                    setHistorySearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search history"
                  aria-label="Search history"
                />

                {historySearch && (
                  <button
                    type="button"
                    onClick={() =>
                      setHistorySearch(
                        ""
                      )
                    }
                    aria-label="Clear history search"
                  >
                    <X
                      size={13}
                    />
                  </button>
                )}
              </div>
            )}

            <div className="history-list">
              {filteredHistory.length ===
              0 ? (
                <div className="history-empty">
                  <span>
                    {history.length
                      ? "No matching conversations."
                      : "No conversations yet."}
                  </span>
                </div>
              ) : (
                filteredHistory.map(
                  (item) => (
                    <div
                      className={`history-item ${
                        activeChatId ===
                        item.id
                          ? "active"
                          : ""
                      }`}
                      key={item.id}
                    >
                      <button
                        className="history-item-main"
                        onClick={() =>
                          openHistoryItem(
                            item
                          )
                        }
                      >
                        <MessageSquare
                          size={14}
                        />

                        <span>
                          {
                            item.title
                          }
                        </span>
                      </button>

                      <button
                        className="history-delete"
                        onClick={() =>
                          deleteHistoryItem(
                            item.id
                          )
                        }
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-nav-item"
            onClick={() =>
              setSettingsOpen(true)
            }
          >
            <Settings2
              size={17}
            />
            <span>Settings</span>
          </button>

          <div className="profile-card">
            <div className="profile-avatar">
              <span>A</span>
            </div>

            <div className="profile-info">
              <strong>Athul</strong>
              <span>
                OZLIND User
              </span>
            </div>

            <ShieldCheck
              size={16}
            />
          </div>
        </div>
      </aside>

      <main className="ozlind-main">
        <header className="ozlind-topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open sidebar"
            >
              <Menu size={19} />
            </button>

            <div className="mobile-brand">
              <strong>
                OZLIND
              </strong>
              <span>AI</span>
            </div>

            <div className="status-badge">
              <span className="status-dot" />
              Online
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={
                shareConversation
              }
              aria-label="Share conversation"
              title="Share"
            >
              <Share2
                size={18}
              />
            </button>

            <button
              className="clear-chat-button"
              onClick={
                clearCurrentChat
              }
            >
              <Trash2 size={16} />
              <span>
                Clear chat
              </span>
            </button>
          </div>
        </header>

        <section className="workspace">
          {!hasMessages ? (
            <div className="welcome-screen">
              <div className="welcome-badge">
                <Sparkles
                  size={15}
                />
                <span>
                  OZLIND AI
                </span>
              </div>

              <h1>
                What can I help
                <br />
                you with?
              </h1>

              <p>
                Ask questions, analyze
                images, research topics,
                write code, or plan your
                next idea.
              </p>

              <div className="suggestion-grid">
                {SUGGESTIONS.map(
                  (suggestion) => {
                    const Icon =
                      suggestion.icon;

                    return (
                      <button
                        className="suggestion-card"
                        key={
                          suggestion.title
                        }
                        onClick={() =>
                          selectSuggestion(
                            suggestion.prompt
                          )
                        }
                      >
                        <span className="suggestion-icon">
                          <Icon
                            size={18}
                          />
                        </span>

                        <span className="suggestion-content">
                          <strong>
                            {
                              suggestion.title
                            }
                          </strong>

                          <span>
                            {
                              suggestion.prompt
                            }
                          </span>
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            <div className="chat-area">
              <div className="messages-list">
                {messages.map(
                  (
                    message,
                    index
                  ) => {
                    const isUser =
                      message.role ===
                      "user";

                    const content =
                      getMessageText(
                        message
                      );

                    return (
                      <article
                        className={`message-row ${
                          isUser
                            ? "user"
                            : "assistant"
                        }`}
                        key={
                          message.id ||
                          index
                        }
                      >
                        {!isUser && (
                          <div className="assistant-avatar">
                            <Sparkles
                              size={15}
                            />
                          </div>
                        )}

                        <div className="message-column">
                          <div className="message-meta">
                            <span>
                              {isUser
                                ? "You"
                                : "Ozlind AI"}
                            </span>
                          </div>

                          <div className="message-bubble">
                            {message.attachment && (
                              <div className="message-attachment">
                                {message
                                  .attachment
                                  .dataUrl ? (
                                  <img
                                    src={
                                      message
                                        .attachment
                                        .dataUrl
                                    }
                                    alt={
                                      message
                                        .attachment
                                        .name
                                    }
                                  />
                                ) : null}

                                <div className="attachment-file">
                                  <FileText
                                    size={16}
                                  />

                                  <span>
                                    {
                                      message
                                        .attachment
                                        .name
                                    }
                                  </span>
                                </div>
                              </div>
                            )}

                            {content ? (
                              isUser ? (
                                <p>
                                  {
                                    content
                                  }
                                </p>
                              ) : (
                                <div className="markdown-content">
                                  {renderMarkdown(
                                    content
                                  )}
                                </div>
                              )
                            ) : message.streaming ? (
                              <div className="streaming-indicator">
                                <span />
                                <span />
                                <span />
                              </div>
                            ) : null}
                          </div>

                          <div className="message-actions">
                            <button
                              onClick={() =>
                                copyMessage(
                                  content,
                                  index
                                )
                              }
                              aria-label="Copy message"
                            >
                              {copiedMessage ===
                              index ? (
                                <Check
                                  size={14}
                                />
                              ) : (
                                <Copy
                                  size={14}
                                />
                              )}
                            </button>

                            {isUser && (
                              <button
                                onClick={() =>
                                  editMessage(
                                    message
                                  )
                                }
                                aria-label="Edit message"
                              >
                                <PenLine
                                  size={14}
                                />
                              </button>
                            )}

                            {!isUser &&
                              index ===
                                messages.length -
                                  1 &&
                              !isStreaming && (
                                <button
                                  onClick={
                                    regenerateLastResponse
                                  }
                                  aria-label="Regenerate response"
                                >
                                  <RefreshCw
                                    size={
                                      14
                                    }
                                  />
                                </button>
                              )}
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}

                <div ref={bottomRef} />
              </div>
            </div>
          )}

          {error && (
            <div
              className="error-banner"
              role="alert"
            >
              <span>{error}</span>

              <button
                onClick={() =>
                  setError("")
                }
                aria-label="Dismiss error"
              >
                <X size={15} />
              </button>
            </div>
          )}

          <div className="composer-area">
            {selectedFile && (
              <div className="selected-file">
                <div className="selected-file-info">
                  <img
                    src={
                      selectedFile.dataUrl
                    }
                    alt={
                      selectedFile.name
                    }
                  />

                  <div>
                    <strong>
                      {
                        selectedFile.name
                      }
                    </strong>

                    <span>
                      {formatFileSize(
                        selectedFile.size
                      )}
                    </span>
                  </div>
                </div>

                <button
                  className="icon-button"
                  onClick={
                    removeSelectedFile
                  }
                  aria-label="Remove attachment"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            <div className="composer-shell">
              <div className="composer-toolbar">
                <div className="composer-left">
                  <button
                    className="composer-icon-button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    aria-label="Attach image"
                    title="Attach image"
                  >
                    <Paperclip
                      size={19}
                    />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={
                      handleFileChange
                    }
                    accept="image/*"
                  />

                  <div
                    className="mode-selector"
                    ref={modeRef}
                  >
                    <button
                      className="mode-button"
                      onClick={() =>
                        setModeOpen(
                          (current) =>
                            !current
                        )
                      }
                      aria-expanded={
                        modeOpen
                      }
                    >
                      <selectedMode.icon
                        size={16}
                      />

                      <span>
                        {
                          selectedMode.label
                        }
                      </span>

                      <ChevronDown
                        size={14}
                      />
                    </button>

                    {modeOpen && (
                      <div className="mode-menu">
                        {MODES.map(
                          (item) => {
                            const Icon =
                              item.icon;

                            return (
                              <button
                                key={
                                  item.id
                                }
                                className={`mode-menu-item ${
                                  mode ===
                                  item.id
                                    ? "active"
                                    : ""
                                }`}
                                onClick={() => {
                                  setMode(
                                    item.id
                                  );
                                  setModeOpen(
                                    false
                                  );
                                }}
                              >
                                <span className="mode-menu-icon">
                                  <Icon
                                    size={
                                      16
                                    }
                                  />
                                </span>

                                <span className="mode-menu-copy">
                                  <strong>
                                    {
                                      item.label
                                    }
                                  </strong>

                                  <span>
                                    {
                                      item.description
                                    }
                                  </span>
                                </span>

                                {mode ===
                                  item.id && (
                                  <Check
                                    size={
                                      15
                                    }
                                  />
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    className={`research-toggle ${
                      settings.research
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      updateSettings({
                        research:
                          !settings.research,
                      })
                    }
                    aria-pressed={
                      settings.research
                    }
                  >
                    <Search
                      size={15}
                    />
                    <span>
                      Research
                    </span>
                  </button>
                </div>

                <div className="composer-right">
                  {isStreaming ? (
                    <button
                      className="send-button stop"
                      onClick={
                        stopGeneration
                      }
                      aria-label="Stop generation"
                    >
                      <span className="stop-square" />
                    </button>
                  ) : (
                    <button
                      className="send-button"
                      onClick={() =>
                        sendMessage()
                      }
                      disabled={
                        !input.trim() &&
                        !selectedFile
                      }
                      aria-label="Send message"
                    >
                      <ArrowUp
                        size={19}
                      />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                className="composer-input"
                value={input}
                onChange={
                  handleInputChange
                }
                onKeyDown={
                  handleTextareaKeyDown
                }
                placeholder="Message OZLIND AI..."
                rows={1}
                disabled={isStreaming}
                aria-label="Message OZLIND AI"
              />

              <div className="composer-footer">
                <span>
                  OZLIND can make
                  mistakes. Verify
                  important
                  information.
                </span>

                <span className="keyboard-hint">
                  <kbd>Enter</kbd>{" "}
                  send
                  <kbd>Shift</kbd>+
                  <kbd>Enter</kbd>{" "}
                  new line
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {settingsOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSettingsOpen(
                false
              );
            }
          }}
        >
          <section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className="dialog-header">
              <div>
                <span className="dialog-eyebrow">
                  Preferences
                </span>

                <h2>Settings</h2>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-content">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>
                    AI behavior
                  </strong>

                  <span>
                    Configure how OZLIND
                    responds.
                  </span>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>
                      Provider routing
                    </strong>

                    <span>
                      Automatically select
                      an available provider
                      when possible.
                    </span>
                  </div>

                  <select
                    value={
                      settings.provider
                    }
                    onChange={(event) =>
                      updateSettings({
                        provider:
                          event.target
                            .value,
                      })
                    }
                  >
                    <option value="auto">
                      Auto
                    </option>
                    <option value="groq">
                      Fast
                    </option>
                    <option value="gemini">
                      Vision
                    </option>
                    <option value="experiential">
                      Pro
                    </option>
                  </select>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>
                      Research
                    </strong>

                    <span>
                      Allow web research
                      when enabled.
                    </span>
                  </div>

                  <button
                    className={`switch ${
                      settings.research
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      updateSettings({
                        research:
                          !settings.research,
                      })
                    }
                    role="switch"
                    aria-checked={
                      settings.research
                    }
                  >
                    <span />
                  </button>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>
                      Memory
                    </strong>

                    <span>
                      Keep useful local
                      conversation
                      context.
                    </span>
                  </div>

                  <button
                    className={`switch ${
                      settings.memory
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      updateSettings({
                        memory:
                          !settings.memory,
                      })
                    }
                    role="switch"
                    aria-checked={
                      settings.memory
                    }
                  >
                    <span />
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>
                    Response style
                  </strong>

                  <span>
                    Adjust answer length and
                    writing style.
                  </span>
                </div>

                <div className="segmented-control">
                  {[
                    [
                      "concise",
                      "Concise",
                    ],
                    [
                      "balanced",
                      "Balanced",
                    ],
                    [
                      "detailed",
                      "Detailed",
                    ],
                  ].map(
                    ([value, label]) => (
                      <button
                        key={value}
                        className={
                          settings.length ===
                          value
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          updateSettings({
                            length:
                              value,
                          })
                        }
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>

                <div className="segmented-control">
                  {[
                    [
                      "balanced",
                      "Balanced",
                    ],
                    [
                      "professional",
                      "Professional",
                    ],
                    [
                      "friendly",
                      "Friendly",
                    ],
                  ].map(
                    ([value, label]) => (
                      <button
                        key={value}
                        className={
                          settings.style ===
                          value
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          updateSettings({
                            style:
                              value,
                          })
                        }
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>
                    Custom instructions
                  </strong>

                  <span>
                    Optional instructions
                    applied to your
                    conversations.
                  </span>
                </div>

                <textarea
                  className="settings-textarea"
                  value={
                    settings.customInstructions
                  }
                  onChange={(event) =>
                    updateSettings({
                      customInstructions:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Tell OZLIND how you want responses to be written..."
                  rows={5}
                />
              </section>

              <section className="settings-section account-section">
                <div className="settings-section-heading">
                  <strong>
                    Account
                  </strong>

                  <span>
                    Your current OZLIND
                    profile.
                  </span>
                </div>

                <div className="account-card">
                  <div className="profile-avatar large">
                    <span>A</span>
                  </div>

                  <div>
                    <strong>
                      Athul
                    </strong>

                    <span>
                      OZLIND User
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <div className="dialog-footer">
              <button
                className="secondary-button"
                onClick={() => {
                  setSettings(
                    DEFAULT_SETTINGS
                  );

                  showNotice(
                    "Settings reset"
                  );
                }}
              >
                Reset
              </button>

              <button
                className="primary-button"
                onClick={() => {
                  setSettingsOpen(
                    false
                  );

                  showNotice(
                    "Settings saved"
                  );
                }}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div
          className="toast"
          role="status"
          aria-live="polite"
        >
          <span className="toast-icon">
            <Check size={15} />
          </span>

          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes) {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

async function fileToDataUrl(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(reader.result)
        );

      reader.onerror = () =>
        reject(
          new Error(
            "Could not read the image."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}