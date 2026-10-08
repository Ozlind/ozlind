"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  FileText,
  Lightbulb,
  LogOut,
  Mic,
  LockKeyhole,
  Map,
  Menu,
  MessageSquare,
  Moon,
  Paperclip,
  PanelLeftClose,
  PenLine,
  Palette,
  Search,
  Settings2,
  Shield,
  Share2,
  Sparkles,
  Sun,
  Telescope,
  Trash2,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  MAX_IMAGE_BYTES,
  MAX_TEXT_BYTES,
  MAX_TEXT_FILE_CHARS,
  buildApiMessages,
  createTitle,
  fileToDataUrl,
  formatFileSize,
  getMessageText,
  hasImagePart,
  isHistoryRecord,
  isTextFile,
  makeThumbnail,
  normalizeSettings,
  optimizeImage,
  readTextFile,
  stripAttachmentData,
  withoutThumbnails,
} from "@/lib/chat/utils";
import { AccountGroup, AccountRow, Switch } from "@/components/account/AccountControls";

import {
  deleteAllConversations,
  deleteConversation,
  deleteSettings,
  fetchEverything,
  fetchMessages,
  newId as createId,
  prepareForCloud,
  saveConversation,
  saveSettings,
} from "@/lib/cloud";

import { MODES as MODE_DEFS } from "@/constants/modes";
import { DEFAULT_SETTINGS } from "@/constants/settings";
import {
  ATTACHMENT_ACCEPT,
  LIMITS,
  TEXT_FILE_PATTERN,
} from "@/constants/limits";
import {
  HISTORY_KEY,
  SETTINGS_KEY,
  THEME_KEY,
} from "@/constants/storage";

/*
 * Markdown is kept outside the main client component bundle.
 * This makes the initial OZLIND workspace smaller.
 */
const MarkdownRenderer = dynamic(
  () => import("./MarkdownRenderer"),
  {
    loading: () => (
      <div
        className="streaming-indicator"
        aria-label="Rendering response"
      >
        <span />
        <span />
        <span />
      </div>
    ),
  },
);

const MODE_ICONS = {
  sparkles: Sparkles,
  zap: Zap,
  "brain-circuit": BrainCircuit,
  telescope: Telescope,
};

const MODES = MODE_DEFS.map((mode) => ({
  ...mode,
  icon: MODE_ICONS[mode.iconName] || Sparkles,
}));

const SUGGESTIONS = [
  {
    icon: Lightbulb,
    title: "Explain a topic",
    prompt:
      "Explain how large language models work, in simple terms.",
  },
  {
    icon: Code2,
    title: "Write or review code",
    prompt:
      "Review this code and suggest improvements:\n\n",
  },
  {
    icon: FileText,
    title: "Summarize a text",
    prompt:
      "Summarize the key points of the following text:\n\n",
  },
  {
    icon: Map,
    title: "Plan a project",
    prompt:
      "Create a practical, step-by-step plan for this goal: ",
  },
];

const MAX_TEXT_FILE_CHARS = LIMITS.maxTextFileChars;
const MAX_IMAGE_BYTES = LIMITS.maxImageBytes;
const MAX_TEXT_BYTES = LIMITS.maxTextFileBytes;

/* -------------------------------------------------------------------------- */
/* Main application                                                           */
/* -------------------------------------------------------------------------- */

export default function OzlindApp({
  initialUser = null,
  initialHistory = null,
  initialSettings = null,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [settings, setSettings] = useState(
    () => normalizeSettings(initialSettings),
  );

  const [history, setHistory] = useState(
    () =>
      Array.isArray(initialHistory)
        ? initialHistory
        : [],
  );

  const [activeChatId, setActiveChatId] =
    useState(null);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [accountOpen, setAccountOpen] =
    useState(false);

  const [modeOpen, setModeOpen] =
    useState(false);

  const [historySearch, setHistorySearch] =
    useState("");

  const [historySearchResults, setHistorySearchResults] =
    useState(null);

  const [historySearchLoading, setHistorySearchLoading] =
    useState(false);

  const historySearchControllerRef =
    useRef(null);

  const [notice, setNotice] =
    useState("");

  const [error, setError] =
    useState("");

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [copiedMessage, setCopiedMessage] =
    useState(null);

  const [isDark, setIsDark] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [isListening, setIsListening] =
    useState(false);

  const [pullRefreshDistance, setPullRefreshDistance] =
    useState(0);

  const pullRefreshRef = useRef({
    active: false,
    startY: 0,
    distance: 0,
    target: null,
  });

  const accountUser = initialUser;
  const userId = accountUser?.id || "anon";
  const cloudEnabled =
    Array.isArray(initialHistory);

  const historyKey =
    `${HISTORY_KEY}:${userId}`;

  const settingsKey =
    `${SETTINGS_KEY}:${userId}`;

  const historyRef = useRef(history);
  historyRef.current = history;

  const syncedRef = useRef(
    new globalThis.Map(),
  );

  const openTokenRef = useRef(0);
  const chatLoadingRef = useRef(false);
  const hydratedRef = useRef(false);
  const sendingRef = useRef(false);

  const lastSettingsRef = useRef(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef =
    useRef(null);
  const bottomRef = useRef(null);
  const modeRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  const selectedMode = useMemo(
    () =>
      MODES.find(
        (item) => item.id === mode,
      ) || MODES[0],
    [mode],
  );

  const localFilteredHistory = useMemo(() => {
    const query = historySearch
      .trim()
      .toLowerCase();

    if (!query) return history;

    return history.filter((item) =>
      String(item.title || "")
        .toLowerCase()
        .includes(query),
    );
  }, [history, historySearch]);

  const filteredHistory =
    historySearch.trim().length >= 2 &&
    historySearchResults !== null
      ? historySearchResults
      : localFilteredHistory;

  const userName =
    accountUser?.user_metadata?.full_name ||
    accountUser?.user_metadata?.name ||
    accountUser?.email?.split("@")[0] ||
    "OZLIND User";

  const userEmail =
    accountUser?.email ||
    "Local OZLIND account";

  const avatarUrl =
    accountUser?.user_metadata?.avatar_url ||
    accountUser?.user_metadata?.picture ||
    "";

  const userInitials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "O";

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.abort?.();
      speechRecognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const state = pullRefreshRef.current;

    const reset = () => {
      state.active = false;
      state.startY = 0;
      state.distance = 0;
      state.target = null;
      setPullRefreshDistance(0);
    };

    const onTouchStart = (event) => {
      if (
        window.innerWidth > 768 ||
        event.touches.length !== 1
      ) {
        return;
      }

      const target = event.target;
      if (
        target?.closest?.(
          'textarea, input, button, [role="dialog"], .account-overlay, .dialog-backdrop, .mobile-sidebar-backdrop',
        )
      ) {
        return;
      }

      const workspace = target?.closest?.(".workspace");
      const scrollContainer = target?.closest?.(".messages-list");

      if (!workspace) return;

      if (
        scrollContainer &&
        scrollContainer.scrollTop > 0
      ) {
        return;
      }

      state.active = true;
      state.startY = event.touches[0].clientY;
      state.distance = 0;
      state.target = scrollContainer || workspace;
    };

    const onTouchMove = (event) => {
      if (
        !state.active ||
        event.touches.length !== 1
      ) {
        return;
      }

      const distance =
        event.touches[0].clientY - state.startY;

      if (distance <= 0) {
        reset();
        return;
      }

      const target = state.target;
      if (
        target &&
        "scrollTop" in target &&
        target.scrollTop > 0
      ) {
        reset();
        return;
      }

      const damped = Math.min(112, distance * 0.52);
      state.distance = damped;
      setPullRefreshDistance(damped);

      if (damped > 4) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!state.active) return;

      const shouldRefresh =
        state.distance >= 76;

      reset();

      if (shouldRefresh) {
        window.location.reload();
      }
    };

    document.addEventListener(
      "touchstart",
      onTouchStart,
      { passive: true },
    );

    document.addEventListener(
      "touchmove",
      onTouchMove,
      { passive: false },
    );

    document.addEventListener(
      "touchend",
      onTouchEnd,
      { passive: true },
    );

    document.addEventListener(
      "touchcancel",
      reset,
      { passive: true },
    );

    return () => {
      document.removeEventListener(
        "touchstart",
        onTouchStart,
      );
      document.removeEventListener(
        "touchmove",
        onTouchMove,
      );
      document.removeEventListener(
        "touchend",
        onTouchEnd,
      );
      document.removeEventListener(
        "touchcancel",
        reset,
      );
    };
  }, []);

  useEffect(() => {
    const query = historySearch.trim();

    historySearchControllerRef.current?.abort();
    historySearchControllerRef.current = null;

    if (!cloudEnabled || query.length < 2) {
      setHistorySearchResults(null);
      setHistorySearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    historySearchControllerRef.current = controller;
    setHistorySearchLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          "/api/history/search?q=" + encodeURIComponent(query),
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("History search failed.");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setHistorySearchResults(
            Array.isArray(data?.results)
              ? data.results
              : [],
          );
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("OZLIND history search failed:", error);
          if (!controller.signal.aborted) {
            setHistorySearchResults(null);
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setHistorySearchLoading(false);
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cloudEnabled, historySearch]);

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cacheList = [];
    let legacyList = [];
    let localSettings = null;

    try {
      const rawCache =
        localStorage.getItem(historyKey);

      if (rawCache) {
        const parsed = JSON.parse(rawCache);

        if (Array.isArray(parsed)) {
          cacheList =
            parsed.filter(isHistoryRecord);
        }
      }

      const rawLegacy =
        localStorage.getItem(HISTORY_KEY);

      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy);

        if (Array.isArray(parsed)) {
          legacyList =
            parsed.filter(isHistoryRecord);
        }
      }

      const rawSettings =
        localStorage.getItem(settingsKey) ??
        localStorage.getItem(SETTINGS_KEY);

      if (rawSettings) {
        localSettings =
          JSON.parse(rawSettings);
      }
    } catch {
      cacheList = [];
      legacyList = [];
    }

    const remoteSettings =
      initialSettings
        ? normalizeSettings(initialSettings)
        : null;

    setSettings(
      remoteSettings ||
        normalizeSettings(localSettings),
    );

    lastSettingsRef.current =
      remoteSettings
        ? JSON.stringify(remoteSettings)
        : null;

    if (cloudEnabled) {
      const cacheMap =
        new globalThis.Map(
          cacheList.map((item) => [
            item.id,
            item,
          ]),
        );

      const cloudIds = new Set(
        initialHistory.map(
          (item) => item.id,
        ),
      );

      const merged =
        initialHistory.map((item) => {
          const cached =
            cacheMap.get(item.id);

          if (
            cached &&
            !cached.pending &&
            Array.isArray(
              cached.messages,
            ) &&
            (cached.updatedAt || 0) >=
              (item.updatedAt || 0)
          ) {
            return {
              ...item,
              messages: cached.messages,
            };
          }

          return item;
        });

      const hasContent = (item) =>
        Array.isArray(item?.messages) &&
        item.messages.length > 0;

      const pending = cacheList.filter(
        (item) =>
          item.pending &&
          hasContent(item),
      );

      const legacy = legacyList.filter(
        (item) =>
          hasContent(item) &&
          !cloudIds.has(item.id),
      );

      const pendingIds = new Set(
        pending.map(
          (item) => item.id,
        ),
      );

      const combined = [
        ...merged.filter(
          (item) =>
            !pendingIds.has(item.id),
        ),
        ...pending,
        ...legacy.map((item) => ({
          ...item,
          pending: true,
        })),
      ].sort(
        (a, b) =>
          (b.updatedAt || 0) -
          (a.updatedAt || 0),
      );

      setHistory(combined);

      const toUpload = [
        ...pending,
        ...legacy,
      ];

      if (toUpload.length) {
        (async () => {
          for (const item of toUpload) {
            const prepared =
              prepareForCloud(item);

            if (!prepared.messages.length) {
              continue;
            }

            try {
              const stored =
                await saveConversation({
                  userId,
                  conversationId:
                    prepared.id,
                  title: prepared.title,
                  updatedAt:
                    prepared.updatedAt,
                  messages:
                    prepared.messages,
                  synced:
                    new Set(),
                });

              syncedRef.current.set(
                prepared.id,
                stored,
              );

              setHistory((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        id: prepared.id,
                        messages:
                          prepared.messages,
                        pending: false,
                      }
                    : entry,
                ),
              );
            } catch (syncError) {
              console.error(
                "OZLIND sync failed:",
                syncError,
              );
            }
          }

          if (legacy.length) {
            try {
              localStorage.removeItem(
                HISTORY_KEY,
              );
            } catch {
              // ignore
            }
          }
        })();
      }
    } else {
      const base =
        cacheList.length
          ? cacheList
          : legacyList;

      setHistory(base);

      if (
        !cacheList.length &&
        legacyList.length
      ) {
        try {
          localStorage.removeItem(
            HISTORY_KEY,
          );
        } catch {
          // ignore
        }
      }
    }

    hydratedRef.current = true;

    try {
      const storedTheme =
        localStorage.getItem(THEME_KEY);

      const prefersDark =
        window.matchMedia?.(
          "(prefers-color-scheme: dark)",
        ).matches;

      setIsDark(
        storedTheme
          ? storedTheme === "dark"
          : Boolean(prefersDark),
      );
    } catch {
      // ignore
    }

    // Initial hydration intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "dark",
      isDark,
    );

    try {
      localStorage.setItem(
        THEME_KEY,
        isDark ? "dark" : "light",
      );
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    try {
      const slim = history.map(
        (item, index) => {
          const meta = {
            id: item.id,
            title: item.title,
            updatedAt: item.updatedAt,
          };

          if (cloudEnabled) {
            return item.pending
              ? item
              : meta;
          }

          return index < 15
            ? withoutThumbnails(item)
            : meta;
        },
      );

      localStorage.setItem(
        historyKey,
        JSON.stringify(slim),
      );
    } catch {
      // ignore
    }
  }, [
    history,
    historyKey,
    cloudEnabled,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        settingsKey,
        JSON.stringify(settings),
      );
    } catch {
      // ignore
    }
  }, [settings, settingsKey]);

  useEffect(() => {
    if (
      !cloudEnabled ||
      !hydratedRef.current
    ) {
      return undefined;
    }

    const serialized =
      JSON.stringify(settings);

    if (
      serialized ===
      lastSettingsRef.current
    ) {
      return undefined;
    }

    const timer = setTimeout(() => {
      saveSettings(
        userId,
        settings,
      )
        .then(() => {
          lastSettingsRef.current =
            serialized;
        })
        .catch((saveError) => {
          console.error(
            "OZLIND settings sync failed:",
            saveError,
          );
        });
    }, 800);

    return () => clearTimeout(timer);
  }, [
    settings,
    cloudEnabled,
    userId,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Global listeners                                                       */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const handleClick = (event) => {
      if (
        modeRef.current &&
        !modeRef.current.contains(
          event.target,
        )
      ) {
        setModeOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClick,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClick,
      );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!notice) return undefined;

    clearTimeout(
      noticeTimerRef.current,
    );

    noticeTimerRef.current =
      setTimeout(
        () => setNotice(""),
        2600,
      );

    return () =>
      clearTimeout(
        noticeTimerRef.current,
      );
  }, [notice]);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key === "k"
      ) {
        event.preventDefault();
        textareaRef.current?.focus();
      }

      if (event.key === "Escape") {
        setModeOpen(false);
        setSettingsOpen(false);
        setAccountOpen(false);
        setSidebarOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyboard,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyboard,
      );
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(
        copiedTimerRef.current,
      );

      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const shouldLock =
      settingsOpen ||
      accountOpen ||
      (sidebarOpen &&
        window.matchMedia?.("(max-width: 860px)")?.matches);

    const previousOverflow =
      document.body.style.overflow;

    if (shouldLock) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    settingsOpen,
    accountOpen,
    sidebarOpen,
  ]);


  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* ---------------------------------------------------------------------- */

  function showNotice(message) {
    setNotice(message);
  }

  function updateSettings(patch) {
    setSettings((current) => ({
      ...current,
      ...patch,
    }));
  }

  function autoResizeTextarea() {
    const element =
      textareaRef.current;

    if (!element) return;

    element.style.height = "auto";

    element.style.height =
      `${Math.min(
        Math.max(
          element.scrollHeight,
          48,
        ),
        180,
      )}px`;
  }

  function handleInputChange(event) {
    setInput(event.target.value);
    autoResizeTextarea();
  }

  function markPending(id, value) {
    setHistory((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              pending: value,
            }
          : item,
      ),
    );
  }

  async function persistChat(record) {
    if (!cloudEnabled) return;

    try {
      const stored =
        await saveConversation({
          userId,
          conversationId: record.id,
          title: record.title,
          updatedAt: record.updatedAt,
          messages: record.messages,
          synced:
            syncedRef.current.get(
              record.id,
            ) || new Set(),
        });

      syncedRef.current.set(
        record.id,
        stored,
      );

      markPending(
        record.id,
        false,
      );
    } catch (syncError) {
      console.error(
        "OZLIND sync failed:",
        syncError,
      );

      markPending(
        record.id,
        true,
      );

      showNotice(
        "Could not sync to your account. Saved on this device.",
      );
    }
  }

  function updateHistoryFromMessages(
    nextMessages,
    chatId,
  ) {
    if (
      !chatId ||
      !nextMessages?.length
    ) {
      return;
    }

    const firstUser =
      nextMessages.find(
        (item) => item.role === "user",
      );

    const record = {
      id: chatId,
      title:
        historyRef.current.find(
          (item) =>
            item.id === chatId,
        )?.title ||
        createTitle(
          firstUser?.content,
        ),
      messages:
        nextMessages.map(
          stripAttachmentData,
        ),
      updatedAt: Date.now(),
      pending: cloudEnabled,
    };

    historyRef.current = [
      record,
      ...historyRef.current.filter(
        (item) =>
          item.id !== chatId,
      ),
    ];

    setHistory((current) => [
      record,
      ...current.filter(
        (item) =>
          item.id !== chatId,
      ),
    ]);

    persistChat(record);
  }

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  function startNewChat() {
    abortControllerRef.current?.abort();

    openTokenRef.current += 1;
    chatLoadingRef.current = false;

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setActiveChatId(null);
    setIsStreaming(false);
    setSidebarOpen(false);

    requestAnimationFrame(() =>
      textareaRef.current?.focus(),
    );
  }

  async function openHistoryItem(item) {
    abortControllerRef.current?.abort();

    openTokenRef.current += 1;

    const token =
      openTokenRef.current;

    const loaded =
      Array.isArray(item.messages);

    setMessages(
      loaded ? item.messages : [],
    );

    setActiveChatId(item.id);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);
    setSidebarOpen(false);

    if (loaded) {
      chatLoadingRef.current = false;

      if (
        !item.pending &&
        !syncedRef.current.has(
          item.id,
        )
      ) {
        syncedRef.current.set(
          item.id,
          new Set(
            item.messages.map(
              (message) =>
                message.id,
            ),
          ),
        );
      }

      return;
    }

    chatLoadingRef.current = true;

    try {
      const stored =
        await fetchMessages(item.id);

      if (
        openTokenRef.current !==
        token
      ) {
        return;
      }

      syncedRef.current.set(
        item.id,
        new Set(
          stored.map(
            (message) =>
              message.id,
          ),
        ),
      );

      setMessages(stored);

      setHistory((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                messages: stored,
              }
            : entry,
        ),
      );
    } catch (loadError) {
      console.error(
        "OZLIND could not load conversation:",
        loadError,
      );

      if (
        openTokenRef.current ===
        token
      ) {
        showNotice(
          "Could not load this conversation",
        );
      }
    } finally {
      if (
        openTokenRef.current ===
        token
      ) {
        chatLoadingRef.current =
          false;
      }
    }
  }

  function deleteHistoryItem(id) {
    setHistory((current) =>
      current.filter(
        (item) => item.id !== id,
      ),
    );

    syncedRef.current.delete(id);

    if (cloudEnabled) {
      deleteConversation(id).catch(
        (deleteError) => {
          console.error(
            "OZLIND delete failed:",
            deleteError,
          );
        },
      );
    }

    if (activeChatId === id) {
      startNewChat();
    }

    showNotice(
      "Conversation deleted",
    );
  }

  function clearHistory() {
    if (!history.length) return;
    if (!window.confirm("Clear all saved conversations? This cannot be undone.")) return;

    setHistory([]);
    syncedRef.current.clear();

    if (cloudEnabled) {
      deleteAllConversations(
        userId,
      ).catch((deleteError) => {
        console.error(
          "OZLIND delete failed:",
          deleteError,
        );
      });
    }

    if (activeChatId) {
      startNewChat();
    }

    showNotice("History cleared");
  }

  function clearCurrentChat() {
    if (messages.length && !window.confirm("Delete this conversation? This cannot be undone.")) return;
    abortControllerRef.current?.abort();

    setMessages([]);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);

    if (activeChatId) {
      const id = activeChatId;

      setHistory((current) =>
        current.filter(
          (item) => item.id !== id,
        ),
      );

      syncedRef.current.delete(id);

      if (cloudEnabled) {
        deleteConversation(id).catch(
          (deleteError) => {
            console.error(
              "OZLIND delete failed:",
              deleteError,
            );
          },
        );
      }
    }

    setActiveChatId(null);

    showNotice("Chat cleared");
  }

  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showNotice("Voice input is not supported in this browser. You can still type normally."); return; }
    if (isListening) { speechRecognitionRef.current?.stop?.(); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setIsListening(true); setError(""); showNotice("Listening…"); };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || []).map((result) => result?.[0]?.transcript || "").join(" ").trim();
      if (!transcript) return;
      setInput((current) => current ? current.trimEnd() + " " + transcript : transcript);
      requestAnimationFrame(() => autoResizeTextarea());
    };
    recognition.onerror = (event) => {
      if (event?.error !== "aborted" && event?.error !== "no-speech") showNotice("Voice input could not be started. Try again.");
    };
    recognition.onend = () => { setIsListening(false); speechRecognitionRef.current = null; };
    speechRecognitionRef.current = recognition;
    try { recognition.start(); } catch { setIsListening(false); speechRecognitionRef.current = null; showNotice("Voice input could not be started. Try again."); }
  }

  /* ---------------------------------------------------------------------- */
  /* Files                                                                  */
  /* ---------------------------------------------------------------------- */

  async function handleFileChange(event) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    const isImage =
      file.type.startsWith("image/");

    const isText = isTextFile(file);

    if (!isImage && !isText) {
      setError(
        "This file type isn't supported. Attach an image or a text file (.txt, .md, .csv, .json).",
      );
      return;
    }

    const maxSize = isImage
      ? MAX_IMAGE_BYTES
      : MAX_TEXT_BYTES;

    if (file.size > maxSize) {
      setError(
        isImage
          ? "This image is too large. Please choose one under 12 MB."
          : "This file is too large. Text files must be under 2 MB.",
      );
      return;
    }

    setError("");

    try {
      let dataUrl = null;
      let text = null;
      let thumb = null;

      if (isImage) {
        dataUrl =
          await optimizeImage(file);

        if (
          dataUrl.length > 4000000
        ) {
          setError(
            "This image is too large to send. Please try a smaller one.",
          );
          return;
        }

        thumb =
          await makeThumbnail(
            dataUrl,
          );
      } else {
        text =
          await readTextFile(file);
      }

      setSelectedFile({
        name: file.name,
        type:
          file.type ||
          "text/plain",
        size: file.size,
        dataUrl,
        thumb,
        text,
      });

      showNotice(
        `${file.name} attached`,
      );
    } catch {
      setError(
        "Could not read the selected file.",
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Message actions                                                        */
  /* ---------------------------------------------------------------------- */

  async function copyMessage(
    content,
    index,
  ) {
    try {
      await navigator.clipboard.writeText(
        String(content || ""),
      );

      setCopiedMessage(index);
      showNotice("Copied");

      clearTimeout(
        copiedTimerRef.current,
      );

      copiedTimerRef.current =
        setTimeout(() => {
          setCopiedMessage(
            (current) =>
              current === index
                ? null
                : current,
          );
        }, 1600);
    } catch {
      setError(
        "Could not copy the message.",
      );
    }
  }

  function editMessage(message) {
    if (isStreaming) return;

    const content =
      getMessageText(message);

    const index =
      messages.findIndex(
        (item) =>
          item.id === message.id,
      );

    if (index >= 0) {
      setMessages(
        messages.slice(0, index),
      );
    }

    setInput(content);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  }

  async function shareConversation() {
    const text = messages
      .map(
        (message) =>
          `${message.role === "user" ? "You" : "Assistant"}:\n${getMessageText(message)}`,
      )
      .join("\n\n");

    if (!text) {
      showNotice(
        "Nothing to share yet",
      );
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            "Conversation",
          text,
        });
        return;
      }

      await navigator.clipboard.writeText(
        text,
      );

      showNotice(
        "Conversation copied",
      );
    } catch {
      // User cancelled sharing.
    }
  }

  function selectSuggestion(prompt) {
    setInput(prompt);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResizeTextarea();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Streaming                                                              */
  /* ---------------------------------------------------------------------- */

  function handleTextareaKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent?.isComposing
    ) {
      if (
        window.matchMedia?.(
          "(pointer: coarse)",
        ).matches
      ) {
        return;
      }

      event.preventDefault();

      if (!isStreaming) {
        sendMessage();
      }
    }
  }

  function stopGeneration() {
    const controller =
      abortControllerRef.current;

    if (!controller) return;

    controller.userStopped = true;
    controller.abort();
  }

  function regenerateLastResponse() {
    if (
      isStreaming ||
      !messages.length
    ) {
      return;
    }

    let lastUserIndex = -1;

    for (
      let index =
        messages.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (
        messages[index].role ===
        "user"
      ) {
        lastUserIndex = index;
        break;
      }
    }

    if (lastUserIndex < 0) return;

    const baseMessages =
      messages.slice(
        0,
        lastUserIndex + 1,
      );

    setMessages(baseMessages);

    sendMessage(undefined, {
      resendMessages:
        baseMessages,
    });
  }

  async function sendMessage(
    customPrompt,
    options = {},
  ) {
    if (
      sendingRef.current ||
      isStreaming
    ) {
      return;
    }

    if (chatLoadingRef.current) {
      showNotice(
        "Loading conversation…",
      );
      return;
    }

    const resend = Array.isArray(
      options.resendMessages,
    );

    const prompt = String(
      customPrompt !== undefined
        ? customPrompt
        : input,
    ).trim();

    if (
      !resend &&
      !prompt &&
      !selectedFile
    ) {
      textareaRef.current?.focus();
      return;
    }

    sendingRef.current = true;
    setError("");

    const chatId =
      activeChatId || createId();

    if (!activeChatId) {
      setActiveChatId(chatId);
    }

    let nextMessages;

    if (resend) {
      nextMessages =
        options.resendMessages;
    } else {
      const userMessage = {
        id: createId(),
        role: "user",
        content:
          prompt ||
          (selectedFile?.dataUrl
            ? "Describe this image and point out anything important."
            : "Please analyze the attached file."),
        createdAt: Date.now(),
        attachment: selectedFile
          ? {
              name:
                selectedFile.name,
              type:
                selectedFile.type,
              size:
                selectedFile.size,
              dataUrl:
                selectedFile.dataUrl,
              thumb:
                selectedFile.thumb ||
                null,
              text:
                selectedFile.text ||
                null,
            }
          : null,
      };

      nextMessages = [
        ...messages,
        userMessage,
      ];

      setInput("");
      setSelectedFile(null);
    }

    setMessages(nextMessages);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height =
          "48px";
      }
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

    setMessages((current) => [
      ...current,
      assistantMessage,
    ]);

    setIsStreaming(true);

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    let fullText = "";
    let sources = [];

    const updateAssistant = (
      patch,
    ) => {
      setMessages((current) =>
        current.map((message) =>
          message.id ===
          assistantId
            ? {
                ...message,
                ...patch,
              }
            : message,
        ),
      );
    };

    try {
      const apiMessages =
        buildApiMessages(
          nextMessages,
        );

      const body = {
        messages: apiMessages,
        conversationId: chatId,
        mode: hasImagePart(
          apiMessages,
        )
          ? "vision"
          : mode,
        research:
          settings.research,
        memory:
          settings.memory,
        responseStyle:
          settings.responseStyle,
        responseLength:
          settings.responseLength,
        customInstructions:
          settings.customInstructions,
      };

      const response = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
          signal:
            controller.signal,
        },
      );

      if (!response.ok) {
        let message =
          response.status === 401
            ? "Your session has expired. Please sign in again."
            : response.status === 413
              ? "The attachment is too large to send."
              : response.status === 429
                ? "Too many requests. Please wait a moment and try again."
                : "Something went wrong. Please try again.";

        try {
          const data =
            await response.json();

          if (data?.error) {
            message =
              data.error;
          }
        } catch {
          // ignore
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "The server returned an empty response.",
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      const handleEvent = (
        event,
      ) => {
        if (
          !event ||
          typeof event !==
            "object"
        ) {
          return;
        }

        if (
          event.type === "error" ||
          event.error
        ) {
          throw new Error(
            event.error ||
              "The AI service returned an error.",
          );
        }

        if (
          event.type ===
          "status"
        ) {
          updateAssistant({
            status:
              event.message ||
              null,
          });
          return;
        }

        if (
          event.type ===
            "notice" &&
          event.message
        ) {
          showNotice(
            event.message,
          );
          return;
        }

        if (
          event.type ===
            "sources" &&
          Array.isArray(
            event.sources,
          )
        ) {
          sources =
            event.sources;

          updateAssistant({
            sources,
          });

          return;
        }

        if (
          typeof event.content ===
            "string" &&
          event.content
        ) {
          fullText +=
            event.content;

          updateAssistant({
            content:
              fullText,
            streaming:
              true,
          });
        }
      };

      const processLine = (
        rawLine,
      ) => {
        const line =
          rawLine.trim();

        if (
          !line.startsWith(
            "data:",
          )
        ) {
          return;
        }

        const payload =
          line.slice(5).trim();

        if (
          !payload ||
          payload ===
            "[DONE]"
        ) {
          return;
        }

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          // Ignore malformed/incomplete JSON payloads.
          return;
        }

        // Stream events are trusted only after JSON parsing. Do not
        // swallow server/provider errors: handleEvent intentionally throws
        // so the outer request handler can surface the failure to the user.
        handleEvent(event);
      };

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          {
            stream: true,
          },
        );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        lines.forEach(
          processLine,
        );
      }

      buffer +=
        decoder.decode();

      if (buffer.trim()) {
        processLine(buffer);
      }

      const finalText =
        fullText ||
        "No response was returned.";

      updateAssistant({
        content: finalText,
        sources,
        streaming: false,
        status: null,
      });

      updateHistoryFromMessages(
        [
          ...nextMessages,
          {
            ...assistantMessage,
            content: finalText,
            sources,
            streaming: false,
          },
        ],
        chatId,
      );
    } catch (requestError) {
      if (
        requestError?.name ===
        "AbortError"
      ) {
        if (
          controller.userStopped
        ) {
          updateAssistant({
            content:
              fullText ||
              "Generation stopped.",
            sources,
            streaming: false,
          });

          if (fullText) {
            updateHistoryFromMessages(
              [
                ...nextMessages,
                {
                  ...assistantMessage,
                  content:
                    fullText,
                  sources,
                  streaming:
                    false,
                },
              ],
              chatId,
            );
          }
        }

        return;
      }

      const message =
        requestError?.message ||
        "Unable to connect to the AI service.";

      updateAssistant({
        streaming: false,
        content:
          fullText ||
          `I couldn't complete that request.\n\n${message}`,
      });
    } finally {
      sendingRef.current = false;

      if (
        abortControllerRef.current ===
        controller
      ) {
        abortControllerRef.current =
          null;

        setIsStreaming(false);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Account                                                                */
  /* ---------------------------------------------------------------------- */

  function openAccount() {
    setSidebarOpen(false);
    setAccountOpen(true);
  }

  function removeDeviceData() {
    try {
      localStorage.removeItem(
        historyKey,
      );
      localStorage.removeItem(
        settingsKey,
      );
      localStorage.removeItem(
        HISTORY_KEY,
      );
      localStorage.removeItem(
        SETTINGS_KEY,
      );
      localStorage.removeItem(
        THEME_KEY,
      );
    } catch {
      // ignore
    }
  }

  async function exportOzlindData() {
    try {
      const conversations =
        cloudEnabled
          ? await fetchEverything()
          : history;

      const payload = {
        exportedAt:
          new Date().toISOString(),
        product: "OZLIND",
        account:
          accountUser?.email ||
          null,
        history:
          conversations,
        settings,
        theme:
          isDark
            ? "dark"
            : "light",
      };

      const blob = new Blob(
        [
          JSON.stringify(
            payload,
            null,
            2,
          ),
        ],
        {
          type:
            "application/json",
        },
      );

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href = url;
      anchor.download =
        "ozlind-data-export.json";

      document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      showNotice(
        "OZLIND data exported",
      );
    } catch (exportError) {
      console.error(
        "OZLIND data export failed:",
        exportError,
      );

      showNotice(
        "Could not export your data",
      );
    }
  }

  async function clearAllData() {
    const target =
      cloudEnabled
        ? "this device and your OZLIND account"
        : "this device";

    if (
      !window.confirm(
        `Delete all conversations and preferences from ${target}? This cannot be undone.`,
      )
    ) {
      return;
    }

    abortControllerRef.current?.abort();

    openTokenRef.current += 1;

    setMessages([]);
    setHistory([]);
    setActiveChatId(null);
    setInput("");
    setSelectedFile(null);
    setError("");
    setIsStreaming(false);
    setSettings(
      DEFAULT_SETTINGS,
    );
    setIsDark(false);

    syncedRef.current.clear();

    removeDeviceData();

    if (cloudEnabled) {
      try {
        await deleteAllConversations(
          userId,
        );

        await deleteSettings(
          userId,
        );

        lastSettingsRef.current =
          null;
      } catch (deleteError) {
        console.error(
          "OZLIND delete failed:",
          deleteError,
        );

        showNotice(
          "Cleared on this device, but could not clear your account",
        );

        return;
      }
    }

    showNotice(
      "All OZLIND data deleted",
    );
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Permanently delete your OZLIND account and all of its data? This cannot be undone.",
      )
    ) {
      return;
    }

    const typed =
      window.prompt(
        "Type DELETE to confirm.",
      );

    if (typed !== "DELETE") {
      showNotice(
        "Account was not deleted",
      );
      return;
    }

    try {
      const response =
        await fetch(
          "/api/account/delete",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              confirm: "DELETE",
            }),
          },
        );

      if (!response.ok) {
        let message =
          "Could not delete your account. Please try again.";

        try {
          const data =
            await response.json();

          if (data?.error) {
            message =
              data.error;
          }
        } catch {
          // ignore
        }

        showNotice(message);
        return;
      }
    } catch {
      showNotice(
        "Could not delete your account. Please try again.",
      );
      return;
    }

    removeDeviceData();

    try {
      const supabase =
        await createClient();

      await supabase.auth.signOut();
    } catch {
      // Account may already be deleted.
    }

    window.location.assign(
      "/login",
    );
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    if (
      cloudEnabled &&
      !historyRef.current.some(
        (item) => item.pending,
      )
    ) {
      try {
        localStorage.removeItem(
          historyKey,
        );
      } catch {
        // ignore
      }
    }

    try {
      const supabase =
        await createClient();

      await supabase.auth.signOut();
    } catch (logoutError) {
      console.error(
        "Sign out failed:",
        logoutError,
      );
    }

    window.location.assign(
      "/login",
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  const hasMessages =
    messages.length > 0;

  return (
    <div className="ozlind-app">
      {sidebarOpen && (
        <button type="button"
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
          <button type="button"
            className="brand-button"
            onClick={startNewChat}
            aria-label="OZLIND home"
          >
            <span className="brand-mark">
              <svg
                viewBox="0 0 96 96"
                aria-hidden="true"
              >
                <use href="/ozlind-icons.svg#ozl-mark" />
              </svg>
            </span>

            <span className="brand-copy">
              <strong>
                OZLIND
              </strong>
              <span>
                Workspace
              </span>
            </span>
          </button>

          <button type="button"
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
          <button type="button"
            className="new-chat-button"
            onClick={startNewChat}
          >
            <PenLine size={17} />
            <span>
              New chat
            </span>
          </button>

          <nav className="sidebar-nav">
            <button type="button"
              className="sidebar-nav-item active"
              onClick={
                startNewChat
              }
            >
              <MessageSquare
                size={17}
              />
              <span>
                AI Chat
              </span>
            </button>

            <button type="button"
              className={`sidebar-nav-item ${
                settings.research
                  ? "active"
                  : ""
              }`}
              aria-pressed={settings.research}
              onClick={() => {
                const next =
                  !settings.research;

                updateSettings({
                  research: next,
                });

                showNotice(
                  next
                    ? "Research enabled"
                    : "Research disabled",
                );
              }}
            >
              <Search size={17} />
              <span>
                Web Research
              </span>
            </button>
          </nav>

          <div className="sidebar-section history-section">
            <div className="sidebar-section-heading">
              <span>
                History
              </span>

              {history.length > 0 && (
                <button type="button"
                  className="text-button"
                  onClick={
                    clearHistory
                  }
                >
                  Clear
                </button>
              )}
            </div>

            {history.length > 0 && (
              <div className="history-search">
                <Search size={14} />

                <input
                  value={
                    historySearch
                  }
                  onChange={(event) =>
                    setHistorySearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search chats and messages"
                  aria-label="Search chats and messages"
                  aria-busy={historySearchLoading}
                />
              </div>
            )}

            <div className="history-list">
              {filteredHistory.length ===
              0 ? (
                <div className="history-empty">
                  <span>
                    {historySearch.trim()
                      ? historySearchLoading
                        ? "Searching…"
                        : "No matching conversations."
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
                      <button type="button"
                        className="history-item-main"
                        onClick={() =>
                          openHistoryItem(
                            item,
                          )
                        }
                      >
                        <MessageSquare
                          size={14}
                        />
                        <span>
                          {item.title}
                        </span>
                      </button>

                      <button type="button"
                        className="history-delete"
                        onClick={() =>
                          deleteHistoryItem(
                            item.id,
                          )
                        }
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2
                          size={14}
                        />
                      </button>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button type="button"
            className="sidebar-nav-item"
            onClick={() =>
              setSettingsOpen(true)
            }
          >
            <Settings2
              size={17}
            />
            <span>
              Settings
            </span>
          </button>

          <button
            type="button"
            className="profile-card"
            onClick={
              openAccount
            }
          >
            <div className="profile-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                />
              ) : (
                <span>
                  {userInitials}
                </span>
              )}
            </div>

            <div className="profile-info">
              <strong>
                {userName}
              </strong>
              <span>
                {userEmail}
              </span>
            </div>

            <ChevronRight size={16} />
          </button>
        </div>
      </aside>

      <main className="ozlind-main">
        <header className="ozlind-topbar">
          <div className="topbar-left">
            <button type="button"
              className="icon-button mobile-menu-button"
              onClick={() =>
                setSidebarOpen(
                  true,
                )
              }
              aria-label="Open sidebar"
            >
              <Menu size={19} />
            </button>

            <div className="mobile-brand">
              <strong>
                OZLIND
              </strong>
              <span>
                AI
              </span>
            </div>
          </div>

          <div className="topbar-title" aria-live="polite">
            <strong>{
              history.find((item) => item.id === activeChatId)?.title ||
              "New conversation"
            }</strong>
            <span>OZLIND AI</span>
          </div>

          <div className="topbar-actions">
            <button type="button"
              className="icon-button"
              onClick={() =>
                setIsDark(
                  (current) =>
                    !current,
                )
              }
              aria-label={
                isDark
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {isDark ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            <button type="button"
              className="icon-button"
              onClick={
                shareConversation
              }
              aria-label="Share conversation"
            >
              <Share2 size={18} />
            </button>

            <button type="button"
              className="clear-chat-button"
              onClick={clearCurrentChat}
              aria-label="Delete current conversation"
            >
              <Trash2 size={16} />
              <span>
                Clear chat
              </span>
            </button>
          </div>
        </header>

        <div
          className="pull-refresh-indicator"
          style={{
            transform: `translate(-50%, ${Math.min(
              96,
              pullRefreshDistance,
            ) - 52}px)`,
            opacity: pullRefreshDistance > 4 ? 1 : 0,
          }}
          aria-hidden="true"
        >
          <span
            className={
              pullRefreshDistance >= 76
                ? "pull-refresh-icon ready"
                : "pull-refresh-icon"
            }
          >
            ↻
          </span>
          <span>
            {pullRefreshDistance >= 76
              ? "Release to refresh"
              : "Pull to refresh"}
          </span>
        </div>

        <section className="workspace">
          {!hasMessages ? (
            <div className="welcome-screen">
              <div className="welcome-badge">
                <Sparkles
                  size={15}
                />
                <span>Assistant</span>
              </div>

              <h1>
                What are you working on today?
              </h1>

              <p>
                Chat, research, analyze files and images, and turn ideas into clear next steps.
              </p>

              <div className="suggestion-grid">
                {SUGGESTIONS.map(
                  (suggestion) => {
                    const Icon =
                      suggestion.icon;

                    return (
                      <button type="button"
                        className="suggestion-card"
                        key={
                          suggestion.title
                        }
                        onClick={() =>
                          selectSuggestion(
                            suggestion.prompt,
                          )
                        }
                      >
                        <span className="suggestion-icon">
                          <Icon size={18} />
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
                  },
                )}
              </div>
            </div>
          ) : (
            <div className="chat-area">
              <div className="messages-list">
                {messages.map(
                  (
                    message,
                    index,
                  ) => {
                    const isUser =
                      message.role ===
                      "user";

                    const content =
                      getMessageText(
                        message,
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
                                : "Assistant"}
                            </span>
                          </div>

                          <div className="message-bubble">
                            {message.attachment && (
                              <div className="message-attachment">
                                {(
                                  message
                                    .attachment
                                    .dataUrl ||
                                  message
                                    .attachment
                                    .thumb
                                ) &&
                                message
                                  .attachment
                                  .type?.startsWith(
                                    "image/",
                                  ) ? (
                                  <img
                                    src={
                                      message
                                        .attachment
                                        .dataUrl ||
                                      message
                                        .attachment
                                        .thumb
                                    }
                                    alt={
                                      message
                                        .attachment
                                        .name
                                    }
                                  />
                                ) : (
                                  <div className="attachment-file">
                                    <FileText
                                      size={
                                        16
                                      }
                                    />
                                    <span>
                                      {
                                        message
                                          .attachment
                                          .name
                                      }
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {content ? (
                              isUser ? (
                                <p>
                                  {content}
                                </p>
                              ) : (
                                <div className="markdown-content">
                                  <MarkdownRenderer
                                    content={
                                      content
                                    }
                                    sources={
                                      message.sources
                                    }
                                  />
                                </div>
                              )
                            ) : message.streaming ? (
                              <div className="streaming-indicator">
                                <span />
                                <span />
                                <span />

                                {message.status ? (
                                  <em
                                    style={{
                                      fontStyle:
                                        "normal",
                                      marginLeft:
                                        10,
                                      fontSize:
                                        13,
                                      opacity:
                                        0.7,
                                    }}
                                  >
                                    {
                                      message.status
                                    }
                                  </em>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {!isUser &&
                            !message.streaming &&
                            Array.isArray(
                              message.sources,
                            ) &&
                            message.sources.length >
                              0 && (
                              <div className="message-sources">
                                <span className="message-sources-title">
                                  Sources
                                </span>

                                <div className="message-sources-list">
                                  {message.sources.map(
                                    (
                                      source,
                                      sourceIndex,
                                    ) => (
                                      <a
                                        key={`${source.url || source.domain || "src"}-${sourceIndex}`}
                                        className="source-chip"
                                        href={
                                          source.url
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <span className="source-index">
                                          {sourceIndex +
                                            1}
                                        </span>

                                        <span className="source-text">
                                          <strong>
                                            {source.title ||
                                              source.domain}
                                          </strong>
                                          <em>
                                            {
                                              source.domain
                                            }
                                          </em>
                                        </span>
                                      </a>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          <div className="message-actions">
                            <button type="button"
                              onClick={() =>
                                copyMessage(
                                  content,
                                  index,
                                )
                              }
                              aria-label="Copy message"
                            >
                              {copiedMessage ===
                              index ? (
                                <Check
                                  size={
                                    14
                                  }
                                />
                              ) : (
                                <Copy
                                  size={
                                    14
                                  }
                                />
                              )}
                            </button>

                            {isUser && (
                              <button type="button"
                                onClick={() =>
                                  editMessage(
                                    message,
                                  )
                                }
                                aria-label="Edit message"
                              >
                                <PenLine
                                  size={
                                    14
                                  }
                                />
                              </button>
                            )}

                            {!isUser &&
                              index ===
                                messages.length -
                                  1 &&
                              !isStreaming && (
                                <button type="button"
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
                  },
                )}

                <div
                  ref={bottomRef}
                />
              </div>
            </div>
          )}

          {error && (
            <div
              className="error-banner"
              role="alert"
            >
              <span>
                {error}
              </span>

              <button type="button"
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
                  {selectedFile.dataUrl &&
                  selectedFile.type?.startsWith(
                    "image/",
                  ) ? (
                    <img
                      src={
                        selectedFile.dataUrl
                      }
                      alt={
                        selectedFile.name
                      }
                    />
                  ) : (
                    <FileText
                      size={18}
                    />
                  )}

                  <div>
                    <strong>
                      {
                        selectedFile.name
                      }
                    </strong>

                    <span>
                      {formatFileSize(
                        selectedFile.size,
                      )}
                    </span>
                  </div>
                </div>

                <button type="button"
                  className="icon-button"
                  onClick={() =>
                    setSelectedFile(
                      null,
                    )
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
                  <button type="button"
                    className="composer-icon-button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    aria-label="Attach file"
                  >
                    <Paperclip
                      size={19}
                    />
                  </button>

                  <button
                    type="button"
                    className={`composer-icon-button voice-input-button ${
                      isListening ? "recording" : ""
                    }`}
                    onClick={toggleVoiceInput}
                    aria-label={
                      isListening
                        ? "Stop voice input"
                        : "Start voice input"
                    }
                    aria-pressed={isListening}
                  >
                    <Mic size={19} />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={
                      handleFileChange
                    }
                    accept={
                      ATTACHMENT_ACCEPT
                    }
                  />

                  <div
                    className="mode-selector"
                    ref={modeRef}
                  >
                    <button type="button"
                      className="mode-button"
                      onClick={() =>
                        setModeOpen(
                          (current) =>
                            !current,
                        )
                      }
                      aria-expanded={
                        modeOpen
                      }
                      aria-haspopup="menu"
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
                              <button type="button"
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
                                    item.id,
                                  );
                                  setModeOpen(
                                    false,
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
                          },
                        )}
                      </div>
                    )}
                  </div>

                  <button type="button"
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
                    <button type="button"
                      className="send-button stop"
                      onClick={
                        stopGeneration
                      }
                      aria-label="Stop generation"
                    >
                      <span className="stop-square" />
                    </button>
                  ) : (
                    <button type="button"
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
                placeholder="Message…"
                rows={1}
                aria-label="Message assistant"
              />

              <div className="composer-footer">
                <span>
                  OZLIND can make mistakes.
                  Verify important
                  information.
                </span>

                <span className="keyboard-hint">
                  <kbd>Enter</kbd> send{" "}
                  <kbd>Shift</kbd>+
                  <kbd>Enter</kbd> new line
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Account                                                             */}
      {/* ------------------------------------------------------------------ */}

      {accountOpen && (
        <div className="account-overlay">
          <section
            className="account-page"
            role="dialog"
            aria-modal="true"
            aria-label="OZLIND account"
          >
            <header className="account-page-header">
              <button
                type="button"
                className="account-back-button"
                onClick={() =>
                  setAccountOpen(
                    false,
                  )
                }
                aria-label="Back to OZLIND"
              >
                <span className="account-back-arrow">
                  ‹
                </span>
              </button>

              <div className="account-header-title">
                <strong>
                  Account
                </strong>
                <span>
                  OZLIND
                </span>
              </div>

              <div
                className="account-header-spacer"
                aria-hidden="true"
              />
            </header>

            <div className="account-scroll">
              <section className="account-profile-hero">
                <div className="account-hero-avatar">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                    />
                  ) : (
                    <span>
                      {userInitials}
                    </span>
                  )}
                </div>

                <strong>
                  {userName}
                </strong>

                <span>
                  {userEmail}
                </span>

                <div className="account-provider-badge">
                  <span className="account-provider-dot" />
                  OZLIND account
                </div>
              </section>

              <AccountGroup title="OZLIND">
                <AccountRow
                  icon={UserRound}
                  title="Profile"
                  subtitle="Account information"
                  onClick={() =>
                    showNotice(
                      `${userName} · ${userEmail}`,
                    )
                  }
                />

                <AccountRow
                  icon={BrainCircuit}
                  title="Conversation context"
                  subtitle={
                    settings.memory
                      ? "On"
                      : "Off"
                  }
                  trailing={
                    <Switch
                      checked={
                        settings.memory
                      }
                    />
                  }
                  onClick={() =>
                    updateSettings({
                      memory:
                        !settings.memory,
                    })
                  }
                />

                <AccountRow
                  icon={Search}
                  title="Web Research"
                  subtitle={
                    settings.research
                      ? "Enabled"
                      : "Disabled"
                  }
                  trailing={
                    <Switch
                      checked={
                        settings.research
                      }
                    />
                  }
                  onClick={() =>
                    updateSettings({
                      research:
                        !settings.research,
                    })
                  }
                />

                <AccountRow
                  icon={Palette}
                  title="Appearance"
                  subtitle={
                    isDark
                      ? "Dark mode"
                      : "Light mode"
                  }
                  trailing={
                    <Switch
                      checked={isDark}
                    />
                  }
                  onClick={() =>
                    setIsDark(
                      (current) =>
                        !current,
                    )
                  }
                />

                <AccountRow
                  icon={Zap}
                  title="Usage"
                  subtitle={`${history.length} saved conversations`}
                  onClick={() =>
                    showNotice(
                      `${history.length} saved conversations · ${messages.length} current messages`,
                    )
                  }
                />
              </AccountGroup>

              <AccountGroup title="Privacy & data">
                <AccountRow
                  icon={Shield}
                  title="Privacy"
                  subtitle={
                    cloudEnabled
                      ? "Saved to your account"
                      : "Stored on this device"
                  }
                  onClick={() =>
                    showNotice(
                      "Your conversation data follows the current OZLIND storage configuration.",
                    )
                  }
                />

                <AccountRow
                  icon={Database}
                  title="Export data"
                  subtitle="Download your OZLIND data"
                  onClick={
                    exportOzlindData
                  }
                />
              </AccountGroup>

              <AccountGroup title="Account">
                <AccountRow
                  icon={LockKeyhole}
                  title="Authentication"
                  subtitle="Manage your active session"
                  onClick={() =>
                    showNotice(
                      "Your OZLIND session is active.",
                    )
                  }
                />
              </AccountGroup>

              <button
                type="button"
                className="account-primary-action"
                onClick={() => {
                  setAccountOpen(
                    false,
                  );
                  setSettingsOpen(
                    true,
                  );
                }}
              >
                <Settings2
                  size={17}
                />
                Open settings
              </button>

              <button
                type="button"
                className="account-danger-action"
                onClick={
                  clearAllData
                }
              >
                <Trash2 size={17} />
                Delete all my data
              </button>

              <button
                type="button"
                className="account-danger-action"
                onClick={
                  deleteAccount
                }
              >
                <Trash2 size={17} />
                Delete my account
              </button>

              <button
                type="button"
                className="account-logout-button"
                onClick={
                  handleLogout
                }
                disabled={
                  loggingOut
                }
              >
                <LogOut size={20} />
                <span>
                  {loggingOut
                    ? "Signing out…"
                    : "Log out"}
                </span>
              </button>

              <p className="account-version">
                OZLIND · AI workspace
              </p>
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Settings                                                            */}
      {/* ------------------------------------------------------------------ */}

      {settingsOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSettingsOpen(
                false,
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
                <h2>
                  Settings
                </h2>
              </div>

              <button type="button"
                className="icon-button"
                onClick={() =>
                  setSettingsOpen(
                    false,
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
                      AI mode
                    </strong>
                    <span>
                      Choose how OZLIND balances
                      speed, depth and visual input.
                    </span>
                  </div>

                  <select
                    value={mode}
                    onChange={(event) =>
                      setMode(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="auto">
                      Auto
                    </option>
                    <option value="fast">
                      Fast
                    </option>
                    <option value="vision">
                      Vision
                    </option>
                    <option value="pro">
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

                  <button type="button"
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
                      Conversation context
                    </strong>
                    <span>
                      Use earlier messages
                      from this chat when responding.
                    </span>
                  </div>

                  <button type="button"
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
                    Adjust answer length
                    and style.
                  </span>
                </div>

                <div className="segmented-control">
                  {[
                    [
                      "short",
                      "Concise",
                    ],
                    [
                      "medium",
                      "Balanced",
                    ],
                    [
                      "long",
                      "Detailed",
                    ],
                  ].map(
                    ([
                      value,
                      label,
                    ]) => (
                      <button type="button"
                        key={
                          value
                        }
                        className={
                          settings.responseLength ===
                          value
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          updateSettings(
                            {
                              responseLength:
                                value,
                            },
                          )
                        }
                      >
                        {label}
                      </button>
                    ),
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
                    [
                      "direct",
                      "Direct",
                    ],
                  ].map(
                    ([
                      value,
                      label,
                    ]) => (
                      <button type="button"
                        key={
                          value
                        }
                        className={
                          settings.responseStyle ===
                          value
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          updateSettings(
                            {
                              responseStyle:
                                value,
                            },
                          )
                        }
                      >
                        {label}
                      </button>
                    ),
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
            </div>

            <div className="dialog-footer">
              <button type="button"
                className="secondary-button"
                onClick={() => {
                  setSettings(
                    DEFAULT_SETTINGS,
                  );
                  showNotice(
                    "Settings reset",
                  );
                }}
              >
                Reset
              </button>

              <button type="button"
                className="primary-button"
                onClick={() => {
                  setSettingsOpen(
                    false,
                  );
                  showNotice(
                    "Settings saved",
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

          <span>
            {notice}
          </span>
        </div>
      )}
    </div>
  );
}