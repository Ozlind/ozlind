"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, ChevronRight, BrainCircuit, Check, ChevronDown, Code2, Copy,
  FileText, Lightbulb, Map, Menu, MessageSquare, Moon, Paperclip,
  PanelLeftClose, PenLine, RefreshCw, Search, Settings2, SlidersHorizontal,
  UserRound, LogOut, LockKeyhole, Database, Shield, Palette, CircleHelp,
  Info, Plug, Share2, Sparkles, Telescope, Trash2, X, Zap, Sun,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";

const HISTORY_KEY = "ozlind_history_v2";
const SETTINGS_KEY = "ozlind_settings_v2";
const THEME_KEY = "ozlind_theme_v1";

const MAX_HISTORY_ITEMS = 100;

const DEFAULT_SETTINGS = {
  research: false,
  memory: true,
  responseStyle: "balanced",
  responseLength: "medium",
  customInstructions: "",
};

const MODES = [
  { id: "auto", label: "Auto", description: "Balanced reasoning and speed", icon: Sparkles },
  { id: "fast", label: "Fast", description: "Quick answers for everyday tasks", icon: Zap },
  { id: "pro", label: "Pro", description: "Deeper reasoning and complex tasks", icon: BrainCircuit },
  { id: "vision", label: "Vision", description: "Understand images and visual files", icon: Telescope },
];

const SUGGESTIONS = [
  { icon: Lightbulb, title: "Explain a topic", prompt: "Explain how large language models work, in simple terms." },
  { icon: Code2, title: "Write or review code", prompt: "Review this code and suggest improvements:\n\n" },
  { icon: FileText, title: "Summarize a text", prompt: "Summarize the key points of the following text:\n\n" },
  { icon: Map, title: "Plan a project", prompt: "Create a practical, step-by-step plan for this goal: " },
];

const TEXT_FILE_PATTERN = /\.(txt|md|csv|json|log|py|js|jsx|ts|tsx|html|css|sql|xml|yml|yaml)$/i;
const MAX_TEXT_FILE_CHARS = 8000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

// ---------- utilities ----------

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTitle(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > 52 ? `${cleaned.slice(0, 52).trim()}…` : cleaned;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextFile(file) {
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    TEXT_FILE_PATTERN.test(file.name)
  );
}

async function readTextFile(file) {
  const text = await file.text();
  return text.length > MAX_TEXT_FILE_CHARS
    ? `${text.slice(0, MAX_TEXT_FILE_CHARS)}\n…[file truncated]`
    : text;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

async function imageToOptimizedDataUrl(file) {
  const original = await fileToDataUrl(file);
  if (file.type === "image/gif" || file.type === "image/svg+xml") return original;

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = original;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return original;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return original;
  }
}

function getMessageText(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  return "";
}

function stripAttachmentData(message) {
  if (!message?.attachment) return message;
  const { dataUrl, text, ...rest } = message.attachment;
  return { ...message, attachment: rest };
}

// Only the most recent image keeps its base64 payload; older images become
// text placeholders so long threads don't blow the request size.
function buildApiMessages(currentMessages) {
  const lastImageIndex = (() => {
    for (let i = currentMessages.length - 1; i >= 0; i -= 1) {
      if (currentMessages[i].attachment?.dataUrl) return i;
    }
    return -1;
  })();

  return currentMessages.map((message, index) => {
    const text = getMessageText(message);
    const attachment = message.attachment;

    if (attachment?.dataUrl && attachment.type?.startsWith("image/")) {
      const content = [];
      if (text) content.push({ type: "text", text });
      if (index === lastImageIndex) {
        content.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
      } else {
        content.push({ type: "text", text: `[Earlier image: ${attachment.name}]` });
      }
      return { role: message.role, content };
    }

    if (attachment?.text) {
      return {
        role: message.role,
        content: `${text}\n\n[Attached file: ${attachment.name}]\n\`\`\`\n${attachment.text}\n\`\`\``,
      };
    }

    if (attachment?.name) {
      return {
        role: message.role,
        content: `${text}\n\n[Earlier attachment: ${attachment.name} — no longer available]`,
      };
    }

    return { role: message.role, content: text };
  });
}

function hasImagePart(apiMessages) {
  return apiMessages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some(
        (part) =>
          part?.type === "image_url" &&
          typeof part?.image_url?.url === "string" &&
          part.image_url.url.startsWith("data:image/")
      )
  );
}

// ---------- small components ----------

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

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className = codeElement?.props?.className || "";
  const language = (/language-([\w-]+)/.exec(className) || [])[1] || "";
  const raw = codeElement?.props?.children;
  const code = String(Array.isArray(raw) ? raw.join("") : raw ?? "").replace(/\n$/, "");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || "code"}</span>
        <button type="button" onClick={copyCode} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

// ---------- main ----------

export default function OzlindApp({ initialUser = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSection, setAccountSection] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [isDark, setIsDark] = useState(false);

  const accountUser = initialUser || null;

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef(null);
  const modeRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);

  const selectedMode = useMemo(
    () => MODES.find((item) => item.id === mode) || MODES[0],
    [mode]
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return history;
    return history.filter((item) => String(item.title || "").toLowerCase().includes(query));
  }, [history, historySearch]);

  // ---------- persistence ----------

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed && typeof parsed === "object") {
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      }
    } catch {
      setHistory([]);
      setSettings(DEFAULT_SETTINGS);
    }

    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      setIsDark(storedTheme ? storedTheme === "dark" : Boolean(prefersDark));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // ---------- global listeners ----------

  useEffect(() => {
    const handleClick = (event) => {
      if (modeRef.current && !modeRef.current.contains(event.target)) setModeOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!notice) return undefined;
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(noticeTimerRef.current);
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
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => () => {
    clearTimeout(copiedTimerRef.current);
    abortControllerRef.current?.abort();
  }, []);

  // ---------- helpers ----------

  function showNotice(message) {
    setNotice(message);
  }

  function updateSettings(patch) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  // Abort any in-flight stream and reset the sending guards so the next
  // send is never blocked by a stale flag.
  function cancelActiveStream() {
    const controller = abortControllerRef.current;
    if (controller) {
      controller.abort();
      abortControllerRef.current = null;
    }
    sendingRef.current = false;
    setIsStreaming(false);
  }

  function autoResizeTextarea() {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 48), 180)}px`;
  }

  function handleInputChange(event) {
    setInput(event.target.value);
    autoResizeTextarea();
  }

  function updateHistoryFromMessages(nextMessages, chatId) {
    if (!chatId || !nextMessages?.length) return;
    const firstUser = nextMessages.find((item) => item.role === "user");
    const title = firstUser ? createTitle(firstUser.content) : "New conversation";
    const updatedAt = Date.now();

    setHistory((current) => {
      const existing = current.find((item) => item.id === chatId);
      const record = {
        id: chatId,
        title: existing?.title || title,
        messages: nextMessages.map(stripAttachmentData),
        updatedAt,
      };
      const withoutCurrent = current.filter((item) => item.id !== chatId);
      // Cap so localStorage never overflows on long-lived installs.
      return [record, ...withoutCurrent].slice(0, MAX_HISTORY_ITEMS);
    });
  }

  // ---------- navigation ----------

  function startNewChat() {
    cancelActiveStream();
    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setActiveChatId(null);
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function openHistoryItem(item) {
    cancelActiveStream();
    setMessages(Array.isArray(item.messages) ? item.messages : []);
    setActiveChatId(item.id);
    setInput("");
    setSelectedFile(null);
    setError("");
    setSidebarOpen(false);
  }

  function deleteHistoryItem(id) {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (activeChatId === id) startNewChat();
    showNotice("Conversation deleted");
  }

  function clearHistory() {
    if (!history.length) return;
    setHistory([]);
    if (activeChatId) startNewChat();
    showNotice("History cleared");
  }

  function clearCurrentChat() {
    cancelActiveStream();
    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    if (activeChatId) {
      setHistory((current) => current.filter((item) => item.id !== activeChatId));
    }
    setActiveChatId(null);
    showNotice("Chat cleared");
  }

  // ---------- account ----------

  function openAccount() {
    setSidebarOpen(false);
    setAccountSection(null);
    setAccountOpen(true);
  }

  function closeAccount() {
    setAccountSection(null);
    setAccountOpen(false);
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
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
    if (!window.confirm("Clear all local OZLIND conversations and preferences? This cannot be undone.")) return;
    cancelActiveStream();
    setMessages([]);
    setHistory([]);
    setActiveChatId(null);
    setInput("");
    setSelectedFile(null);
    setError("");
    setSettings(DEFAULT_SETTINGS);
    setAccountSection(null);
    setIsDark(false);
    try {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(THEME_KEY);
    } catch {
      // ignore
    }
    showNotice("Local OZLIND data cleared");
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
    window.location.assign("/login");
  }

  const userName =
    accountUser?.user_metadata?.full_name ||
    accountUser?.user_metadata?.name ||
    accountUser?.email?.split("@")[0] ||
    "OZLIND User";
  const userEmail = accountUser?.email || "Local OZLIND account";
  const avatarUrl = accountUser?.user_metadata?.avatar_url || accountUser?.user_metadata?.picture || "";
  const userInitials =
    userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "O";

  // ---------- files ----------

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isText = isTextFile(file);

    if (!isImage && !isText) {
      setError("This file type isn't supported. Attach an image or a text file (.txt, .md, .csv, .json).");
      return;
    }
    const maxSize = isImage ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES;
    if (file.size > maxSize) {
      setError(isImage ? "This image is too large. Please choose one under 12 MB." : "This file is too large. Text files must be under 2 MB.");
      return;
    }
    setError("");

    try {
      let dataUrl = null;
      let text = null;
      if (isImage) {
        dataUrl = await imageToOptimizedDataUrl(file);
        if (dataUrl.length > 4000000) {
          setError("This image is too large to send. Please try a smaller one.");
          return;
        }
      } else {
        text = await readTextFile(file);
      }
      setSelectedFile({ name: file.name, type: file.type || "text/plain", size: file.size, dataUrl, text });
      showNotice(`${file.name} attached`);
    } catch {
      setError("Could not read the selected file.");
    }
  }

  // ---------- message actions ----------

  async function copyMessage(content, index) {
    try {
      await navigator.clipboard.writeText(String(content || ""));
      setCopiedMessage(index);
      showNotice("Copied");
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        setCopiedMessage((current) => (current === index ? null : current));
      }, 1600);
    } catch {
      setError("Could not copy the message.");
    }
  }

  function editMessage(message) {
    if (isStreaming) return;
    const content = getMessageText(message);
    const index = messages.findIndex((item) => item.id === message.id);
    if (index >= 0) setMessages(messages.slice(0, index));
    setInput(content);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.style.height = "auto";
      el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 180)}px`;
    });
  }

  async function shareConversation() {
    const text = messages
      .map((message) => `${message.role === "user" ? "You" : "Ozlind AI"}:\n${getMessageText(message)}`)
      .join("\n\n");
    if (!text) {
      showNotice("Nothing to share yet");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ozlind AI conversation", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showNotice("Conversation copied");
    } catch {
      // user cancelled
    }
  }

  function selectSuggestion(prompt) {
    setInput(prompt);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  }

  // ---------- streaming ----------

  function handleTextareaKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing) {
      if (window.matchMedia?.("(pointer: coarse)").matches) return;
      event.preventDefault();
      if (!isStreaming) sendMessage();
    }
  }

  function stopGeneration() {
    const controller = abortControllerRef.current;
    if (controller) {
      controller.userStopped = true;
      controller.abort();
    }
  }

  async function regenerateLastResponse() {
    if (isStreaming || !messages.length) return;
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") { lastUserIndex = i; break; }
    }
    if (lastUserIndex < 0) return;
    const baseMessages = messages.slice(0, lastUserIndex + 1);
    setMessages(baseMessages);
    sendMessage(undefined, { resendMessages: baseMessages });
  }

  async function sendMessage(customPrompt, options = {}) {
    if (sendingRef.current || isStreaming) return;

    const resend = Array.isArray(options.resendMessages);
    const prompt = String(customPrompt !== undefined ? customPrompt : input).trim();

    if (!resend && !prompt && !selectedFile) {
      textareaRef.current?.focus();
      return;
    }

    sendingRef.current = true;
    setError("");

    const chatId = activeChatId || createId();
    if (!activeChatId) setActiveChatId(chatId);

    let nextMessages;
    if (resend) {
      nextMessages = options.resendMessages;
    } else {
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
              text: selectedFile.text || null,
            }
          : null,
      };
      nextMessages = [...messages, userMessage];
      setInput("");
      setSelectedFile(null);
    }

    setMessages(nextMessages);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "48px";
    });

    const assistantId = createId();
    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      createdAt: Date.now(),
      streaming: true,
    };

    setMessages((current) => [...current, assistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullText = "";
    let sources = [];

    const updateAssistant = (patch) => {
      setMessages((current) =>
        current.map((message) => (message.id === assistantId ? { ...message, ...patch } : message))
      );
    };

    try {
      const apiMessages = buildApiMessages(nextMessages);
      const body = {
        messages: apiMessages,
        mode: hasImagePart(apiMessages) ? "vision" : mode,
        research: settings.research,
        memory: settings.memory,
        responseStyle: settings.responseStyle,
        responseLength: settings.responseLength,
        customInstructions: settings.customInstructions,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message =
          response.status === 401
            ? "Your session has expired. Please sign in again."
            : response.status === 413
              ? "The attachment is too large to send."
              : "Something went wrong. Please try again.";
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      if (!response.body) throw new Error("The server returned an empty response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event) => {
        if (!event || typeof event !== "object") return;
        if (event.type === "error" || event.error) {
          throw new Error(event.error || "The AI service returned an error.");
        }
        if (event.type === "notice" && event.message) {
          showNotice(event.message);
          return;
        }
        if (event.type === "sources" && Array.isArray(event.sources)) {
          sources = event.sources;
          updateAssistant({ sources });
          return;
        }
        if (typeof event.content === "string" && event.content) {
          fullText += event.content;
          updateAssistant({ content: fullText, streaming: true });
        }
      };

      const processLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;
        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          return;
        }
        handleEvent(event);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(processLine);
      }

      buffer += decoder.decode();
      if (buffer.trim()) processLine(buffer);

      const finalContent = fullText || "No response was returned.";
      updateAssistant({ content: finalContent, sources, streaming: false });

      const finalMessages = [
        ...nextMessages,
        { ...assistantMessage, content: finalContent, sources, streaming: false },
      ];
      updateHistoryFromMessages(finalMessages, chatId);
    } catch (requestError) {
      if (requestError?.name === "AbortError") {
        if (controller.userStopped) {
          const stoppedContent = fullText || "Generation stopped.";
          updateAssistant({ content: stoppedContent, sources, streaming: false });
          if (fullText) {
            const stopped = [
              ...nextMessages,
              { ...assistantMessage, content: stoppedContent, sources, streaming: false },
            ];
            updateHistoryFromMessages(stopped, chatId);
          }
        }
        return;
      }
      const message = requestError?.message || "Unable to connect to the AI service.";
      updateAssistant({
        streaming: false,
        content: fullText || `I couldn't complete that request.\n\n${message}`,
      });
    } finally {
      sendingRef.current = false;
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      // Only clear the streaming flag if no newer send has replaced us.
      if (abortControllerRef.current === null) {
        setIsStreaming(false);
      }
    }
  }

  // ---------- markdown ----------

  function renderMarkdown(content) {
    return (
      <ReactMarkdown
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">{children}</a>
          ),
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  const hasMessages = messages.length > 0;

  // ---------- render ----------

  return (
    <div className="ozlind-app">
      {sidebarOpen && (
        <button className="mobile-sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`ozlind-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-header">
          <button className="brand-button" onClick={startNewChat} aria-label="Ozlind home">
            <span className="brand-mark">
              <svg viewBox="0 0 96 96" aria-hidden="true">
                <use href="/ozlind-icons.svg#ozl-mark" />
              </svg>
            </span>
            <span className="brand-copy">
              <strong>OZLIND</strong>
              <span>Intelligent workspace</span>
            </span>
          </button>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="sidebar-content">
          <button className="new-chat-button" onClick={startNewChat}>
            <PenLine size={17} />
            <span>New chat</span>
          </button>

          <nav className="sidebar-nav">
            <button className="sidebar-nav-item active" onClick={startNewChat}>
              <MessageSquare size={17} />
              <span>AI Chat</span>
              <span className="live-dot">LIVE</span>
            </button>
            <button
              className={`sidebar-nav-item ${settings.research ? "active" : ""}`}
              onClick={() => {
                const next = !settings.research;
                updateSettings({ research: next });
                showNotice(next ? "Research enabled" : "Research disabled");
              }}
            >
              <Search size={17} />
              <span>Web Research</span>
              <span className="live-dot">LIVE</span>
            </button>
          </nav>

          <div className="sidebar-section history-section">
            <div className="sidebar-section-heading">
              <span>History</span>
              {history.length > 0 && (
                <button className="text-button" onClick={clearHistory}>Clear</button>
              )}
            </div>

            {history.length > 0 && (
              <div className="history-search">
                <Search size={14} />
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
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
                  <div className={`history-item ${activeChatId === item.id ? "active" : ""}`} key={item.id}>
                    <button className="history-item-main" onClick={() => openHistoryItem(item)}>
                      <MessageSquare size={14} />
                      <span>{item.title}</span>
                    </button>
                    <button
                      className="history-delete"
                      onClick={() => deleteHistoryItem(item.id)}
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
          <button className="sidebar-nav-item" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <button type="button" className="profile-card" onClick={openAccount} aria-label="Open account settings">
            <div className="profile-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitials}</span>}
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
            <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
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
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" onClick={shareConversation} aria-label="Share conversation" title="Share">
              <Share2 size={18} />
            </button>
            <button className="clear-chat-button" onClick={clearCurrentChat}>
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
              <h1>How can I help you today?</h1>
              <p>Write, research, analyze files and images, or work through a problem with OZLIND AI.</p>

              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      className="suggestion-card"
                      key={suggestion.title}
                      onClick={() => selectSuggestion(suggestion.prompt)}
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
                    <article className={`message-row ${isUser ? "user" : "assistant"}`} key={message.id || index}>
                      {!isUser && (
                        <div className="assistant-avatar">
                          <Sparkles size={15} />
                        </div>
                      )}
                      <div className="message-column">
                        <div className="message-meta">
                          <span>{isUser ? "You" : "Ozlind AI"}</span>
                        </div>

                        <div className="message-bubble">
                          {message.attachment && (
                            <div className="message-attachment">
                              {message.attachment.dataUrl && message.attachment.type?.startsWith("image/") ? (
                                <img src={message.attachment.dataUrl} alt={message.attachment.name} />
                              ) : (
                                <div className="attachment-file">
                                  <FileText size={16} />
                                  <span>{message.attachment.name}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {content ? (
                            isUser ? (
                              <p>{content}</p>
                            ) : (
                              <div className="markdown-content">{renderMarkdown(content)}</div>
                            )
                          ) : message.streaming ? (
                            <div className="streaming-indicator">
                              <span />
                              <span />
                              <span />
                            </div>
                          ) : null}
                        </div>

                        {!isUser && !message.streaming && Array.isArray(message.sources) && message.sources.length > 0 && (
                          <div className="message-sources">
                            <span className="message-sources-title">Sources</span>
                            <div className="message-sources-list">
                              {message.sources.map((source, sourceIndex) => (
                                <a
                                  key={`${source.url || source.domain || "src"}-${sourceIndex}`}
                                  className="source-chip"
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <span className="source-index">{sourceIndex + 1}</span>
                                  <span className="source-text">
                                    <strong>{source.title || source.domain}</strong>
                                    <em>{source.domain}</em>
                                  </span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="message-actions">
                          <button onClick={() => copyMessage(content, index)} aria-label="Copy message">
                            {copiedMessage === index ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          {isUser && (
                            <button onClick={() => editMessage(message)} aria-label="Edit message">
                              <PenLine size={14} />
                            </button>
                          )}
                          {!isUser && index === messages.length - 1 && !isStreaming && (
                            <button onClick={regenerateLastResponse} aria-label="Regenerate response">
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
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}

          <div className="composer-area">
            {selectedFile && (
              <div className="selected-file">
                <div className="selected-file-info">
                  {selectedFile.dataUrl && selectedFile.type?.startsWith("image/") ? (
                    <img src={selectedFile.dataUrl} alt={selectedFile.name} />
                  ) : (
                    <FileText size={18} />
                  )}
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <span>{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
                <button className="icon-button" onClick={() => setSelectedFile(null)} aria-label="Remove attachment">
                  <X size={17} />
                </button>
              </div>
            )}

            <div className="composer-shell">
              <div className="composer-toolbar">
                <div className="composer-left">
                  <button
                    className="composer-icon-button"
                    onClick={() => fileInputRef.current?.click()}
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
                    accept="image/*,.txt,.md,.csv,.json,.log,.py,.js,.jsx,.ts,.tsx,.html,.css,.sql,.xml,.yml,.yaml"
                  />

                  <div className="mode-selector" ref={modeRef}>
                    <button className="mode-button" onClick={() => setModeOpen((c) => !c)} aria-expanded={modeOpen}>
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
                              className={`mode-menu-item ${mode === item.id ? "active" : ""}`}
                              onClick={() => {
                                setMode(item.id);
                                setModeOpen(false);
                              }}
                            >
                              <span className="mode-menu-icon"><Icon size={16} /></span>
                              <span className="mode-menu-copy">
                                <strong>{item.label}</strong>
                                <span>{item.description}</span>
                              </span>
                              {mode === item.id && <Check size={15} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    className={`research-toggle ${settings.research ? "active" : ""}`}
                    onClick={() => updateSettings({ research: !settings.research })}
                    aria-pressed={settings.research}
                  >
                    <Search size={15} />
                    <span>Research</span>
                  </button>
                </div>

                <div className="composer-right">
                  {isStreaming ? (
                    <button className="send-button stop" onClick={stopGeneration} aria-label="Stop generation">
                      <span className="stop-square" />
                    </button>
                  ) : (
                    <button
                      className="send-button"
                      onClick={() => sendMessage()}
                      disabled={!input.trim() && !selectedFile}
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
                placeholder="Message OZLIND AI…"
                rows={1}
                aria-label="Message OZLIND AI"
              />

              <div className="composer-footer">
                <span>OZLIND can make mistakes. Verify important information.</span>
                <span className="keyboard-hint">
                  <kbd>Enter</kbd> send
                  <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
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
              <button
                type="button"
                className="account-back-button"
                onClick={() => (accountSection ? setAccountSection(null) : closeAccount())}
                aria-label={accountSection ? "Back to account" : "Back to OZLIND AI"}
              >
                <span className="account-back-arrow">‹</span>
              </button>
              <div className="account-header-title">
                <strong>
                  {accountSection === "profile" ? "Profile"
                    : accountSection === "security" ? "Security & login"
                    : accountSection === "personalization" ? "Personalization"
                    : accountSection === "memory" ? "Memory"
                    : accountSection === "research" ? "Web Research"
                    : accountSection === "appearance" ? "Appearance"
                    : accountSection === "integrations" ? "Integrations"
                    : accountSection === "usage" ? "Usage"
                    : accountSection === "privacy" ? "Privacy Center"
                    : accountSection === "data" ? "Data Controls"
                    : accountSection === "support" ? "Help & Support"
                    : accountSection === "about" ? "About OZLIND"
                    : "Account"}
                </strong>
                <span>OZLIND</span>
              </div>
              <div className="account-header-spacer" aria-hidden="true" />
            </header>

            {!accountSection && (
              <div className="account-scroll">
                <section className="account-profile-hero">
                  <div className="account-hero-avatar">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitials}</span>}
                  </div>
                  <strong>{userName}</strong>
                  <span>{userEmail}</span>
                  <div className="account-provider-badge">
                    <span className="account-provider-dot" />OZLIND account
                  </div>
                </section>

                <AccountGroup title="OZLIND">
                  <AccountRow icon={UserRound} title="Profile" subtitle="Account information" onClick={() => setAccountSection("profile")} />
                  <AccountRow icon={SlidersHorizontal} title="Personalization" subtitle="Response style and AI preferences" onClick={() => setAccountSection("personalization")} />
                  <AccountRow icon={BrainCircuit} title="Memory" subtitle={settings.memory ? "On" : "Off"} trailing={<AccountSwitch checked={settings.memory} />} onClick={() => setAccountSection("memory")} />
                  <AccountRow icon={Search} title="Web Research" subtitle={settings.research ? "Enabled" : "Disabled"} trailing={<AccountSwitch checked={settings.research} />} onClick={() => setAccountSection("research")} />
                  <AccountRow icon={Palette} title="Appearance" subtitle={isDark ? "Dark mode" : "Light mode"} trailing={<AccountSwitch checked={isDark} />} onClick={() => setAccountSection("appearance")} />
                  <AccountRow icon={Plug} title="Integrations" subtitle="Connected services and tools" onClick={() => setAccountSection("integrations")} />
                  <AccountRow icon={Zap} title="Usage" subtitle="Workspace activity" onClick={() => setAccountSection("usage")} />
                </AccountGroup>

                <AccountGroup title="Account">
                  <AccountRow icon={LockKeyhole} title="Security & login" subtitle="Authentication and account access" onClick={() => setAccountSection("security")} />
                </AccountGroup>

                <AccountGroup title="Privacy & data">
                  <AccountRow icon={Shield} title="Privacy Center" subtitle="Privacy and workspace information" onClick={() => setAccountSection("privacy")} />
                  <AccountRow icon={Database} title="Data Controls" subtitle="Manage your local OZLIND data" onClick={() => setAccountSection("data")} />
                </AccountGroup>

                <AccountGroup title="Support">
                  <AccountRow icon={CircleHelp} title="Help & Support" subtitle="Get help with OZLIND" onClick={() => setAccountSection("support")} />
                  <AccountRow icon={Info} title="About OZLIND" subtitle="OZLIND AI and OZLIND Enterprises" onClick={() => setAccountSection("about")} />
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
                <section className="account-detail-hero">
                  <div className="account-hero-avatar">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitials}</span>}
                  </div>
                  <strong>{userName}</strong>
                  <span>{userEmail}</span>
                  <small>OZLIND account</small>
                </section>
                <div className="account-group-card">
                  <AccountInfoRow label="Name" value={userName} />
                  <AccountInfoRow label="Email" value={userEmail} />
                  <AccountInfoRow label="Organization" value="OZLIND Enterprises" />
                  <AccountInfoRow label="Product" value="OZLIND AI" />
                </div>
                <p className="account-detail-note">Your profile information is used to identify your OZLIND workspace.</p>
              </div>
            )}

            {accountSection === "security" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <LockKeyhole size={30} />
                  <strong>Security & login</strong>
                  <span>Manage how your OZLIND account is accessed.</span>
                </section>
                <div className="account-group-card">
                  <AccountInfoRow label="Account" value={userEmail} />
                  <AccountInfoRow label="Authentication" value={accountUser ? "Connected" : "Local session"} />
                  <AccountInfoRow label="Session" value="Active" />
                </div>
                <p className="account-detail-note">When authentication is enabled, OZLIND uses the configured authentication system for account access.</p>
              </div>
            )}

            {accountSection === "personalization" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <SlidersHorizontal size={30} />
                  <strong>Personalization</strong>
                  <span>Control how OZLIND responds to you.</span>
                </section>
                <AccountGroup title="Response length">
                  <AccountRow title="Concise" subtitle="Short and focused answers" trailing={settings.responseLength === "short" ? <Check size={18} /> : null} onClick={() => updateSettings({ responseLength: "short" })} />
                  <AccountRow title="Balanced" subtitle="Normal detail and clarity" trailing={settings.responseLength === "medium" ? <Check size={18} /> : null} onClick={() => updateSettings({ responseLength: "medium" })} />
                  <AccountRow title="Detailed" subtitle="More explanation and context" trailing={settings.responseLength === "long" ? <Check size={18} /> : null} onClick={() => updateSettings({ responseLength: "long" })} />
                </AccountGroup>
                <AccountGroup title="Response style">
                  {[["balanced", "Balanced"], ["professional", "Professional"], ["friendly", "Friendly"], ["direct", "Direct"]].map(([value, label]) => (
                    <AccountRow
                      key={value}
                      title={label}
                      subtitle={`Use ${label.toLowerCase()} response style`}
                      trailing={settings.responseStyle === value ? <Check size={18} /> : null}
                      onClick={() => updateSettings({ responseStyle: value })}
                    />
                  ))}
                </AccountGroup>
                <button
                  type="button"
                  className="account-primary-action"
                  onClick={() => {
                    setAccountSection(null);
                    setSettingsOpen(true);
                  }}
                >
                  Open advanced settings
                </button>
              </div>
            )}

            {accountSection === "memory" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <BrainCircuit size={30} />
                  <strong>Memory</strong>
                  <span>Control whether relevant local conversation context is used.</span>
                </section>
                <div className="account-group-card">
                  <AccountRow
                    icon={BrainCircuit}
                    title="Memory"
                    subtitle={settings.memory ? "OZLIND can use relevant conversation context" : "Conversation memory is disabled"}
                    trailing={<AccountSwitch checked={settings.memory} />}
                    onClick={() => updateSettings({ memory: !settings.memory })}
                  />
                </div>
                <p className="account-detail-note">This setting controls the memory behavior available to the current OZLIND workspace.</p>
              </div>
            )}

            {accountSection === "research" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <Search size={30} />
                  <strong>Web Research</strong>
                  <span>Allow OZLIND to use web research when enabled.</span>
                </section>
                <div className="account-group-card">
                  <AccountRow
                    icon={Search}
                    title="Research mode"
                    subtitle={settings.research ? "Web research is enabled" : "Web research is disabled"}
                    trailing={<AccountSwitch checked={settings.research} />}
                    onClick={() => updateSettings({ research: !settings.research })}
                  />
                </div>
                <p className="account-detail-note">Research can provide current web information when the research feature is available.</p>
              </div>
            )}

            {accountSection === "appearance" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  {isDark ? <Moon size={30} /> : <Sun size={30} />}
                  <strong>Appearance</strong>
                  <span>Choose how the OZLIND workspace looks.</span>
                </section>
                <AccountGroup title="Theme">
                  <AccountRow icon={Sun} title="Light" subtitle="Use the light workspace" trailing={!isDark ? <Check size={18} /> : null} onClick={() => setIsDark(false)} />
                  <AccountRow icon={Moon} title="Dark" subtitle="Use the dark workspace" trailing={isDark ? <Check size={18} /> : null} onClick={() => setIsDark(true)} />
                </AccountGroup>
              </div>
            )}

            {accountSection === "integrations" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <Plug size={30} />
                  <strong>Integrations</strong>
                  <span>Connected services used by your workspace.</span>
                </section>
                <div className="account-group-card">
                  <AccountInfoRow label="AI workspace" value="OZLIND AI" />
                  <AccountInfoRow label="Authentication" value={accountUser ? "Connected" : "Not connected"} />
                  <AccountInfoRow label="Workspace storage" value="Local" />
                  <AccountInfoRow label="Web Research" value={settings.research ? "Enabled" : "Disabled"} />
                </div>
                <p className="account-detail-note">Additional integrations can be connected as OZLIND features become available.</p>
              </div>
            )}

            {accountSection === "usage" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <Zap size={30} />
                  <strong>Usage</strong>
                  <span>Overview of your current OZLIND workspace.</span>
                </section>
                <div className="account-group-card">
                  <AccountInfoRow label="Saved conversations" value={String(history.length)} />
                  <AccountInfoRow label="Current messages" value={String(messages.length)} />
                  <AccountInfoRow label="Memory" value={settings.memory ? "On" : "Off"} />
                  <AccountInfoRow label="Research" value={settings.research ? "On" : "Off"} />
                </div>
                <p className="account-detail-note">Usage information shown here is based on data currently available to this workspace.</p>
              </div>
            )}

            {accountSection === "privacy" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <Shield size={30} />
                  <strong>Privacy Center</strong>
                  <span>Understand your current workspace data behavior.</span>
                </section>
                <div className="account-group-card">
                  <AccountInfoRow label="Conversation history" value="Stored locally" />
                  <AccountInfoRow label="Preferences" value="Stored locally" />
                  <AccountInfoRow label="Authentication" value={accountUser ? "Account session" : "Not connected"} />
                </div>
                <p className="account-detail-note">OZLIND currently keeps chat history and preferences in your browser's local storage. Server-side AI requests are handled through the configured OZLIND API routes.</p>
              </div>
            )}

            {accountSection === "data" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <Database size={30} />
                  <strong>Data Controls</strong>
                  <span>Manage the data stored by this workspace.</span>
                </section>
                <AccountGroup title="Your data">
                  <AccountInfoRow label="Conversations" value={`${history.length} saved`} />
                  <AccountInfoRow label="Preferences" value="Local" />
                  <AccountInfoRow label="Theme" value={isDark ? "Dark" : "Light"} />
                </AccountGroup>
                <button type="button" className="account-primary-action" onClick={exportOzlindData}>
                  <Database size={17} />Export OZLIND data
                </button>
                <button type="button" className="account-danger-action" onClick={clearAllLocalData}>
                  <Trash2 size={17} />Clear all local data
                </button>
                <p className="account-detail-note">Clearing local data removes saved conversations, preferences and theme settings from this browser.</p>
              </div>
            )}

            {accountSection === "support" && (
              <div className="account-scroll account-detail-scroll">
                <section className="account-detail-hero compact">
                  <CircleHelp size={30} />
                  <strong>Help & Support</strong>
                  <span>Information for using OZLIND AI.</span>
                </section>
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
                <section className="account-detail-hero">
                  <div className="account-about-mark">O</div>
                  <strong>OZLIND AI</strong>
                  <span>Independent AI workspace</span>
                  <small>Built as part of OZLIND Enterprises</small>
                </section>
                <div className="account-group-card">
                  <AccountInfoRow label="Product" value="OZLIND AI" />
                  <AccountInfoRow label="Organization" value="OZLIND Enterprises" />
                  <AccountInfoRow label="Owner / Builder" value="Athul" />
                  <AccountInfoRow label="Workspace" value="OZLIND AI Platform" />
                </div>
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
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
            <div className="dialog-header">
              <div>
                <span className="dialog-eyebrow">Preferences</span>
                <h2>Settings</h2>
              </div>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                <X size={18} />
              </button>
            </div>

            <div className="settings-content">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>AI behavior</strong>
                  <span>Configure how OZLIND responds.</span>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Provider routing</strong>
                    <span>Automatically select an available provider when possible.</span>
                  </div>
                  <select value={mode} onChange={(event) => setMode(event.target.value)}>
                    <option value="auto">Auto</option>
                    <option value="fast">Fast</option>
                    <option value="vision">Vision</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Research</strong>
                    <span>Allow web research when enabled.</span>
                  </div>
                  <button
                    className={`switch ${settings.research ? "active" : ""}`}
                    onClick={() => updateSettings({ research: !settings.research })}
                    role="switch"
                    aria-checked={settings.research}
                  >
                    <span />
                  </button>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Memory</strong>
                    <span>Keep useful local conversation context.</span>
                  </div>
                  <button
                    className={`switch ${settings.memory ? "active" : ""}`}
                    onClick={() => updateSettings({ memory: !settings.memory })}
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
                  <span>Adjust answer length and writing style.</span>
                </div>

                <div className="segmented-control">
                  {[["short", "Concise"], ["medium", "Balanced"], ["long", "Detailed"]].map(([value, label]) => (
                    <button
                      key={value}
                      className={settings.responseLength === value ? "active" : ""}
                      onClick={() => updateSettings({ responseLength: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="segmented-control">
                  {[["balanced", "Balanced"], ["professional", "Professional"], ["friendly", "Friendly"], ["direct", "Direct"]].map(([value, label]) => (
                    <button
                      key={value}
                      className={settings.responseStyle === value ? "active" : ""}
                      onClick={() => updateSettings({ responseStyle: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <strong>Custom instructions</strong>
                  <span>Optional instructions applied to your conversations.</span>
                </div>
                <textarea
                  className="settings-textarea"
                  value={settings.customInstructions}
                  onChange={(event) => updateSettings({ customInstructions: event.target.value })}
                  placeholder="Tell OZLIND how you want responses to be written..."
                  rows={5}
                />
              </section>

              <section className="settings-section account-section">
                <div className="settings-section-heading">
                  <strong>Account</strong>
                  <span>Your current OZLIND profile.</span>
                </div>
                <div className="account-card">
                  <div className="profile-avatar large">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{userInitials}</span>}
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
