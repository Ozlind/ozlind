"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Check, ChevronDown, Menu, MessageSquarePlus, MoreHorizontal, PanelLeftClose, Plus, Search, Square, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; status?: string };
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

export default function ChatWorkspace({ conversationId: initialConversationId }: { conversationId?: string }) {
  const router = useRouter();
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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => setConversationId(initialConversationId ?? null), [initialConversationId]);

  const loadConversations = useCallback(async () => {
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
      setConversations((data ?? []) as Conversation[]);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoadingHistory(false);
      return;
    }
    let active = true;
    setLoadingHistory(true);
    setError("");
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("messages")
          .select("id,role,content,status")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(100);
        if (queryError) throw queryError;
        if (active) setMessages((data ?? []) as ChatMessage[]);
      } catch (caught) {
        if (active) setError("This conversation couldn't be loaded. Check your connection and try again.");
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => { active = false; };
  }, [conversationId]);

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
      if (event.key === "Escape") setModeOpen(false);
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

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You're offline. Reconnect before sending your message.");
      return;
    }

    const requestKey = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const targetConversationId = conversationId;
    const optimisticUser: ChatMessage = { id: requestKey, role: "user", content, status: "complete" };
    setMessages(current => [...current, optimisticUser, { id: assistantId, role: "assistant", content: "", status: "streaming" }]);
    setDraft("");
    setError("");
    setSending(true);
    stickToBottom.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: targetConversationId,
          content,
          model: MODEL[mode],
          action: "send",
          idempotencyKey: requestKey,
          research: webSearch,
          images: [],
        }),
        signal: controller.signal,
      });

      if (response.status === 204) {
        const duplicateId = response.headers.get("X-OZLIND-Conversation-ID");
        setMessages(current => current.filter(message => message.id !== requestKey && message.id !== assistantId));
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
        throw new Error(body?.error?.message || body?.error?.code || "Ozlind couldn't generate a response.");
      }

      const nextId = response.headers.get("X-OZLIND-Conversation-ID");
      if (nextId && nextId !== targetConversationId) {
        setConversationId(nextId);
        router.replace("/app/" + nextId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming isn't available for this response.");
      const decoder = new TextDecoder();
      let pending = "";
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
        pending += decoder.decode(part.value, { stream: true });
        flush();
      }
      pending += decoder.decode();
      flush(true);
      setMessages(current => current.map(message =>
        message.id === assistantId ? { ...message, status: "complete" } : message
      ));
      await loadConversations();
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages(current => current.map(message =>
          message.id === assistantId ? { ...message, status: message.content ? "interrupted" : "failed" } : message
        ));
      } else {
        setError(readableError(caught));
        setDraft(current => current.trim() ? current : content);
        setMessages(current => current.filter(message => message.id !== assistantId || Boolean(message.content)));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
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

  return (
    <div className={"oz-chat-app" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      {mobileSidebarOpen && <button className="oz-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={"oz-sidebar" + (mobileSidebarOpen ? " is-open" : "")} aria-label="Conversation navigation">
        <div className="oz-sidebar-head">
          <a href="/app" className="oz-brand" aria-label="Ozlind home" onClick={event => { event.preventDefault(); newChat(); }}>
            <Image src="/ozlind-mark.svg" alt="" width={30} height={30} priority />
            <span>Ozlind</span>
          </a>
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
                  onClick={() => openConversation(conversation.id)} title={conversation.title || "Untitled conversation"}>
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
            stickToBottom.current = element.scrollTop + element.clientHeight >= element.scrollHeight - 56;
            setShowScrollDown(!stickToBottom.current);
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
                    {message.role === "user" ? <div className="oz-user-bubble">{message.content}</div> :
                      message.content ? <div className="oz-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> :
                      <div className="oz-thinking" role="status"><span className="oz-thinking-dot" />{webSearch ? "Searching the web and preparing a response…" : "Thinking through your question…"}</div>}
                    {message.status === "interrupted" && <p className="oz-interrupted">Response stopped. You can ask Ozlind to continue.</p>}
                    {message.role === "assistant" && message.content && message.status !== "streaming" && (
                      <div className="oz-message-actions">
                        <button type="button" onClick={() => void copyMessage(message)}>{copiedId === message.id ? <Check size={14} /> : <Square size={13} />}{copiedId === message.id ? "Copied" : "Copy"}</button>
                        {message.id === [...messages].reverse().find(item => item.role === "assistant")?.id && lastUserMessage &&
                          <button type="button" onClick={() => { setDraft("Continue from your last response: " + lastUserMessage); textareaRef.current?.focus(); }}>Continue</button>}
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
            <textarea ref={textareaRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); }
            }} placeholder="Message Ozlind…" rows={1} maxLength={20000} disabled={sending} aria-label="Message Ozlind" />
            <button type="button" className="oz-send-button" onClick={sending ? stopGeneration : () => void sendMessage()} disabled={!sending && !draft.trim()} aria-label={sending ? "Stop response" : "Send message"} title={sending ? "Stop response" : "Send message"}>
              {sending ? <Square size={14} fill="currentColor" /> : <Image src="/ozlind-mark.svg" alt="" width={24} height={24} />}
            </button>
          </div>
          <div className="oz-composer-toolbar">
            <div className="oz-mode-wrap" ref={modeMenuRef}>
              <button type="button" className={"oz-tool-button" + (modeOpen ? " active" : "")} onClick={() => setModeOpen(value => !value)} aria-expanded={modeOpen} aria-haspopup="menu">
                <span className="oz-mode-indicator" />{mode === "auto" ? "Auto" : mode === "fast" ? "Fast" : mode === "vision" ? "Vision" : "Pro"}<ChevronDown size={13} />
              </button>
              {modeOpen && <div className="oz-mode-menu" role="menu" aria-label="Choose AI mode">
                {(["auto", "fast", "vision", "pro"] as ModelMode[]).map(option => <button type="button" role="menuitemradio" aria-checked={mode === option} key={option} className={mode === option ? "selected" : ""} onClick={() => { setMode(option); setModeOpen(false); }}><span><strong>{option === "auto" ? "Auto" : option[0].toUpperCase() + option.slice(1)}</strong><small>{option === "auto" ? "Choose a suitable model" : option === "fast" ? "Quick everyday answers" : option === "vision" ? "Image understanding" : "More deliberate reasoning"}</small></span>{mode === option && <Check size={15} />}</button>)}
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
