"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildApiMessages,
  createTitle,
  makeThumbnail,
  normalizeSettings,
  optimizeImage,
  readTextFile,
} from "@/lib/chat/utils";
import {
  deleteConversation,
  fetchMessages,
  saveConversation,
  saveSettings,
  newId as localId,
} from "@/lib/cloud";
import { DEFAULT_SETTINGS } from "@/constants/settings";

function sanitizeForPersistence(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (!message?.attachment) return message;
    const { dataUrl, thumb, ...attachment } = message.attachment;
    return { ...message, attachment };
  });
}

function parseEvent(block) {
  let event = "message";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }

  if (!data) return null;

  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

export function useOzlindChat({
  initialUser,
  initialHistory,
  initialSettings,
}) {
  const userId = initialUser?.id || null;
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState(
    Array.isArray(initialHistory) ? initialHistory : [],
  );
  const [settings, setSettings] = useState(() =>
    normalizeSettings(initialSettings || DEFAULT_SETTINGS),
  );
  const [activeChatId, setActiveChatId] = useState(null);
  const [mode, setMode] = useState("auto");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sources, setSources] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const abortRef = useRef(null);
  const syncRef = useRef(new Set());
  const settingsTimerRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const persist = useCallback(
    async (chatId, nextMessages, title) => {
      if (!userId || !chatId) return;
      try {
        const known = syncRef.current;
        const ids = await saveConversation({
          userId,
          conversationId: chatId,
          title: title || createTitle(nextMessages.find((m) => m.role === "user")?.content),
          updatedAt: Date.now(),
          messages: sanitizeForPersistence(nextMessages),
          synced: known,
        });
        syncRef.current = new Set(ids);
        setHistory((items) => {
          const next = {
            id: chatId,
            title: title || createTitle(nextMessages.find((m) => m.role === "user")?.content),
            updatedAt: Date.now(),
          };
          const rest = items.filter((item) => item.id !== chatId);
          return [next, ...rest];
        });
      } catch (saveError) {
        console.error("OZLIND conversation sync failed:", saveError);
      }
    },
    [userId],
  );

  const updateSettings = useCallback((patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (!userId) return;
    window.clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = window.setTimeout(() => {
      saveSettings(userId, settings).catch((saveError) =>
        console.error("OZLIND settings sync failed:", saveError),
      );
    }, 500);
    return () => window.clearTimeout(settingsTimerRef.current);
  }, [settings, userId]);

  const openConversation = useCallback(async (id) => {
    if (!id) return;
    setError("");
    setStatus("Loading conversation…");
    try {
      const loaded = await fetchMessages(id);
      setActiveChatId(id);
      setMessages(loaded);
      setSources([]);
    } catch (loadError) {
      setError(loadError?.message || "Could not load this conversation.");
    } finally {
      setStatus("");
    }
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    syncRef.current = new Set();
    setActiveChatId(null);
    setMessages([]);
    setSources([]);
    setError("");
    setStatus("");
  }, []);

  const removeConversation = useCallback(
    async (id) => {
      try {
        await deleteConversation(id);
        if (id === activeChatId) startNewChat();
        setHistory((items) => items.filter((item) => item.id !== id));
      } catch (deleteError) {
        setError(deleteError?.message || "Could not delete the conversation.");
      }
    },
    [activeChatId, startNewChat],
  );

  const send = useCallback(
    async (value) => {
      const text = String(value || "").trim();
      if ((!text && !selectedFile) || streaming) return;

      setError("");
      setStatus("Preparing…");

      const chatId = activeChatId || localId();
      const userMessage = {
        id: localId(),
        role: "user",
        content: text || "Please analyse the attached file.",
        createdAt: Date.now(),
        attachment: selectedFile || null,
      };
      const assistantId = localId();
      const baseMessages = [...messages, userMessage];
      setActiveChatId(chatId);
      setMessages([...baseMessages, {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      }]);
      setSelectedFile(null);
      setStreaming(true);
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const apiMessages = buildApiMessages(baseMessages);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            mode,
            research: settings.research,
            memory: settings.memory,
            responseStyle: settings.responseStyle,
            responseLength: settings.responseLength,
            customInstructions: settings.customInstructions,
            conversationId: chatId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "OZLIND could not process that request.");
        }

        if (!response.body) {
          throw new Error("Streaming response unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalText = "";
        let streamSources = [];
        let done = false;

        const applyEvent = (raw) => {
          const parsed = parseEvent(raw);
          if (!parsed) return;

          const { event, data } = parsed;

          if (event === "status") {
            setStatus(data?.message || "");
          } else if (event === "notice") {
            setStatus(data?.message || "");
          } else if (event === "sources") {
            streamSources = Array.isArray(data?.sources) ? data.sources : [];
            setSources(streamSources);
          } else if (event === "delta") {
            const delta = typeof data?.content === "string" ? data.content : "";
            if (!delta) return;
            finalText += delta;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: finalText }
                  : message,
              ),
            );
          } else if (event === "error") {
            throw new Error(data?.error || "OZLIND response failed.");
          } else if (event === "done") {
            done = true;
          }
        };

        while (!done) {
          const { value: chunk, done: streamDone } = await reader.read();
          buffer += decoder.decode(chunk || new Uint8Array(), { stream: !streamDone });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          for (const block of blocks) {
            applyEvent(block);
          }
          if (streamDone) break;
        }

        if (buffer.trim()) applyEvent(buffer);

        if (!finalText.trim()) {
          throw new Error("The AI returned an empty response.");
        }

        const nextMessages = [
          ...baseMessages,
          {
            id: assistantId,
            role: "assistant",
            content: finalText,
            createdAt: Date.now(),
            sources: streamSources,
          },
        ];

        setMessages(nextMessages);
        await persist(chatId, nextMessages);
        setStatus("");
      } catch (sendError) {
        if (sendError?.name === "AbortError") {
          setStatus("");
        } else {
          setError(sendError?.message || "OZLIND could not complete that request.");
          setMessages((current) =>
            current.filter((message) => message.id !== assistantId || message.content),
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      activeChatId,
      messages,
      mode,
      persist,
      selectedFile,
      settings,
      sources,
      streaming,
    ],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus("");
  }, []);

  const attachFile = useCallback(async (file) => {
    if (!file) return;
    const maxImage = 6 * 1024 * 1024;
    const maxText = 4 * 1024 * 1024;

    if (file.size > (file.type.startsWith("image/") ? maxImage : maxText)) {
      throw new Error("That file is too large.");
    }

    if (file.type.startsWith("image/")) {
      const dataUrl = await optimizeImage(file);
      const thumb = await makeThumbnail(dataUrl);
      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        thumb,
      });
      return;
    }

    const text = await readTextFile(file);
    setSelectedFile({
      name: file.name,
      type: file.type || "text/plain",
      size: file.size,
      text,
    });
  }, []);

  return {
    activeChatId,
    attachFile,
    error,
    history,
    messages,
    mode,
    openConversation,
    persist,
    removeConversation,
    selectedFile,
    send,
    setMode,
    setSelectedFile,
    settings,
    startNewChat,
    status,
    stop,
    streaming,
    updateSettings,
    sources,
  };
}
