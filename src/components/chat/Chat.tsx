"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { OfflineBanner } from "@/components/chat/OfflineBanner";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { usePreferences } from "@/hooks/usePreferences";
import { OzlindIcon } from "@/components/ui/OzlindIcon";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  created_at?: string;
  images?: ChatImage[];
};

type ChatMode = "auto" | "fast" | "vision" | "pro";
type ChatImage = { dataUrl: string; mimeType: "image/jpeg"; name: string };

function messageDayLabel(timestamp?: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((today - day) / 86_400_000);
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const toBlob = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not prepare this image.")), "image/jpeg", quality);
    });
    let blob = await toBlob(0.82);
    if (blob.size > 1_400_000) blob = await toBlob(0.66);
    if (blob.size > 1_500_000) throw new Error("Image is too large after compression. Choose a smaller image.");

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image."));
      reader.onerror = () => reject(new Error("Could not read this image."));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
  }
}

export function Chat({ conversationId: initialId }: { conversationId?: string }) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const { preferences } = usePreferences();
  const [model, setModel] = useState<string>(preferences.default_model);
  const [mode, setMode] = useState<ChatMode>(() =>
    preferences.default_model === "groq:deepseek-r1-distill-llama-70b" ? "pro" :
    preferences.default_model === "google:gemini-2.0-flash" ? "vision" : "auto"
  );
  const [researchEnabled, setResearchEnabled] = useState(preferences.research_enabled);
  const [showModeOptions, setShowModeOptions] = useState(false);
  const [images, setImages] = useState<ChatImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [conversationTitle, setConversationTitle] = useState("New chat");
  const [mobileKeyboard, setMobileKeyboard] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speechPaused, setSpeechPaused] = useState(false);
  const draftKeyRef = useRef("");
  const skipNextDraftSave = useRef(false);
  const [online, setOnline] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => new Set());
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setId(initialId), [initialId]);

  useEffect(() => {
    const key = "ozlind:draft:" + (id ?? "new");
    draftKeyRef.current = key;
    let savedDraft = "";
    try {
      savedDraft = sessionStorage.getItem(key) ?? "";
    } catch {
      // Draft recovery is best-effort when storage is blocked.
    }
    skipNextDraftSave.current = true;
    setDraft(savedDraft);
  }, [id]);

  useEffect(() => {
    const key = draftKeyRef.current;
    if (!key) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    try {
      if (draft) sessionStorage.setItem(key, draft);
      else sessionStorage.removeItem(key);
    } catch {
      // Sending still works if private browsing disables session storage.
    }
  }, [draft, id]);

  useEffect(() => {
    const updateKeyboardMode = () => {
      setMobileKeyboard(
        window.matchMedia("(max-width: 768px)").matches ||
        window.matchMedia("(pointer: coarse)").matches
      );
    };
    updateKeyboardMode();
    window.addEventListener("resize", updateKeyboardMode);
    return () => window.removeEventListener("resize", updateKeyboardMode);
  }, []);

  useEffect(() => {
    if (!id) {
      setConversationTitle("New chat");
      return;
    }

    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: titleError } = await supabase
          .from("conversations")
          .select("title")
          .eq("id", id)
          .maybeSingle();
        if (live && !titleError) setConversationTitle(data?.title || "New chat");
      } catch {
        // The title is a convenience; keep the chat usable if it cannot be fetched.
      }
    })();

    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = conversationTitle === "New chat" ? "New chat | Ozlind" : conversationTitle + " | Ozlind";
    return () => { document.title = previousTitle; };
  }, [conversationTitle]);

  // Keep the chat inside the visible viewport when a mobile software keyboard opens.
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const updateViewportHeight = () => {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty("--chat-viewport-height", Math.round(height) + "px");
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    viewport?.addEventListener("resize", updateViewportHeight);
    viewport?.addEventListener("scroll", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      viewport?.removeEventListener("resize", updateViewportHeight);
      viewport?.removeEventListener("scroll", updateViewportHeight);
      root.style.removeProperty("--chat-viewport-height");
    };
  }, []);
  useEffect(() => {
    setModel(preferences.default_model);
    setMode(preferences.default_model === "groq:deepseek-r1-distill-llama-70b" ? "pro" :
      preferences.default_model === "google:gemini-2.0-flash" ? "vision" : "auto");
  }, [preferences.default_model]);
  useEffect(() => setResearchEnabled(preferences.research_enabled), [preferences.research_enabled]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail;
      setDraft(prompt.slice(0, 20000));
      textareaRef.current?.focus();
    };
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    addEventListener("ozlind:prompt", onPrompt);
    addEventListener("online", syncOnline);
    addEventListener("offline", syncOnline);
    return () => {
      removeEventListener("ozlind:prompt", onPrompt);
      removeEventListener("online", syncOnline);
      removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setMessages([]);
      setHistoryLoading(false);
      setHistoryError("");
      return;
    }
    // Avoid replacing optimistic/streaming messages with a stale history response.
    if (streaming) return;

    let live = true;
    setHistoryLoading(true);
    setHistoryError("");

    (async () => {
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("messages")
          .select("id,role,content,status,created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        if (!live) return;
        if (queryError) {
          setHistoryError("Your conversation history could not be loaded.");
          return;
        }
        setMessages(current => (data ?? []).map((row) => {
          const message = row as Message;
          const matchingImageMessage = [...current].reverse().find(existing =>
            existing.role === "user" &&
            message.role === "user" &&
            existing.content === message.content &&
            Boolean(existing.images?.length)
          );
          return matchingImageMessage ? { ...message, images: matchingImageMessage.images } : message;
        }));
      } catch {
        if (live) setHistoryError("Your conversation history could not be loaded.");
      } finally {
        if (live) setHistoryLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [id, historyAttempt, streaming]);

  useEffect(() => {
    if (stick.current && preferences.auto_scroll) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: streaming ? "auto" : "smooth",
      });
    }
  }, [messages, streaming, preferences.auto_scroll]);

  useEffect(() => {
    if (historyLoading) return;
    const element = scrollRef.current;
    if (!element) return;
    let savedPosition = "";
    try {
      savedPosition = sessionStorage.getItem("ozlind:scroll:" + (id ?? "new")) ?? "";
    } catch {
      return;
    }
    if (!savedPosition) return;

    const frame = requestAnimationFrame(() => {
      element.scrollTop = Math.max(0, Math.min(Number(savedPosition) || 0, element.scrollHeight));
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
      stick.current = atBottom;
      setShowScrollToBottom(!atBottom);
    });
    return () => cancelAnimationFrame(frame);
  }, [id, historyLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [draft]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  async function send(action: "send" | "regenerate" = "send", contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    const outgoingImages = action === "send" ? images : [];
    const outgoingContent = content || (outgoingImages.length ? "Please analyze the attached image." : "");
    if ((action === "send" && !outgoingContent) || streaming || !online) return;

    if (action === "send") {
      setDraft("");
      setImages([]);
    }
    setError("");
    const key = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    if (action === "send") {
      setMessages((current) => current.concat({
        id: key,
        role: "user",
        content: outgoingContent,
        status: "complete",
        created_at: new Date().toISOString(),
        images: outgoingImages,
      }));
    }
    setMessages((current) => current.concat({
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
      created_at: new Date().toISOString(),
    }));
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fastModel = "groq:llama-3.3-70b-versatile";
      const proModel = "groq:deepseek-r1-distill-llama-70b";
      const visionModel = "google:gemini-2.0-flash";
      const requestedModel = outgoingImages.length || mode === "vision"
        ? visionModel
        : mode === "fast"
          ? fastModel
          : mode === "pro"
            ? proModel
            : ([fastModel, proModel, visionModel].includes(model) ? model : fastModel);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: id,
          content: outgoingContent,
          model: requestedModel,
          action,
          idempotencyKey: key,
          research: researchEnabled,
          images: outgoingImages.map(({ dataUrl, mimeType }) => ({ dataUrl, mimeType })),
        }),
        signal: controller.signal,
      });

      if (response.status === 204) {
        const duplicateConversationId = response.headers.get("X-OZLIND-Conversation-ID");
        setMessages((current) => current.filter((message) => message.id !== key && message.id !== assistantId));
        if (duplicateConversationId) {
          setId(duplicateConversationId);
          router.replace("/app/" + duplicateConversationId);
        }
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.error?.code === "AUTH_REQUIRED") router.replace("/login");
        throw new Error(body?.error?.message || "Ozlind could not generate a response.");
      }

      const nextId = response.headers.get("X-OZLIND-Conversation-ID");
      if (!id && nextId) {
        setId(nextId);
        router.replace("/app/" + nextId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming response unavailable.");

      const decoder = new TextDecoder();
      let pendingText = "";
      let lastUiFlush = 0;
      const flushVisibleText = (force = false) => {
        if (!pendingText || (!force && Date.now() - lastUiFlush < 48)) return;
        const chunk = pendingText;
        pendingText = "";
        lastUiFlush = Date.now();
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk, status: "streaming" }
              : message,
          ),
        );
      };

      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        pendingText += decoder.decode(part.value, { stream: true });
        flushVisibleText();
      }

      pendingText += decoder.decode();
      flushVisibleText(true);
      setMessages((current) =>
        current.map((message) => (message.id === assistantId ? { ...message, status: "complete" } : message)),
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? { ...message, status: "interrupted" } : message)),
        );
      } else {
        setError(caught instanceof Error ? caught.message : "Generation failed.");
        // Keep a failed prompt recoverable without overwriting text the user typed meanwhile.
        if (action === "send") {
          setDraft((current) => (current.trim() ? current : outgoingContent));
          setImages((current) => current.length ? current : outgoingImages);
        }
        setMessages((current) =>
          current.filter((message) => message.id !== assistantId || Boolean(message.content)),
        );
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const remaining = Math.max(0, 2 - images.length);
    if (!remaining) {
      setError("You can attach up to 2 images per message.");
      return;
    }
    const selected = Array.from(files).filter(file => file.type.startsWith("image/")).slice(0, remaining);
    if (!selected.length) {
      setError("Choose an image file to use Vision mode.");
      return;
    }
    setError("");
    try {
      const prepared = await Promise.all(selected.map(async file => ({
        dataUrl: await compressImage(file),
        mimeType: "image/jpeg" as const,
        name: file.name.slice(0, 120),
      })));
      setImages(current => [...current, ...prepared].slice(0, 2));
      setMode("vision");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not attach this image.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Do not submit while an IME (for example, Malayalam input) is composing text.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && preferences.enter_to_send && !mobileKeyboard) {
      event.preventDefault();
      void send();
    }
  };

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content;
  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  function toggleReadAloud(message: Message) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setError("Read aloud is not supported by this browser. You can still select and read the text.");
      return;
    }

    if (speakingMessageId === message.id) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setSpeechPaused(false);
      } else {
        window.speechSynthesis.pause();
        setSpeechPaused(true);
      }
      return;
    }

    window.speechSynthesis.cancel();
    setSpeechPaused(false);
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = preferences.language === "ml" ? "ml-IN" : "en-IN";
    utterance.onend = () => {
      setSpeakingMessageId(null);
      setSpeechPaused(false);
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
      setSpeechPaused(false);
    };
    setSpeakingMessageId(message.id);
    window.speechSynthesis.speak(utterance);
  }

  function stopReadAloud() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
    setSpeechPaused(false);
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current));
      }, 1600);
    } catch {
      setError("Clipboard access is unavailable. Select the message text to copy it.");
    }
  }

  return (
    <main className="chat-page">
      <OfflineBanner />
      <header className="chat-header">
        <div>
          <h2>{conversationTitle}</h2>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="message-list"
        onScroll={(event) => {
          const element = event.currentTarget;
          const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
          stick.current = atBottom;
          setShowScrollToBottom(!atBottom);
          try {
            sessionStorage.setItem("ozlind:scroll:" + (id ?? "new"), String(element.scrollTop));
          } catch {
            // Scroll restoration is optional when session storage is unavailable.
          }
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation messages"
      >
        <div className="message-column">
          {messages.length === 0 && historyLoading ? (
            <div className="history-state" role="status">
              <span className="history-spinner" aria-hidden="true" />
              <p>Loading conversation…</p>
            </div>
          ) : messages.length === 0 && historyError ? (
            <div className="history-state" role="alert">
              <p>{historyError}</p>
              <button className="text-button" onClick={() => setHistoryAttempt((attempt) => attempt + 1)}>
                Try again
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-chat">
              <span className="empty-chat-mark" aria-hidden="true">
                <OzlindIcon name="ozl-mark" size={36} aria-hidden="true" />
              </span>
              <h1>How can I help you today?</h1>
              <p>What would you like to work through today? Ask a question, explore an idea, or get help with a task.</p>
              <div className="prompt-grid home-suggestions" role="group" aria-label="Suggested ways to start">
                {([
                  ["Explain a topic", "Explain [topic] in plain language, with one practical example."],
                  ["Draft a message", "Help me write a clear, natural message about [topic]. Ask any questions you need first."],
                  ["Help with code", "Help me solve this coding problem. Ask me for the relevant code and error if needed."],
                  ["Translate text", "Translate the following text to [language], preserving its meaning and tone:\n"],
                ] as const).map(([label, prompt]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setDraft(prompt);
                      requestAnimationFrame(() => textareaRef.current?.focus());
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const dayLabel = messageDayLabel(message.created_at);
              const previousDayLabel = messageDayLabel(messages[index - 1]?.created_at);
              const showDateSeparator = Boolean(dayLabel && dayLabel !== previousDayLabel);
              const messageTime = message.created_at && Number.isFinite(Date.parse(message.created_at))
                ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))
                : "";
              return (
                <Fragment key={message.id}>
                  {showDateSeparator && <div className="message-date-separator">{dayLabel}</div>}
                  <article key={message.id} className={"message " + message.role}>
                <div className="message-role">{message.role === "user" ? "You" : "Ozlind"}</div>
                <div
                  dir="auto"
                  className={"message-content" + (message.content.length > 1600 && !expandedMessages.has(message.id) ? " message-content-collapsed" : "")}
                >
                  {message.role === "user" ? (
                    <>
                      {message.images && message.images.length > 0 && (
                        <div className="message-inline-attachments" aria-label="Message attachments">
                          {message.images.map((image, imageIndex) => (
                            <img key={image.name + imageIndex} src={image.dataUrl} alt={image.name} loading="lazy" />
                          ))}
                        </div>
                      )}
                      <p dir="auto">{message.content}</p>
                    </>
                  ) : message.content ? (
                    <MarkdownRenderer content={message.content} />
                  ) : message.status === "streaming" ? (
                    <div className="thinking-state" role="status">
                      <span className="thinking-indicator" aria-hidden="true" />
                      {researchEnabled ? "Searching the web…" : "Preparing a response…"}
                    </div>
                  ) : (
                    <MarkdownRenderer content=" " />
                  )}
                </div>
                {messageTime && (
                  <time className="message-timestamp" dateTime={message.created_at} title={message.created_at}>
                    {messageTime}
                  </time>
                )}
                {message.content.length > 1600 && (
                  <button
                    type="button"
                    className="message-expand"
                    aria-expanded={expandedMessages.has(message.id)}
                    onClick={() => setExpandedMessages(current => {
                      const next = new Set(current);
                      if (next.has(message.id)) next.delete(message.id);
                      else next.add(message.id);
                      return next;
                    })}
                  >
                    {expandedMessages.has(message.id) ? "Show less" : "Show more"}
                  </button>
                )}
                {message.status === "interrupted" && (
                  <div className="interrupted">
                    Generation stopped.{" "}
                    <button onClick={() => void send("regenerate", lastUserMessage)}>Continue</button>
                  </div>
                )}
                {message.role === "assistant" && message.status === "streaming" && (
                  <span className="stream-cursor" aria-label="Ozlind is responding" />
                )}
                {message.role === "assistant" && message.content && message.status !== "streaming" && (
                  <div className="message-actions" aria-label="Message actions">
                    <button
                      type="button"
                      className="message-action"
                      onClick={() => void copyMessage(message)}
                    >
                      <><OzlindIcon name={copiedMessageId === message.id ? "i-check" : "i-copy"} size={14} />{copiedMessageId === message.id ? "Copied" : "Copy"}</>
                    </button>
                    <button type="button" className="message-action" onClick={() => toggleReadAloud(message)}>
                      {speakingMessageId === message.id ? (speechPaused ? "Resume audio" : "Pause audio") : "Read aloud"}
                    </button>
                    {speakingMessageId === message.id && (
                      <button type="button" className="message-action" onClick={stopReadAloud}>Stop audio</button>
                    )}
                    {message.id === lastAssistantMessageId && message.status !== "interrupted" && lastUserMessage && (
                      <button
                        type="button"
                        className="message-action"
                        onClick={() => void send("regenerate", lastUserMessage)}
                        disabled={streaming || !online}
                      >
                        <OzlindIcon name="i-regenerate" size={14} /> Regenerate
                      </button>
                    )}
                  </div>
                )}
                  </article>
                </Fragment>
              );
            })
          )}
        </div>
      </div>

      {showScrollToBottom && messages.length > 0 && (
        <button
          type="button"
          className="scroll-to-bottom"
          onClick={() => {
            const element = scrollRef.current;
            if (!element) return;
            element.scrollTo({
              top: element.scrollHeight,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            });
            stick.current = true;
            setShowScrollToBottom(false);
          }}
          aria-label="Scroll to latest message"
        >
          <span aria-hidden="true">↓</span> Latest message
        </button>
      )}

      {error && (
        <div className="error-card" role="alert">
          <span>{error}</span>
          {draft.trim() && !streaming && online && (
            <button type="button" className="error-retry" onClick={() => void send()}>
              Retry
            </button>
          )}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><OzlindIcon name="i-close" size={16} /></button>
        </div>
      )}

      <div className="composer-wrap">
        {images.length > 0 && (
          <div className="composer-attachments" aria-label="Attached images">
            {images.map((image, index) => (
              <div className="composer-attachment" key={image.name + index}>
                <img src={image.dataUrl} alt={image.name} />
                <span>{image.name}</span>
                <button type="button" onClick={() => setImages(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={"Remove " + image.name}><OzlindIcon name="i-clear" size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="composer-modebar" role="group" aria-label="AI mode">
          <button
            type="button"
            className={"composer-mode" + (mode === "auto" ? " active" : "")}
            aria-pressed={mode === "auto"}
            aria-expanded={showModeOptions}
            aria-controls="composer-mode-options"
            title="Choose a response mode"
            onClick={() => setShowModeOptions(current => !current)}
          >
            <OzlindIcon name="sym-processing" size={15} />
            <span>Auto</span>
            <OzlindIcon name={showModeOptions ? "i-close" : "i-plus"} size={13} />
          </button>
          <button type="button" className={"composer-research" + (researchEnabled ? " active" : "")}
            aria-pressed={researchEnabled} disabled={streaming} onClick={() => setResearchEnabled(current => !current)}
            title="Search the web and include sources" aria-label={researchEnabled ? "Turn web search off" : "Turn web search on"}>
            <OzlindIcon name="i-web-research" size={15} />
            <span>Web search</span>
          </button>
          {showModeOptions && (
            <div id="composer-mode-options" className="composer-mode-options" role="group" aria-label="Choose AI mode">
              {([
                ["fast", "Fast", "Fast responses"],
                ["vision", "Vision", "Analyze images with Gemini"],
                ["pro", "Pro", "Use the configured pro model"],
              ] as const).map(([value, label, description]) => (
                <button key={value} type="button" className={"composer-mode" + (mode === value ? " active" : "")}
                  aria-pressed={mode === value}
                  title={images.length > 0 && value !== "vision" ? "Attached images require Vision mode" : description}
                  aria-label={label + ": " + (images.length > 0 && value !== "vision" ? "Unavailable while images are attached" : description)}
                  disabled={streaming || (images.length > 0 && value !== "vision")}
                  onClick={() => { setMode(value); setShowModeOptions(false); }}>
                  {value === "fast" ? <OzlindIcon name="sym-active" size={15} /> :
                   value === "vision" ? <OzlindIcon name="i-image-generator" size={15} /> :
                   <OzlindIcon name="sym-thinking" size={15} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="composer">
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
            onChange={(event) => void addImages(event.target.files)} aria-label="Attach images" />
          <button type="button" className="composer-attach" onClick={() => fileInputRef.current?.click()}
            disabled={streaming || images.length >= 2} aria-label="Attach an image" title="Attach an image to ask about it">
            <OzlindIcon name="i-attach" size={19} />
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKey}
            rows={1}
            maxLength={20000}
            placeholder="Ask Ozlind anything…"
            aria-label="Write your message"
            aria-describedby="composer-help"
          />
          <Button
            className="send-button"
            disabled={streaming ? false : !online || !draft.trim()}
            onClick={() => (streaming ? abortRef.current?.abort() : void send())}
            aria-label={streaming ? "Stop response" : "Send message"}
          >
            {streaming ? (
              <>
                <OzlindIcon name="i-stop" size={18} />
                Stop
              </>
            ) : (
              <OzlindIcon name="ozl-mark" size={18} />
            )}
          </Button>
        </div>
        <div className="composer-meta">
          <p id="composer-help" className="composer-keyboard-hint">
            {mobileKeyboard ? "Enter for a new line · Tap Send to submit" : preferences.enter_to_send ? "Enter to send · Shift + Enter for a new line" : "Shift + Enter for a new line · Tap Send to submit"}
          </p>
          {draft.length >= 18000 && (
            <p className="composer-counter" aria-live="polite">{draft.length.toLocaleString()} / 20,000</p>
          )}
        </div>
        <p className="composer-note">
          {!online ? "You’re offline. Reconnect to send a message." :
            researchEnabled ? "Web search is on · Check sources and important details." :
            mode === "vision" ? "Vision mode uses Gemini · Attach up to 2 images." :
            "Ozlind can make mistakes. Check important details."}
        </p>
      </div>
    </main>
  );
}
