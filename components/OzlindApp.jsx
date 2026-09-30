"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
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
  SlidersHorizontal,
  UserRound,
  LogOut,
  LockKeyhole,
  Database,
  Shield,
  Palette,
  CircleHelp,
  Info,
  Plug,
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
const THEME_KEY = "ozlind_theme_v1";

const DEFAULT_SETTINGS = {
  research: false,
  memory: true,
  responseStyle: "balanced",
  responseLength: "medium",
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
    title: "Work with a document",
    prompt: "Analyze this document and summarize the important points.",
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountUser, setAccountUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [isDark, setIsDark] = useState(false);

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
      String(item.title || "").toLowerCase().includes(query)
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

        if (parsedSettings && typeof parsedSettings === "object") {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsedSettings,
          });
        }
      }
    } catch {
      setHistory([]);
      setSettings(DEFAULT_SETTINGS);
    }

    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia?.(
          "(prefers-color-scheme: dark)"
        ).matches;

      setIsDark(
        storedTheme ? storedTheme === "dark" : Boolean(prefersDark)
      );
    } catch {
      // Ignore theme read failures; default stays light.
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", isDark);

    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // Ignore localStorage failures.
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore localStorage failures.
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore localStorage failures.
    }
  }, [settings]);

  useEffect(() => {
    const handleClick = (event) => {
      if (
        modeRef.current &&
        !modeRef.current.contains(event.target)
      ) {
        setModeOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
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
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }

      if (event.key === "Escape") {
        setModeOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
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

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  function updateHistoryFromMessages(nextMessages, chatId = activeChatId) {
    if (!chatId || !nextMessages?.length) {
      return;
    }

    const firstUserMessage = nextMessages.find(
      (item) => item.role === "user"
    );

    const title = firstUserMessage
      ? createTitle(firstUserMessage.content)
      : "New conversation";

    const updatedAt = Date.now();

    setHistory((current) => {
      const existing = current.find((item) => item.id === chatId);

      const record = {
        id: chatId,
        title: existing?.title || title,
        messages: nextMessages,
        updatedAt,
      };

      if (!existing) {
        return [record, ...current];
      }

      return [
        record,
        ...current.filter((item) => item.id !== chatId),
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
    setSidebarOpen(false);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function openHistoryItem(item) {
    abortControllerRef.current?.abort();

    setMessages(Array.isArray(item.messages) ? item.messages : []);
    setActiveChatId(item.id);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);
    setSidebarOpen(false);
  }

  function deleteHistoryItem(id) {
    setHistory((current) =>
      current.filter((item) => item.id !== id)
    );

    if (activeChatId === id) {
      startNewChat();
    }

    showNotice("Conversation deleted");
  }

  function clearHistory() {
    if (!history.length) {
      return;
    }

    setHistory([]);

    if (activeChatId) {
      startNewChat();
    }

    showNotice("History cleared");
  }

  function clearCurrentChat() {
    abortControllerRef.current?.abort();

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);

    if (activeChatId) {
      setHistory((current) =>
        current.filter((item) => item.id !== activeChatId)
      );
    }

    setActiveChatId(null);
    showNotice("Chat cleared");
  }

  function updateSettings(patch) {
    setSettings((current) => ({
      ...current,
      ...patch,
    }));
  }

  function openAccount() {
    setSidebarOpen(false);
    setAccountSection(null);
    setAccountOpen(true);
  }

  function closeAccount() {
    setAccountSection(null);
    setAccountOpen(false);
  }

  function openAccountSection(section) {
    setAccountSection(section);
  }

  function exportOzlindData() {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        product: "OZLIND AI",
        organization: "OZLIND Enterprises",
        owner: "Athul",
        history,
        settings,
        theme: isDark ? "dark" : "light",
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ozlind-data-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showNotice("OZLIND data exported");
    } catch (exportError) {
      console.error("OZLIND data export failed:", exportError);
      showNotice("Could not export your data");
    }
  }

  function clearAllLocalData() {
    const confirmed = window.confirm(
      "Clear all local OZLIND conversations and preferences? This cannot be undone."
    );
    if (!confirmed) return;

    abortControllerRef.current?.abort();
    setMessages([]);
    setHistory([]);
    setActiveChatId(null);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);
    setSettings(DEFAULT_SETTINGS);
    setAccountSection(null);
    setIsDark(false);

    try {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(THEME_KEY);
    } catch {
      // Ignore localStorage failures.
    }

    showNotice("Local OZLIND data cleared");
  }

  function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    window.location.assign("/login");
  }

  useEffect(() => {
    setAccountUser(initialUser || null);
  }, [initialUser]);

  const userName =
    accountUser?.user_metadata?.full_name ||
    accountUser?.user_metadata?.name ||
    accountUser?.email?.split("@")[0] ||
    "OZLIND User";

  const userEmail = accountUser?.email || "Local OZLIND account";
  const avatarUrl = accountUser?.user_metadata?.avatar_url || accountUser?.user_metadata?.picture || "";
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "O";

  function autoResizeTextarea() {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${Math.min(
      Math.max(element.scrollHeight, 48),
      180
    )}px`;
  }

  function handleInputChange(event) {
    setInput(event.target.value);
    autoResizeTextarea();
  }

  function handleTextareaKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
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
      setError("This file is too large. Please choose a file under 12 MB.");
      return;
    }

    setError("");

    const isImage = file.type.startsWith("image/");

    try {
      let dataUrl = null;

      if (isImage) {
        dataUrl = await fileToDataUrl(file);
      }

      setSelectedFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
        file,
      });

      showNotice(`${file.name} attached`);
    } catch {
      setError("Could not read the selected file.");
    }
  }

  function removeSelectedFile() {
    setSelectedFile(null);
  }

  async function copyMessage(content, index) {
    try {
      await navigator.clipboard.writeText(String(content || ""));
      setCopiedMessage(index);
      showNotice("Copied");

      setTimeout(() => {
        setCopiedMessage((current) =>
          current === index ? null : current
        );
      }, 1600);
    } catch {
      setError("Could not copy the message.");
    }
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

  function buildApiMessages(currentMessages) {
    return currentMessages.map((message) => {
      const text = getMessageText(message);
      const attachment = message.attachment;

      const isImageAttachment =
        attachment?.dataUrl &&
        attachment.type?.startsWith("image/");

      if (isImageAttachment) {
        const content = [];

        if (text) {
          content.push({ type: "text", text });
        }

        content.push({
          type: "image_url",
          image_url: { url: attachment.dataUrl },
        });

        return { role: message.role, content };
      }

      // Non-image attachments (PDF, docx, etc.) can't be parsed
      // client-side, so at least tell the model a file was attached
      // rather than silently dropping it.
      if (attachment?.name) {
        return {
          role: message.role,
          content: `${text}\n\n[Attached file: ${attachment.name} — file content could not be read; only image attachments are analyzed.]`,
        };
      }

      return { role: message.role, content: text };
    });
  }

  async function sendMessage(customPrompt) {
    if (isStreaming) {
      return;
    }

    const prompt = String(
      customPrompt !== undefined ? customPrompt : input
    ).trim();

    if (!prompt && !selectedFile) {
      textareaRef.current?.focus();
      return;
    }

    setError("");

    const chatId = activeChatId || createId();

    if (!activeChatId) {
      setActiveChatId(chatId);
    }

    const userMessage = {
      id: createId(),
      role: "user",
      content: prompt || "Please analyze the attached file.",
      createdAt: Date.now(),
      attachment: selectedFile
        ? {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            dataUrl: selectedFile.dataUrl,
          }
        : null,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setSelectedFile(null);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "48px";
      }
    });

    const assistantId = createId();

    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      streaming: true,
    };

    setMessages((current) => [...current, assistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const body = {
        messages: buildApiMessages(nextMessages),
        mode,
        research: settings.research,
        memory: settings.memory,
        responseStyle: settings.responseStyle,
        responseLength: settings.responseLength,
        customInstructions: settings.customInstructions,
      };

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
            message = data.error;
          }
        } catch {
          // Ignore malformed error bodies.
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("The server returned an empty response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let fullText = "";

      const appendAssistantText = (chunk) => {
        fullText += chunk;

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

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();

          if (!line) {
            continue;
          }

          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();

            if (!payload || payload === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(payload);

              const delta =
                parsed?.delta ??
                parsed?.text ??
                parsed?.content ??
                parsed?.message?.content ??
                "";

              if (typeof delta === "string" && delta) {
                appendAssistantText(delta);
              }

              if (parsed?.error) {
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              if (
                parseError instanceof Error &&
                parseError.message &&
                !parseError.message.includes("JSON")
              ) {
                throw parseError;
              }
            }
          } else {
            appendAssistantText(line);
          }
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        const remaining = buffer.trim();

        if (remaining.startsWith("data:")) {
          const payload = remaining.slice(5).trim();

          if (payload && payload !== "[DONE]") {
            try {
              const parsed = JSON.parse(payload);

              const delta =
                parsed?.delta ??
                parsed?.text ??
                parsed?.content ??
                parsed?.message?.content ??
                "";

              if (typeof delta === "string" && delta) {
                appendAssistantText(delta);
              }
            } catch {
              // Ignore incomplete trailing stream data.
            }
          }
        } else {
          appendAssistantText(remaining);
        }
      }

      const completedMessages = [
        ...nextMessages,
        {
          ...assistantMessage,
          content: fullText || "No response was returned.",
          streaming: false,
        },
      ];

      setMessages(completedMessages);
      updateHistoryFromMessages(completedMessages, chatId);
    } catch (requestError) {
      if (requestError?.name === "AbortError") {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  streaming: false,
                  content:
                    message.content ||
                    "Generation stopped.",
                }
              : message
          )
        );

        return;
      }

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
      abortControllerRef.current = null;
    }
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }

  async function regenerateLastResponse() {
    if (isStreaming || !messages.length) {
      return;
    }

    const lastAssistantIndex = [...messages]
      .reverse()
      .findIndex((item) => item.role === "assistant");

    if (lastAssistantIndex === -1) {
      return;
    }

    const assistantIndex =
      messages.length - 1 - lastAssistantIndex;

    const previousMessages = messages.slice(0, assistantIndex);
    const lastUserMessage = [...previousMessages]
      .reverse()
      .find((item) => item.role === "user");

    if (!lastUserMessage) {
      return;
    }

    setMessages(previousMessages);
    setInput(getMessageText(lastUserMessage));

    requestAnimationFrame(() => {
      sendMessage(getMessageText(lastUserMessage));
    });
  }

  function editMessage(message) {
    const content = getMessageText(message);

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
          message.role === "user" ? "You" : "Ozlind AI";

        return `${role}:\n${getMessageText(message)}`;
      })
      .join("\n\n");

    if (!text) {
      showNotice("Nothing to share yet");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Ozlind AI conversation",
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(text);
      showNotice("Conversation copied");
    } catch {
      // User cancelled share or browser denied clipboard access.
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
          a: ({ children, ...props }) => (
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

  const hasMessages = messages.length > 0;

  return (
    <div className="ozlind-app">
      {sidebarOpen && (
        <button
          className="mobile-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`ozlind-sidebar ${
          sidebarOpen ? "is-open" : ""
        }`}
      >
        <div className="sidebar-header">
          <button
            className="brand-button"
            onClick={startNewChat}
            aria-label="Ozlind home"
          >
            <span className="brand-mark">
              <svg viewBox="0 0 96 96" aria-hidden="true">
                <use href="/ozlind-icons.svg#ozl-mark" />
              </svg>
            </span>

            <span className="brand-copy">
              <strong>OZLIND</strong>
              <span>AI PLATFORM</span>
            </span>
          </button>

          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={18} />
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

          <nav className="sidebar-nav">
            <button
              className="sidebar-nav-item active"
              onClick={startNewChat}
            >
              <MessageSquare size={17} />
              <span>AI Chat</span>
              <span className="live-dot">LIVE</span>
            </button>

            <button
              className={`sidebar-nav-item ${
                settings.research ? "active" : ""
              }`}
              onClick={() => {
                updateSettings({ research: !settings.research });
                showNotice(
                  settings.research
                    ? "Research disabled"
                    : "Research enabled"
                );
              }}
            >
              <Search size={17} />
              <span>Web Research</span>
              <span className="live-dot">LIVE</span>
            </button>
          </nav>

          <div className="sidebar-section">
            <div className="sidebar-section-heading">
              <span>Workspace</span>
            </div>

            <button className="sidebar-nav-item disabled">
              <Sparkles size={17} />
              <span>Image Generator</span>
              <span className="next-label">NEXT</span>
            </button>

            <button className="sidebar-nav-item disabled">
              <FileText size={17} />
              <span>Documents</span>
              <span className="next-label">NEXT</span>
            </button>

            <button className="sidebar-nav-item disabled">
              <Code2 size={17} />
              <span>Code Assistant</span>
              <span className="next-label">NEXT</span>
            </button>
          </div>

          <div className="sidebar-section history-section">
            <div className="sidebar-section-heading">
              <span>History</span>

              {history.length > 0 && (
                <button
                  className="text-button"
                  onClick={clearHistory}
                >
                  Clear
                </button>
              )}
            </div>

            {history.length > 0 && (
              <div className="history-search">
                <Search size={14} />
                <input
                  value={historySearch}
                  onChange={(event) =>
                    setHistorySearch(event.target.value)
                  }
                  placeholder="Search history"
                  aria-label="Search history"
                />
              </div>
            )}

            <div className="history-list">
              {filteredHistory.length === 0 ? (
                <div className="history-empty">
                  <span>No conversations yet.</span>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    className={`history-item ${
                      activeChatId === item.id
                        ? "active"
                        : ""
                    }`}
                    key={item.id}
                  >
                    <button
                      className="history-item-main"
                      onClick={() => openHistoryItem(item)}
                    >
                      <MessageSquare size={14} />
                      <span>{item.title}</span>
                    </button>

                    <button
                      className="history-delete"
                      onClick={() =>
                        deleteHistoryItem(item.id)
                      }
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-nav-item"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className="profile-card"
            onClick={openAccount}
            aria-label="Open account settings"
          >
            <div className="profile-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>

            <div className="profile-info">
              <strong>{userName}</strong>
              <span>{userEmail}</span>
            </div>

            <ChevronRight size={16} />
          </button>
        </div>
      </aside>

      <main className="ozlind-main">
        <header className="ozlind-topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={19} />
            </button>

            <div className="mobile-brand">
              <strong>OZLIND</strong>
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
              onClick={() => setIsDark((current) => !current)}
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className="icon-button"
              onClick={shareConversation}
              aria-label="Share conversation"
              title="Share"
            >
              <Share2 size={18} />
            </button>

            <button
              className="clear-chat-button"
              onClick={clearCurrentChat}
            >
              <Trash2 size={16} />
              <span>Clear chat</span>
            </button>
          </div>
        </header>

        <section className="workspace">
          {!hasMessages ? (
            <div className="welcome-screen">
              <div className="welcome-badge">
                <Sparkles size={15} />
                <span>OZLIND AI</span>
              </div>

              <h1>
                What can I help
                <br />
                you with?
              </h1>

              <p>
                Ask questions, analyze files, research topics,
                write code, or plan your next idea.
              </p>

              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;

                  return (
                    <button
                      className="suggestion-card"
                      key={suggestion.title}
                      onClick={() =>
                        selectSuggestion(
                          suggestion.prompt
                        )
                      }
                    >
                      <span className="suggestion-icon">
                        <Icon size={18} />
                      </span>

                      <span className="suggestion-content">
                        <strong>{suggestion.title}</strong>
                        <span>{suggestion.prompt}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="chat-area">
              <div className="messages-list">
                {messages.map((message, index) => {
                  const isUser = message.role === "user";
                  const content = getMessageText(message);

                  return (
                    <article
                      className={`message-row ${
                        isUser ? "user" : "assistant"
                      }`}
                      key={message.id || index}
                    >
                      {!isUser && (
                        <div className="assistant-avatar">
                          <Sparkles size={15} />
                        </div>
                      )}

                      <div className="message-column">
                        <div className="message-meta">
                          <span>
                            {isUser ? "You" : "Ozlind AI"}
                          </span>
                        </div>

                        <div className="message-bubble">
                          {message.attachment && (
                            <div className="message-attachment">
                              {message.attachment.dataUrl &&
                              message.attachment.type?.startsWith(
                                "image/"
                              ) ? (
                                <img
                                  src={
                                    message.attachment.dataUrl
                                  }
                                  alt={
                                    message.attachment.name
                                  }
                                />
                              ) : (
                                <div className="attachment-file">
                                  <FileText size={16} />
                                  <span>
                                    {message.attachment.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {content ? (
                            isUser ? (
                              <p>{content}</p>
                            ) : (
                              <div className="markdown-content">
                                {renderMarkdown(content)}
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
                              copyMessage(content, index)
                            }
                            aria-label="Copy message"
                          >
                            {copiedMessage === index ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          {isUser && (
                            <button
                              onClick={() =>
                                editMessage(message)
                              }
                              aria-label="Edit message"
                            >
                              <PenLine size={14} />
                            </button>
                          )}

                          {!isUser &&
                            index === messages.length - 1 &&
                            !isStreaming && (
                              <button
                                onClick={regenerateLastResponse}
                                aria-label="Regenerate response"
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div ref={bottomRef} />
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
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
                  {selectedFile.dataUrl &&
                  selectedFile.type?.startsWith("image/") ? (
                    <img
                      src={selectedFile.dataUrl}
                      alt={selectedFile.name}
                    />
                  ) : (
                    <FileText size={18} />
                  )}

                  <div>
                    <strong>{selectedFile.name}</strong>
                    <span>
                      {formatFileSize(selectedFile.size)}
                    </span>
                  </div>
                </div>

                <button
                  className="icon-button"
                  onClick={removeSelectedFile}
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
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Paperclip size={19} />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.txt,.csv,.md,.json,.doc,.docx"
                  />

                  <div
                    className="mode-selector"
                    ref={modeRef}
                  >
                    <button
                      className="mode-button"
                      onClick={() =>
                        setModeOpen((current) => !current)
                      }
                      aria-expanded={modeOpen}
                    >
                      <selectedMode.icon size={16} />
                      <span>{selectedMode.label}</span>
                      <ChevronDown size={14} />
                    </button>

                    {modeOpen && (
                      <div className="mode-menu">
                        {MODES.map((item) => {
                          const Icon = item.icon;

                          return (
                            <button
                              key={item.id}
                              className={`mode-menu-item ${
                                mode === item.id
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                setMode(item.id);
                                setModeOpen(false);
                              }}
                            >
                              <span className="mode-menu-icon">
                                <Icon size={16} />
                              </span>

                              <span className="mode-menu-copy">
                                <strong>{item.label}</strong>
                                <span>
                                  {item.description}
                                </span>
                              </span>

                              {mode === item.id && (
                                <Check size={15} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    className={`research-toggle ${
                      settings.research ? "active" : ""
                    }`}
                    onClick={() =>
                      updateSettings({
                        research: !settings.research,
                      })
                    }
                    aria-pressed={settings.research}
                  >
                    <Search size={15} />
                    <span>Research</span>
                  </button>
                </div>

                <div className="composer-right">
                  {isStreaming ? (
                    <button
                      className="send-button stop"
                      onClick={stopGeneration}
                      aria-label="Stop generation"
                    >
                      <span className="stop-square" />
                    </button>
                  ) : (
                    <button
                      className="send-button"
                      onClick={() => sendMessage()}
                      disabled={
                        !input.trim() && !selectedFile
                      }
                      aria-label="Send message"
                    >
                      <ArrowUp size={19} />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                className="composer-input"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Message OZLIND AI..."
                rows={1}
                disabled={isStreaming}
                aria-label="Message OZLIND AI"
              />

              <div className="composer-footer">
                <span>
                  OZLIND can make mistakes. Verify important
                  information.
                </span>

                <span className="keyboard-hint">
                  <kbd>Enter</kbd> send
                  <kbd>Shift</kbd>+
                  <kbd>Enter</kbd> new line
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {accountOpen && (
        <div className="account-overlay">
          <section className="account-page" aria-label="OZLIND account center">
            <header className="account-page-header">
              <button type="button" className="account-back-button" onClick={() => accountSection ? setAccountSection(null) : closeAccount()} aria-label={accountSection ? "Back to account" : "Back to OZLIND AI"}>
                <span className="account-back-arrow">‹</span>
              </button>
              <div className="account-header-title">
                <strong>{accountSection === "profile" ? "Profile" : accountSection === "security" ? "Security & login" : accountSection === "personalization" ? "Personalization" : accountSection === "memory" ? "Memory" : accountSection === "research" ? "Web Research" : accountSection === "appearance" ? "Appearance" : accountSection === "integrations" ? "Integrations" : accountSection === "usage" ? "Usage" : accountSection === "privacy" ? "Privacy Center" : accountSection === "data" ? "Data Controls" : accountSection === "support" ? "Help & Support" : accountSection === "about" ? "About OZLIND" : "Account"}</strong>
                <span>OZLIND</span>
              </div>
              <div className="account-header-spacer" aria-hidden="true" />
            </header>

            {!accountSection && (
              <div className="account-scroll">
                <section className="account-profile-hero">
                  <div className="account-hero-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitials}</span>}</div>
                  <strong>{userName}</strong>
                  <span>{userEmail}</span>
                  <div className="account-provider-badge"><span className="account-provider-dot" />OZLIND account</div>
                </section>

                <AccountGroup title="OZLIND">
                  <AccountRow icon={UserRound} title="Profile" subtitle="Account information" onClick={() => openAccountSection("profile")} />
                  <AccountRow icon={SlidersHorizontal} title="Personalization" subtitle="Response style and AI preferences" onClick={() => openAccountSection("personalization")} />
                  <AccountRow icon={BrainCircuit} title="Memory" subtitle={settings.memory ? "On" : "Off"} trailing={<AccountSwitch checked={settings.memory} />} onClick={() => openAccountSection("memory")} />
                  <AccountRow icon={Search} title="Web Research" subtitle={settings.research ? "Enabled" : "Disabled"} trailing={<AccountSwitch checked={settings.research} />} onClick={() => openAccountSection("research")} />
                  <AccountRow icon={Palette} title="Appearance" subtitle={isDark ? "Dark mode" : "Light mode"} trailing={<AccountSwitch checked={isDark} />} onClick={() => openAccountSection("appearance")} />
                  <AccountRow icon={Plug} title="Integrations" subtitle="Connected services and tools" onClick={() => openAccountSection("integrations")} />
                  <AccountRow icon={Zap} title="Usage" subtitle="Workspace activity" onClick={() => openAccountSection("usage")} />
                </AccountGroup>

                <AccountGroup title="Account">
                  <AccountRow icon={LockKeyhole} title="Security & login" subtitle="Authentication and account access" onClick={() => openAccountSection("security")} />
                </AccountGroup>

                <AccountGroup title="Privacy & data">
                  <AccountRow icon={Shield} title="Privacy Center" subtitle="Privacy and workspace information" onClick={() => openAccountSection("privacy")} />
                  <AccountRow icon={Database} title="Data Controls" subtitle="Manage your local OZLIND data" onClick={() => openAccountSection("data")} />
                </AccountGroup>

                <AccountGroup title="Support">
                  <AccountRow icon={CircleHelp} title="Help & Support" subtitle="Get help with OZLIND" onClick={() => openAccountSection("support")} />
                  <AccountRow icon={Info} title="About OZLIND" subtitle="OZLIND AI and OZLIND Enterprises" onClick={() => openAccountSection("about")} />
                </AccountGroup>

                <button type="button" className="account-logout-button" onClick={handleLogout} disabled={loggingOut}>
                  <LogOut size={20} />
                  <span>{loggingOut ? "Signing out…" : "Log out"}</span>
                </button>
                <p className="account-version">OZLIND AI · Your intelligent workspace</p>
              </div>
            )}

            {accountSection === "profile" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero"><div className="account-hero-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitials}</span>}</div><strong>{userName}</strong><span>{userEmail}</span><small>OZLIND account</small></section>
                <div className="account-group-card"><AccountInfoRow label="Name" value={userName} /><AccountInfoRow label="Email" value={userEmail} /><AccountInfoRow label="Organization" value="OZLIND Enterprises" /><AccountInfoRow label="Product" value="OZLIND AI" /></div>
                <p className="account-detail-note">Your profile information is used to identify your OZLIND workspace.</p>
              </div>
            )}

            {accountSection === "security" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><LockKeyhole size={30} /><strong>Security & login</strong><span>Manage how your OZLIND account is accessed.</span></section>
                <div className="account-group-card"><AccountInfoRow label="Account" value={userEmail} /><AccountInfoRow label="Authentication" value={accountUser ? "Connected" : "Local session"} /><AccountInfoRow label="Session" value="Active" /></div>
                <p className="account-detail-note">When authentication is enabled, OZLIND uses the configured authentication system for account access.</p>
              </div>
            )}

            {accountSection === "personalization" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><SlidersHorizontal size={30} /><strong>Personalization</strong><span>Control how OZLIND responds to you.</span></section>
                <AccountGroup title="Response length">
                  <AccountRow title="Concise" subtitle="Short and focused answers" trailing={settings.responseLength === "short" ? <Check size={18} /> : null} onClick={() => updateSettings({ responseLength: "short" })} />
                  <AccountRow title="Balanced" subtitle="Normal detail and clarity" trailing={settings.responseLength === "medium" ? <Check size={18} /> : null} onClick={() => updateSettings({ responseLength: "medium" })} />
                  <AccountRow title="Detailed" subtitle="More explanation and context" trailing={settings.responseLength === "long" ? <Check size={18} /> : null} onClick={() => updateSettings({ responseLength: "long" })} />
                </AccountGroup>
                <AccountGroup title="Response style">
                  {[['balanced','Balanced'],['professional','Professional'],['friendly','Friendly'],['direct','Direct']].map(([value,label]) => <AccountRow key={value} title={label} subtitle={`Use ${label.toLowerCase()} response style`} trailing={settings.responseStyle === value ? <Check size={18} /> : null} onClick={() => updateSettings({ responseStyle: value })} />)}
                </AccountGroup>
                <button type="button" className="account-primary-action" onClick={() => { setAccountSection(null); setSettingsOpen(true); }}>Open advanced settings</button>
              </div>
            )}

            {accountSection === "memory" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><BrainCircuit size={30} /><strong>Memory</strong><span>Control whether relevant local conversation context is used.</span></section>
                <div className="account-group-card"><AccountRow icon={BrainCircuit} title="Memory" subtitle={settings.memory ? "OZLIND can use relevant conversation context" : "Conversation memory is disabled"} trailing={<AccountSwitch checked={settings.memory} />} onClick={() => updateSettings({ memory: !settings.memory })} /></div>
                <p className="account-detail-note">This setting controls the memory behavior available to the current OZLIND workspace.</p>
              </div>
            )}

            {accountSection === "research" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><Search size={30} /><strong>Web Research</strong><span>Allow OZLIND to use web research when enabled.</span></section>
                <div className="account-group-card"><AccountRow icon={Search} title="Research mode" subtitle={settings.research ? "Web research is enabled" : "Web research is disabled"} trailing={<AccountSwitch checked={settings.research} />} onClick={() => updateSettings({ research: !settings.research })} /></div>
                <p className="account-detail-note">Research can provide current web information when the research feature is available.</p>
              </div>
            )}

            {accountSection === "appearance" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">{isDark ? <Moon size={30} /> : <Sun size={30} />}<strong>Appearance</strong><span>Choose how the OZLIND workspace looks.</span></section>
                <AccountGroup title="Theme">
                  <AccountRow icon={Sun} title="Light" subtitle="Use the light workspace" trailing={!isDark ? <Check size={18} /> : null} onClick={() => setIsDark(false)} />
                  <AccountRow icon={Moon} title="Dark" subtitle="Use the dark workspace" trailing={isDark ? <Check size={18} /> : null} onClick={() => setIsDark(true)} />
                </AccountGroup>
              </div>
            )}

            {accountSection === "integrations" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><Plug size={30} /><strong>Integrations</strong><span>Connected services used by your workspace.</span></section>
                <div className="account-group-card"><AccountInfoRow label="AI workspace" value="OZLIND AI" /><AccountInfoRow label="Authentication" value={accountUser ? "Connected" : "Temporarily disabled"} /><AccountInfoRow label="Workspace storage" value="Local" /><AccountInfoRow label="Web Research" value={settings.research ? "Enabled" : "Disabled"} /></div>
                <p className="account-detail-note">Additional integrations can be connected as OZLIND features become available.</p>
              </div>
            )}

            {accountSection === "usage" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><Zap size={30} /><strong>Usage</strong><span>Overview of your current OZLIND workspace.</span></section>
                <div className="account-group-card"><AccountInfoRow label="Saved conversations" value={String(history.length)} /><AccountInfoRow label="Current messages" value={String(messages.length)} /><AccountInfoRow label="Memory" value={settings.memory ? "On" : "Off"} /><AccountInfoRow label="Research" value={settings.research ? "On" : "Off"} /></div>
                <p className="account-detail-note">Usage information shown here is based on data currently available to this workspace.</p>
              </div>
            )}

            {accountSection === "privacy" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><Shield size={30} /><strong>Privacy Center</strong><span>Understand your current workspace data behavior.</span></section>
                <div className="account-group-card"><AccountInfoRow label="Conversation history" value="Stored locally" /><AccountInfoRow label="Preferences" value="Stored locally" /><AccountInfoRow label="Authentication" value={accountUser ? "Account session" : "Temporarily disabled"} /></div>
                <p className="account-detail-note">OZLIND currently keeps chat history and preferences in your browser's local storage. Server-side AI requests are handled through the configured OZLIND API routes.</p>
              </div>
            )}

            {accountSection === "data" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><Database size={30} /><strong>Data Controls</strong><span>Manage the data stored by this workspace.</span></section>
                <AccountGroup title="Your data"><AccountInfoRow label="Conversations" value={`${history.length} saved`} /><AccountInfoRow label="Preferences" value="Local" /><AccountInfoRow label="Theme" value={isDark ? "Dark" : "Light"} /></AccountGroup>
                <button type="button" className="account-primary-action" onClick={exportOzlindData}><Database size={17} />Export OZLIND data</button>
                <button type="button" className="account-danger-action" onClick={clearAllLocalData}><Trash2 size={17} />Clear all local data</button>
                <p className="account-detail-note">Clearing local data removes saved conversations, preferences and theme settings from this browser.</p>
              </div>
            )}

            {accountSection === "support" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact"><CircleHelp size={30} /><strong>Help & Support</strong><span>Information for using OZLIND AI.</span></section>
                <AccountGroup title="Common actions">
                  <AccountRow icon={MessageSquare} title="Start a new chat" subtitle="Create a fresh conversation" onClick={() => { closeAccount(); startNewChat(); }} />
                  <AccountRow icon={Settings2} title="Open settings" subtitle="Configure OZLIND behavior" onClick={() => { setAccountSection(null); setSettingsOpen(true); }} />
                  <AccountRow icon={Trash2} title="Clear current chat" subtitle="Remove the active conversation" onClick={() => { closeAccount(); clearCurrentChat(); }} />
                </AccountGroup>
                <p className="account-detail-note">For issues with OZLIND, first check your connection, settings and available API configuration.</p>
              </div>
            )}

            {accountSection === "about" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero"><div className="account-about-mark">O</div><strong>OZLIND AI</strong><span>Independent AI workspace</span><small>Built as part of OZLIND Enterprises</small></section>
                <div className="account-group-card"><AccountInfoRow label="Product" value="OZLIND AI" /><AccountInfoRow label="Organization" value="OZLIND Enterprises" /><AccountInfoRow label="Owner / Builder" value="Athul" /><AccountInfoRow label="Workspace" value="OZLIND AI Platform" /></div>
                <p className="account-detail-note">OZLIND is owned by Athul and operates under OZLIND Enterprises.</p>
              </div>
            )}
          </section>
        </div>
      )}


      {settingsOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
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
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-content">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>AI behavior</strong>
                  <span>
                    Configure how OZLIND responds.
                  </span>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Provider routing</strong>
                    <span>
                      Automatically select an available
                      provider when possible.
                    </span>
                  </div>

                  <select
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value)
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="fast">Fast</option>
                    <option value="vision">Vision</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Research</strong>
                    <span>
                      Allow web research when enabled.
                    </span>
                  </div>

                  <button
                    className={`switch ${
                      settings.research ? "active" : ""
                    }`}
                    onClick={() =>
                      updateSettings({
                        research: !settings.research,
                      })
                    }
                    role="switch"
                    aria-checked={settings.research}
                  >
                    <span />
                  </button>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Memory</strong>
                    <span>
                      Keep useful local conversation context.
                    </span>
                  </div>

                  <button
                    className={`switch ${
                      settings.memory ? "active" : ""
                    }`}
                    onClick={() =>
                      updateSettings({
                        memory: !settings.memory,
                      })
                    }
                    role="switch"
                    aria-checked={settings.memory}
                  >
                    <span />
                  </button>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>Response style</strong>
                  <span>
                    Adjust answer length and writing style.
                  </span>
                </div>

                <div className="segmented-control">
                  {[
                    ["short", "Concise"],
                    ["medium", "Balanced"],
                    ["long", "Detailed"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={
                        settings.responseLength === value
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        updateSettings({
                          responseLength: value,
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="segmented-control">
                  {[
                    ["balanced", "Balanced"],
                    ["professional", "Professional"],
                    ["friendly", "Friendly"],
                    ["direct", "Direct"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={
                        settings.responseStyle === value
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        updateSettings({
                          responseStyle: value,
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>Custom instructions</strong>
                  <span>
                    Optional instructions applied to your
                    conversations.
                  </span>
                </div>

                <textarea
                  className="settings-textarea"
                  value={settings.customInstructions}
                  onChange={(event) =>
                    updateSettings({
                      customInstructions:
                        event.target.value,
                    })
                  }
                  placeholder="Tell OZLIND how you want responses to be written..."
                  rows={5}
                />
              </section>

              <section className="settings-section account-section">
                <div className="settings-section-heading">
                  <strong>Account</strong>
                  <span>
                    Your current OZLIND profile.
                  </span>
                </div>

                <div className="account-card">
                  <div className="profile-avatar large">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      <span>{userInitials}</span>
                    )}
                  </div>

                  <div>
                    <strong>{userName}</strong>
                    <span>{userEmail}</span>
                  </div>
                </div>
              </section>
            </div>

            <div className="dialog-footer">
              <button
                className="secondary-button"
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  showNotice("Settings reset");
                }}
              >
                Reset
              </button>

              <button
                className="primary-button"
                onClick={() => {
                  setSettingsOpen(false);
                  showNotice("Settings saved");
                }}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-icon">
            <Check size={15} />
          </span>
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}

function AccountInfoRow({ label, value }) {
  return (
    <div className="account-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AccountGroup({ title, children }) {
  return (
    <section className="account-group">
      <h2>{title}</h2>
      <div className="account-group-card">{children}</div>
    </section>
  );
}

function AccountRow({ icon: Icon, title, subtitle, trailing, onClick }) {
  return (
    <button type="button" className="account-row" onClick={onClick}>
      <span className="account-row-icon">{Icon ? <Icon size={20} strokeWidth={1.8} /> : null}</span>
      <span className="account-row-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </span>
      {trailing || <ChevronRight size={18} className="account-row-chevron" />}
    </button>
  );
}

function AccountSwitch({ checked }) {
  return (
    <span className={`account-switch ${checked ? "active" : ""}`} aria-hidden="true">
      <span />
    </span>
  );
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(String(reader.result));

    reader.onerror = () =>
      reject(
        new Error(
          "Could not read the image."
        )
      );

    reader.readAsDataURL(file);
  });
}