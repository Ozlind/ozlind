"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchStartY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshLock = useRef(false);

  useEffect(() => setModel(preferences.default_model), [preferences.default_model]);

  useEffect(() => {
    const onPrompt = (event: Event) => setDraft((event as CustomEvent<string>).detail);
    const sync = () => setOnline(navigator.onLine);
    sync();
    addEventListener("ozlind:prompt", onPrompt);
    addEventListener("online", sync);
    addEventListener("offline", sync);
    return () => {
      removeEventListener("ozlind:prompt", onPrompt);
      removeEventListener("online", sync);
      removeEventListener("offline", sync);
    };
  }, []);

  const refreshMessages = useCallback(async (showFeedback = true) => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    if (showFeedback) {
      setRefreshing(true);
      setError("");
    }

    try {
      if (!id) {
        setMessages([]);
        return;
      }
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("messages")
        .select("id,role,content,status")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (queryError) throw queryError;
      setMessages((data ?? []) as Message[]);
    } catch {
      if (showFeedback) setError("Could not refresh this conversation. Please try again.");
    } finally {
      refreshLock.current = false;
      if (showFeedback) setRefreshing(false);
      setPullDistance(0);
      pullDistanceRef.current = 0;
      touchStartY.current = null;
    }
  }, [id]);

  useEffect(() => {
    // Avoid replacing optimistic/streaming messages when the first response creates an ID.
    if (!streaming) void refreshMessages(false);
  }, [refreshMessages, streaming]);

  useEffect(() => {
    if (stick.current && preferences.auto_scroll) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: streaming ? "auto" : "smooth",
      });
    }
  }, [messages, streaming, preferences.auto_scroll]);

  useEffect(() => {
    const element = textareaRef.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = Math.min(element.scrollHeight, 200) + "px";
    }
  }, [draft]);

  async function send(action: "send" | "regenerate" = "send", contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    if ((action === "send" && !content) || streaming || !online) return;
    if (action === "send") setDraft("");
    setError("");

    const key = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    if (action === "send") {
      setMessages((value) => value.concat({ id: key, role: "user", content, status: "complete" }));
    }
    setMessages((value) =>
      value.concat({ id: assistantId, role: "assistant", content: "", status: "streaming" }),
    );
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
        setMessages((value) => value.filter((message) => message.id !== key && message.id !== assistantId));
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
        setMessages((value) =>
          value.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + delta, status: "streaming" }
              : message,
          ),
        );
      }

      setMessages((value) =>
        value.map((message) =>
          message.id === assistantId ? { ...message, status: "complete" } : message,
        ),
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages((value) =>
          value.map((message) =>
            message.id === assistantId ? { ...message, status: "interrupted" } : message,
          ),
        );
      } else {
        setError(caught instanceof Error ? caught.message : "Generation failed.");
        setMessages((value) => value.filter((message) => message.id !== assistantId));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  function handleKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && preferences.enter_to_send) {
      event.preventDefault();
      void send();
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.currentTarget.scrollTop <= 0 && !streaming && !refreshing) {
      touchStartY.current = event.touches[0]?.clientY ?? null;
      pullDistanceRef.current = 0;
    } else {
      touchStartY.current = null;
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartY.current === null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;
    const distance = Math.max(0, Math.min(100, currentY - touchStartY.current));
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  }

  function handleTouchEnd() {
    const shouldRefresh = pullDistanceRef.current >= 72;
    touchStartY.current = null;
    if (shouldRefresh) void refreshMessages(true);
    else {
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  }

  const pullVisible = pullDistance > 8 || refreshing;
  const pullReady = pullDistance >= 72;

  return (
    <main className="chat-page">
      <OfflineBanner />
      <header className="chat-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>{id ? "Conversation" : "New chat"}</h2>
        </div>
        <button
          className={"chat-refresh-button" + (refreshing ? " is-refreshing" : "")}
          type="button"
          onClick={() => void refreshMessages(true)}
          disabled={refreshing || streaming}
          aria-label="Refresh conversation"
          title="Refresh conversation"
        >
          <OzlindIcon name="i-refresh" size={15} />
          <span>{refreshing ? "Refreshing" : "Refresh"}</span>
        </button>
      </header>

      <div
        ref={scrollRef}
        className="message-list"
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollTop + element.clientHeight >= element.scrollHeight - 40;
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
      >
        <button
          className={
            "pull-refresh-indicator" +
            (pullVisible ? " is-visible" : "") +
            (pullReady ? " is-ready" : "") +
            (refreshing ? " is-refreshing" : "")
          }
          type="button"
          disabled={!pullReady || refreshing || streaming}
          onClick={() => void refreshMessages(true)}
          style={{ top: Math.min(70, pullDistance * 0.55) + 8 }}
          aria-label={refreshing ? "Refreshing conversation" : "Release to refresh conversation"}
        >
          <OzlindIcon name="i-refresh" size={14} />
          <span>{refreshing ? "Refreshing…" : pullReady ? "Release to refresh" : "Pull down to refresh"}</span>
        </button>

        <div className="message-column">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <span className="empty-chat-mark" aria-hidden="true">
                <OzlindIcon name="ozl-mark" size={42} />
              </span>
              <h1>What’s on your mind?</h1>
              <p>A thoughtful space to explore ideas, solve problems, and make progress.</p>
              <div className="prompt-grid">
                <button type="button" onClick={() => setDraft("Help me plan my week.")}>
                  Plan my week
                </button>
                <button type="button" onClick={() => setDraft("Explain a difficult idea simply.")}>
                  Explain an idea
                </button>
                <button type="button" onClick={() => setDraft("Help me write something clearly.")}>
                  Write with me
                </button>
                <button type="button" onClick={() => setDraft("Help me solve a problem step by step.")}>
                  Solve a problem
                </button>
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
                    Generation interrupted.{" "}
                    <button
                      type="button"
                      onClick={() =>
                        void send(
                          "regenerate",
                          messages.filter((item) => item.role === "user").at(-1)?.content,
                        )
                      }
                    >
                      Continue
                    </button>
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
          <button type="button" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <div className="composer-wrap">
        <div className="composer">
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            aria-label="AI model"
          >
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
          />
          <Button
            className="send-button"
            disabled={!online}
            onClick={() => (streaming ? abortRef.current?.abort() : void send())}
            aria-label={streaming ? "Stop generation" : "Send message"}
            title={streaming ? "Stop generation" : "Send message"}
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
        <p className="composer-note">Ozlind can make mistakes. Verify important information.</p>
      </div>
    </main>
  );
}
