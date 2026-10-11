"use client";

import { useEffect, useRef, useState } from "react";
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
};

export function Chat({ conversationId: initialId }: { conversationId?: string }) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const { preferences } = usePreferences();
  const [model, setModel] = useState<string>(preferences.default_model);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [online, setOnline] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setId(initialId), [initialId]);
  useEffect(() => setModel(preferences.default_model), [preferences.default_model]);

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
          .select("id,role,content,status")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        if (!live) return;
        if (queryError) {
          setHistoryError("Your conversation history could not be loaded.");
          return;
        }
        setMessages((data ?? []) as Message[]);
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
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [draft]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(action: "send" | "regenerate" = "send", contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    if ((action === "send" && !content) || streaming || !online) return;

    if (action === "send") setDraft("");
    setError("");
    const key = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    if (action === "send") {
      setMessages((current) => current.concat({ id: key, role: "user", content, status: "complete" }));
    }
    setMessages((current) => current.concat({ id: assistantId, role: "assistant", content: "", status: "streaming" }));
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: id,
          content,
          model,
          action,
          idempotencyKey: key,
          research: preferences.research_enabled,
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
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        const delta = decoder.decode(part.value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + delta, status: "streaming" }
              : message,
          ),
        );
      }

      const remainder = decoder.decode();
      if (remainder) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: message.content + remainder } : message,
          ),
        );
      }
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
          setDraft((current) => (current.trim() ? current : content));
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

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Do not submit while an IME (for example, Malayalam input) is composing text.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && preferences.enter_to_send) {
      event.preventDefault();
      void send();
    }
  };

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content;

  return (
    <main className="chat-page">
      <OfflineBanner />
      <header className="chat-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>{id ? "Conversation" : "New chat"}</h2>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="message-list"
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
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
                <OzlindIcon name="ozl-mark" size={42} />
              </span>
              <h1>How can I help?</h1>
              <p>Ask a question, draft something, or work through a problem.</p>
              <div className="prompt-grid">
                <button onClick={() => { setDraft("Help me plan my week."); textareaRef.current?.focus(); }}>Plan my week</button>
                <button onClick={() => { setDraft("Explain a difficult idea simply."); textareaRef.current?.focus(); }}>Explain an idea</button>
                <button onClick={() => { setDraft("Help me write something clearly."); textareaRef.current?.focus(); }}>Write with me</button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={"message " + message.role}>
                <div className="message-role">{message.role === "user" ? "You" : "Ozlind"}</div>
                <div className="message-content">
                  {message.role === "user" ? (
                    <p>{message.content}</p>
                  ) : (
                    <MarkdownRenderer content={message.content || " "} />
                  )}
                </div>
                {message.status === "interrupted" && (
                  <div className="interrupted">
                    Generation stopped.{" "}
                    <button onClick={() => void send("regenerate", lastUserMessage)}>Continue</button>
                  </div>
                )}
                {message.role === "assistant" && message.status === "streaming" && (
                  <span className="stream-cursor" aria-label="Ozlind is responding" />
                )}
              </article>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="error-card" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <div className="composer-wrap">
        <div className="composer">
          <select value={model} onChange={(event) => setModel(event.target.value)} aria-label="Model">
            <option value="groq:llama-3.3-70b-versatile">Llama 3.3 70B</option>
            <option value="groq:deepseek-r1-distill-llama-70b">DeepThink</option>
            <option value="google:gemini-2.0-flash">Gemini Flash</option>
          </select>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKey}
            rows={1}
            maxLength={20000}
            placeholder="Message Ozlind…"
            aria-label="Message Ozlind"
            aria-describedby="composer-help"
          />
          <Button
            className="send-button"
            disabled={streaming ? false : !online || !draft.trim()}
            onClick={() => (streaming ? abortRef.current?.abort() : void send())}
            aria-label={streaming ? "Stop generation" : "Send message"}
          >
            {streaming ? (
              <>
                <OzlindIcon name="i-stop" size={18} />
                Stop
              </>
            ) : (
              <>
                <OzlindIcon name="i-arrow-up" size={18} />
                Send
              </>
            )}
          </Button>
        </div>
        <div className="composer-meta">
          <p id="composer-help" className="composer-keyboard-hint">
            {preferences.enter_to_send ? "Enter to send · Shift + Enter for a new line" : "Enter for a new line · Use Send to submit"}
          </p>
          {draft.length >= 18000 && (
            <p className="composer-counter" aria-live="polite">{draft.length.toLocaleString()} / 20,000</p>
          )}
        </div>
        <p className="composer-note">
          {online ? "Ozlind can make mistakes. Verify important information." : "You’re offline. Reconnect to send a message."}
        </p>
      </div>
    </main>
  );
}
