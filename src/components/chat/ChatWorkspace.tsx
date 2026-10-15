"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, Check, ChevronDown, Menu, MessageSquarePlus, PanelLeftClose, Paperclip, Plus, Search, Square, X, LogOut } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";

type PendingImage = { id: string; name: string; dataUrl: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; status?: string; idempotency_key?: string | null; images?: PendingImage[] };
type Conversation = { id: string; title: string; updated_at?: string };
type ModelMode = "auto" | "fast" | "vision" | "pro";

const MODEL: Record<ModelMode, string> = {
  auto: "groq:llama-3.3-70b-versatile",
  fast: "groq:llama-3.3-70b-versatile",
  vision: "google:gemini-2.0-flash",
  pro: "groq:deepseek-r1-distill-llama-70b",
};

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Ozlind couldn't complete that request. Please try again.";
}

function responseErrorMessage(body: unknown, status: number): string {
  const payload = body as { error?: { code?: unknown; message?: unknown } } | null;
  const message = payload?.error?.message;
  if (typeof message === "string" && message.trim()) return message;

  const code = typeof payload?.error?.code === "string" ? payload.error.code : "";
  switch (code) {
    case "RATE_LIMITED": return "You’ve sent several requests in a short time. Please wait a moment and try again.";
    case "RATE_LIMITER_UNAVAILABLE": return "Request protection is temporarily unavailable. Please try again shortly.";
    case "AI_CONFIGURATION_ERROR":
    case "SERVER_CONFIGURATION_ERROR": return "Ozlind is missing a required server configuration. Please try again later.";
    case "AI_PROVIDER_UNAVAILABLE": return "The AI service is temporarily unavailable. Your message is still here; retry the response in a moment.";
    case "CONVERSATION_CREATE_FAILED":
    case "MESSAGE_SAVE_FAILED":
    case "HISTORY_LOAD_FAILED":
    case "ASSISTANT_CREATE_FAILED": return "Your message couldn’t be saved or loaded. Please retry the response.";
    case "NOT_FOUND": return "This conversation could not be found. Start a new chat and try again.";
    case "INVALID_INPUT": return "That message could not be processed. Check the message and any attachments, then try again.";
    default: return status >= 500
      ? "Ozlind ran into a temporary server issue. Your message is still here; retry the response."
      : "Ozlind couldn’t process that request. Please try again.";
  }
}

async function compressImageFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image couldn't be opened. Choose a JPEG, PNG, or WebP image."));
      element.src = objectUrl;
    });

    const dimensions = [1600, 1280, 1024];
    const qualities = [0.82, 0.72, 0.62, 0.52];
    for (const maxDimension of dimensions) {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing isn't available in this browser.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        // Keep two-image JSON requests within common serverless request-body limits.
        if (dataUrl.length <= 1_800_000) return dataUrl;
      }
    }

    throw new Error("This image is too large to attach after compression. Choose a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ChatWorkspace({ conversationId: initialConversationId }: { conversationId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversationId, setConversationId] = useState(initialConversationId ?? null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ModelMode>("auto");
  const [modeOpen, setModeOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingImage[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendLockRef = useRef(false);
  const conversationLoadRequest = useRef(0);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => setConversationId(initialConversationId ?? null), [initialConversationId]);

  const loadConversations = useCallback(async () => {
    const requestId = ++conversationLoadRequest.current;
    setLoadingConversations(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your session has expired. Please sign in again.");
      const { data, error: queryError } = await supabase
        .from("conversations")
        .select("id,title,updated_at")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      if (requestId === conversationLoadRequest.current) setConversations((data ?? []) as Conversation[]);
    } catch (caught) {
      if (requestId === conversationLoadRequest.current) setError(readableError(caught));
    } finally {
      if (requestId === conversationLoadRequest.current) setLoadingConversations(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoadingHistory(false);
      return;
    }
    if (sending) return;
    let active = true;
    setLoadingHistory(true);
    setError("");
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("messages")
          .select("id,role,content,status,idempotency_key")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(100);
        if (queryError) throw queryError;
        if (active) {
          setMessages(current => (data ?? []).map(row => {
            // Preserve this session's image previews by matching the request idempotency key.
            const optimistic = current.find(message => message.id === row.idempotency_key && message.images?.length);
            return optimistic ? { ...row, images: optimistic.images } as ChatMessage : row as ChatMessage;
          }));
        }
      } catch (caught) {
        if (active) setError("This conversation couldn't be loaded. Check your connection and try again.");
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => { active = false; };
  }, [conversationId, sending]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: sending ? "auto" : "smooth" });
    }
  }, [messages, sending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
  }, [draft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModeOpen(false);
        setMobileSidebarOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) setModeOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      abortRef.current?.abort();
    };
  }, []);

  function newChat() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setAttachments([]);
    setError("");
    setSending(false);
    setMobileSidebarOpen(false);
    setModeOpen(false);
    router.push("/app");
    textareaRef.current?.focus();
  }

  function openConversation(id: string) {
    if (sending) return;
    setConversationId(id);
    setMobileSidebarOpen(false);
    setError("");
    router.push("/app/" + id);
  }

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || sending || processingImages) return;

    const availableSlots = 2 - attachments.length;
    if (availableSlots <= 0) {
      setError("You can attach up to two images to one message.");
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    const extraFilesSkipped = files.length > selectedFiles.length;
    setProcessingImages(true);
    setError("");
    try {
      const processed: PendingImage[] = [];
      for (const file of selectedFiles) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error("Choose a JPEG, PNG, or WebP image.");
        }
        if (file.size > 12 * 1024 * 1024) {
          throw new Error("Each image must be smaller than 12 MB before compression.");
        }
        processed.push({ id: crypto.randomUUID(), name: file.name, dataUrl: await compressImageFile(file) });
      }
      setAttachments(current => [...current, ...processed].slice(0, 2));
      setMode("vision");
      setError(extraFilesSkipped ? "Only two images can be attached to a message; extra files were skipped." : "");
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setProcessingImages(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments(current => current.filter(image => image.id !== id));
  }

  async function sendMessage(
    action: "send" | "regenerate" = "send",
    requestContent?: string,
    retryingExistingUser = false,
  ) {
    const content = (
      requestContent ?? (action === "regenerate" ? "" : draft)
    ).trim() || (action === "send" && attachments.length
      ? "Please describe and analyze the attached image(s)."
      : "");
    if (!content || sending || processingImages || sendLockRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You're offline. Reconnect before sending your message.");
      return;
    }

    // State updates render asynchronously; this ref blocks same-tick duplicate sends.
    sendLockRef.current = true;
    const requestKey = crypto.randomUUID();
    const targetConversationId = conversationId;
    const latestUser = [...messages].reverse().find(message => message.role === "user");
    const latestAssistant = [...messages].reverse().find(message => message.role === "assistant");
    const submittedAttachments = action === "regenerate"
      ? (latestUser?.images?.length ? latestUser.images : attachments)
      : attachments;
    const assistantId = (action === "regenerate" || retryingExistingUser) && latestAssistant
      ? latestAssistant.id
      : crypto.randomUUID();

    if (action === "send" && !retryingExistingUser) {
      const optimisticUser: ChatMessage = {
        id: requestKey,
        idempotency_key: requestKey,
        role: "user",
        content,
        status: "complete",
        images: submittedAttachments,
      };
      setMessages(current => [...current, optimisticUser, { id: assistantId, role: "assistant", content: "", status: "streaming" }]);
    } else {
      setMessages(current => {
        let next = current;
        if (action === "send" && retryingExistingUser && latestUser) {
          next = next.map(message => message.id === latestUser.id
            ? { ...message, id: requestKey, idempotency_key: requestKey, status: "complete", images: submittedAttachments }
            : message);
        }
        const existing = next.some(message => message.id === assistantId);
        if (!existing) return [...next, { id: assistantId, role: "assistant", content: "", status: "streaming" }];
        return next.map(message => message.id === assistantId
          ? { ...message, content: "", status: "streaming" }
          : message);
      });
    }
    if (action === "send") setDraft("");
    setError("");
    setSending(true);
    stickToBottom.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    let routeAfterStream: string | null = null;
    let streamCompleted = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: targetConversationId,
          content,
          model: MODEL[mode],
          action,
          idempotencyKey: requestKey,
          research: webSearch,
          images: submittedAttachments.map(image => ({ dataUrl: image.dataUrl, mimeType: "image/jpeg" })),
        }),
        signal: controller.signal,
      });

      if (response.status === 204) {
        const duplicateId = response.headers.get("X-OZLIND-Conversation-ID");
        // Keep the optimistic user bubble until the normal history refresh replaces it
        // with the saved row; remove only the empty assistant placeholder.
        setMessages(current => current.filter(message => message.id !== assistantId));
        setAttachments([]);
        if (duplicateId) {
          setConversationId(duplicateId);
          router.replace("/app/" + duplicateId);
        }
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.error?.code === "AUTH_REQUIRED") {
          router.replace("/login");
          throw new Error("Your session expired. Sign in again to continue.");
        }
        throw new Error(responseErrorMessage(body, response.status));
      }

      const nextId = response.headers.get("X-OZLIND-Conversation-ID");
      if (nextId) {
        setConversationId(nextId);
        if (pathname !== "/app/" + nextId) routeAfterStream = nextId;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming isn't available for this response.");
      const decoder = new TextDecoder();
      let pending = "";
      let receivedText = false;
      let lastFlush = 0;
      const flush = (force = false) => {
        if (!pending || (!force && Date.now() - lastFlush < 32)) return;
        const chunk = pending;
        pending = "";
        lastFlush = Date.now();
        setMessages(current => current.map(message =>
          message.id === assistantId ? { ...message, content: message.content + chunk, status: "streaming" } : message
        ));
      };

      while (true) {
        const part = await reader.read();
        if (part.done) break;
        const decoded = decoder.decode(part.value, { stream: true });
        if (decoded) receivedText = true;
        pending += decoded;
        flush();
      }
      const decoderTail = decoder.decode();
      if (decoderTail) receivedText = true;
      pending += decoderTail;
      flush(true);
      if (!receivedText) throw new Error("The response stream ended before Ozlind returned an answer.");
      streamCompleted = true;
      setMessages(current => current.map(message =>
        message.id === assistantId ? { ...message, status: "complete" } : message
      ));
      setAttachments([]);
      await loadConversations();
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages(current => current.map(message =>
          message.id === assistantId
            ? { ...message, status: message.content ? "interrupted" : "failed" }
            : message
        ));
      } else {
        setError(readableError(caught));
        if (action === "send") setDraft(current => current.trim() ? current : content);
        setMessages(current => current.map(message =>
          message.id === assistantId
            ? { ...message, status: message.content ? "interrupted" : "failed" }
            : message
        ));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      sendLockRef.current = false;
      setSending(false);
      // Changing App Router pages unmounts this client component. Navigate only
      // after the response body has settled so cleanup cannot abort active streaming.
      if (streamCompleted && routeAfterStream) router.replace("/app/" + routeAfterStream);
      textareaRef.current?.focus();
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function signOut() {
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.assign("/login");
    } catch {
      setError("Couldn't sign out right now. Please try again.");
    }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(current => current === message.id ? null : current), 1400);
    } catch {
      setError("Clipboard access is unavailable. You can select the response text to copy it.");
    }
  }

  const lastUserMessage = [...messages].reverse().find(message => message.role === "user")?.content;
  const latestAssistantId = [...messages].reverse().find(message => message.role === "assistant")?.id;

  return (
    <div className={"oz-chat-app" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      {mobileSidebarOpen && <button className="oz-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={"oz-sidebar" + (mobileSidebarOpen ? " is-open" : "")} aria-label="Conversation navigation">
        <div className="oz-sidebar-head">
          <Link href="/app" className="oz-brand" aria-label="Ozlind home" onClick={event => { event.preventDefault(); newChat(); }}>
            <Image src="/ozlind-mark.svg" alt="" width={30} height={30} priority />
            <span>Ozlind</span>
          </Link>
          <button type="button" className="oz-icon-button desktop-collapse" onClick={() => setSidebarCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar"><PanelLeftClose size={17} /></button>
          <button type="button" className="oz-icon-button mobile-close" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
        </div>
        <button type="button" className="oz-new-chat" onClick={newChat}><MessageSquarePlus size={16} /><span>New chat</span><span className="oz-shortcut">↵</span></button>
        <div className="oz-sidebar-section">
          <div className="oz-sidebar-label">Recent</div>
          {loadingConversations && conversations.length === 0 ? (
            <div className="oz-sidebar-loading"><span className="oz-mini-spinner" />Loading chats</div>
          ) : conversations.length === 0 ? (
            <p className="oz-sidebar-empty">Your conversations will appear here.</p>
          ) : (
            <nav className="oz-conversation-list">
              {conversations.map(conversation => (
                <button key={conversation.id} type="button" className={"oz-conversation-link" + (conversation.id === conversationId ? " active" : "")}
                  onClick={() => openConversation(conversation.id)} title={conversation.title || "Untitled conversation"}
                  aria-current={conversation.id === conversationId ? "page" : undefined}>
                  <MessageSquarePlus size={15} /><span>{conversation.title || "Untitled conversation"}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="oz-sidebar-bottom">
          <div className="oz-account-mark"><Image src="/ozlind-mark.svg" alt="" width={26} height={26} /></div>
          <div className="oz-account-copy"><strong>Private workspace</strong><span>Synced with your account</span></div>
          <button type="button" className="oz-icon-button" onClick={() => void loadConversations()} aria-label="Refresh conversations" title="Refresh conversations"><ArrowDown size={15} /></button>
          <button type="button" className="oz-icon-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button>
        </div>
      </aside>

      {sidebarCollapsed && <button type="button" className="oz-reopen-sidebar" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar"><PanelLeftClose size={18} /></button>}

      <main className="oz-chat-main">
        <header className="oz-topbar">
          <div className="oz-topbar-left">
            <button type="button" className="oz-icon-button mobile-menu-trigger" onClick={() => setMobileSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <span className="oz-topbar-title">{conversationId ? "Conversation" : "New conversation"}</span>
            <span className="oz-topbar-divider" />
            <span className="oz-model-caption">Ozlind AI</span>
          </div>
          <button type="button" className="oz-icon-button" onClick={newChat} aria-label="Start a new chat" title="New chat"><Plus size={18} /></button>
        </header>

        <div className="oz-message-scroll" ref={scrollRef}
          onScroll={event => {
            const element = event.currentTarget;
            const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 56;
            stickToBottom.current = isAtBottom;
            setShowScrollDown(current => current === !isAtBottom ? current : !isAtBottom);
          }}>
          <div className={"oz-message-column" + (messages.length === 0 ? " is-empty" : "")}>
            {loadingHistory ? (
              <div className="oz-history-state" role="status"><span className="oz-mini-spinner" />Loading conversation…</div>
            ) : messages.length === 0 ? (
              <section className="oz-welcome">
                <Image src="/ozlind-mark.svg" alt="" width={42} height={42} className="oz-welcome-mark" priority />
                <p className="oz-eyebrow">A clearer space to think</p>
                <h1>What would you like<br className="oz-desktop-break" /> to work through?</h1>
                <p className="oz-welcome-copy">Ask a question, explore an idea, or turn a rough thought into something useful.</p>
              </section>
            ) : (
              messages.map(message => (
                <article key={message.id} className={"oz-message " + message.role}>
                  {message.role === "assistant" && <Image src="/ozlind-mark.svg" alt="" width={25} height={25} className="oz-message-mark" />}
                  <div className="oz-message-body">
                    <div className="oz-message-label">{message.role === "user" ? "You" : "Ozlind"}</div>
                    {message.role === "user" ? <>
                      {message.images?.length ? <div className="oz-message-images" aria-label="Images attached to this message">{message.images.map(image => <Image key={image.id} src={image.dataUrl} alt={image.name} width={180} height={144} unoptimized />)}</div> : null}
                      <div className="oz-user-bubble">{message.content}</div>
                    </> : message.content ? <div className="oz-markdown" aria-live={message.status === "streaming" ? "off" : "polite"}><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : message.status === "failed" ? <p className="oz-interrupted" role="status">No response was received. Retry to try again.</p> : <div className="oz-thinking" role="status"><span className="oz-thinking-dot" />{webSearch ? "Searching the web and preparing a response…" : "Thinking through your question…"}</div>}
                    {message.status === "interrupted" && <p className="oz-interrupted" role="status">Response stopped. You can retry this response.</p>}
                    {message.role === "assistant" && message.status !== "streaming" && (message.content || message.status === "failed" || message.status === "interrupted") && (
                      <div className="oz-message-actions">
                        {message.content && <button type="button" onClick={() => void copyMessage(message)}>{copiedId === message.id ? <Check size={14} /> : <Square size={13} />}{copiedId === message.id ? "Copied" : "Copy"}</button>}
                        {message.id === latestAssistantId && lastUserMessage && (message.status === "failed" || message.status === "interrupted")
                          ? <button type="button" onClick={() => void sendMessage(conversationId ? "regenerate" : "send", lastUserMessage, !conversationId)}>Retry response</button>
                          : message.id === latestAssistantId && lastUserMessage && message.content
                            ? <button type="button" onClick={() => { setDraft("Continue from your last response: " + lastUserMessage); textareaRef.current?.focus(); }}>Continue</button>
                            : null}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {showScrollDown && <button type="button" className="oz-scroll-down" onClick={() => { stickToBottom.current = true; scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }} aria-label="Scroll to latest message"><ArrowDown size={17} /></button>}

        <footer className="oz-composer-area">
          {error && <div className="oz-error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
          <div className="oz-composer-shell">
            <input ref={imageInputRef} className="oz-image-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void handleImageSelection(event)} aria-label="Choose images to attach" />
            <button type="button" className="oz-attach-button" onClick={() => imageInputRef.current?.click()} disabled={sending || processingImages || attachments.length >= 2} aria-label="Attach images" title={attachments.length >= 2 ? "Two images attached" : "Attach images"}><Paperclip size={17} /></button>
            <div className="oz-composer-input-zone">
              {attachments.length > 0 && <div className="oz-attachment-previews" aria-label="Attached images">
                {attachments.map(image => <div className="oz-attachment-preview" key={image.id}>
                  <Image src={image.dataUrl} alt={image.name} width={58} height={58} unoptimized />
                  <button type="button" onClick={() => removeAttachment(image.id)} disabled={sending} aria-label={"Remove " + image.name} title="Remove image"><X size={12} /></button>
                </div>)}
                <span className="oz-attachment-note">Images are used for this reply and aren’t saved to history.</span>
              </div>}
              <textarea ref={textareaRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); }
            }} placeholder={attachments.length ? "Ask about your images…" : "Message Ozlind…"} rows={1} maxLength={20000} disabled={sending} aria-label="Message Ozlind" />
            </div>
            <button type="button" className="oz-send-button" onClick={sending ? stopGeneration : () => void sendMessage()} disabled={!sending && (!draft.trim() && attachments.length === 0 || processingImages)} aria-label={sending ? "Stop response" : "Send message"} title={sending ? "Stop response" : "Send message"}>
              {sending ? <Square size={14} fill="currentColor" /> : <Image src="/ozlind-mark.svg" alt="" width={24} height={24} />}
            </button>
          </div>
          <div className="oz-composer-toolbar">
            <div className="oz-mode-wrap" ref={modeMenuRef}>
              <button type="button" className={"oz-tool-button" + (modeOpen ? " active" : "")} onClick={() => setModeOpen(value => !value)} aria-expanded={modeOpen} aria-haspopup="menu">
                <span className="oz-mode-indicator" />{mode === "auto" ? "Auto" : mode === "fast" ? "Fast" : mode === "vision" ? "Vision" : "Pro"}<ChevronDown size={13} />
              </button>
              {modeOpen && <div className="oz-mode-menu" role="menu" aria-label="Choose AI mode">
                {(["auto", "fast", "vision", "pro"] as ModelMode[]).map(option => <button type="button" role="menuitemradio" aria-checked={mode === option} key={option} className={mode === option ? "selected" : ""} onClick={() => { if (attachments.length && option !== "vision") { setError("Remove attached images before switching away from Vision."); setModeOpen(false); return; } setMode(option); setModeOpen(false); setError(""); }}><span><strong>{option === "auto" ? "Auto" : option[0].toUpperCase() + option.slice(1)}</strong><small>{option === "auto" ? "Choose a suitable model" : option === "fast" ? "Quick everyday answers" : option === "vision" ? "Image understanding" : "More deliberate reasoning"}</small></span>{mode === option && <Check size={15} />}</button>)}
              </div>}
            </div>
            <button type="button" className={"oz-tool-button" + (webSearch ? " active" : "")} onClick={() => setWebSearch(value => !value)} aria-pressed={webSearch} disabled={sending}><Search size={14} />Web Search</button>
            <span className="oz-toolbar-spacer" />
            <span className="oz-enter-hint">Enter to send · Shift + Enter for new line</span>
          </div>
          <p className="oz-disclaimer">Ozlind can make mistakes. Check important information.</p>
        </footer>
      </main>
    </div>
  );
}
