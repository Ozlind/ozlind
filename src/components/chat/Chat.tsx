"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { OfflineBanner } from "@/components/chat/OfflineBanner";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { usePreferences } from "@/hooks/usePreferences";
import { OzlindIcon } from "@/components/ui/OzlindIcon";
import { deleteMessageImages, loadMessageImages, PENDING_CONVERSATION_ID, saveMessageImages, savePendingMessageImages } from "@/lib/chat/image-persistence";
import { shouldFlushVisibleText } from "@/lib/chat/streaming.mjs";
import { appendOrReplaceLatestAssistant } from "@/lib/chat/message-state.mjs";
import { ChatUtilities } from "@/components/chat/ChatUtilities";
import { SaveResponseButton } from "@/components/chat/SaveResponseButton";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  idempotency_key?: string | null;
  model?: string | null;
  providerModel?: string | null;
  research?: boolean;
  researchSources?: number;
  images?: ChatImage[];
};

type StoredMessage = Message & { provider_model?: string | null };

type ChatMode = "auto" | "fast" | "vision" | "pro";
type ChatImage = { dataUrl: string; mimeType: "image/jpeg"; name: string };

function modelLabel(model?: string | null): string {
  switch (model) {
    case "groq:llama-3.3-70b-versatile": return "Fast model";
    case "groq:deepseek-r1-distill-llama-70b": return "Pro model";
    case "google:gemini-2.0-flash": return "Vision model";
    default: return "Ozlind model";
  }
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
  const [previewImage, setPreviewImage] = useState<ChatImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [online, setOnline] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setId(initialId), [initialId]);

  useEffect(() => {
    if (!previewImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewImage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);
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
          .select("id,role,content,status,idempotency_key,model,provider_model")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        if (!live) return;
        if (queryError) {
          setHistoryError("Your conversation history could not be loaded.");
          return;
        }
        const loadedMessages = (data ?? []) as StoredMessage[];
        const hydratedMessages = await Promise.all(loadedMessages.map(async (storedMessage) => {
          const { provider_model: providerModel, ...message } = storedMessage;
          const messageKey = message.role === "user" && message.idempotency_key
            ? message.idempotency_key
            : message.id;
          const storedImages = message.role === "user"
            ? await loadMessageImages(id, messageKey).catch(() => [])
            : [];
          return {
            ...message,
            ...(providerModel ? { providerModel } : {}),
            // Image bytes stay in this browser's IndexedDB; the message text and
            // conversation history remain in Supabase as before.
            ...(storedImages.length ? { images: storedImages } : {}),
            // Keep an optimistic user bubble's identity stable after the DB reload.
            id: messageKey,
          };
        }));
        if (live) setMessages(hydratedMessages);
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

  async function send(action: "send" | "regenerate" = "send", contentOverride?: string, imagesOverride?: ChatImage[]) {
    const content = (contentOverride ?? draft).trim();
    const outgoingImages = action === "send" ? images : (imagesOverride ?? []);
    const outgoingContent = content || (outgoingImages.length ? "Please analyze the attached image." : "");
    if ((action === "send" && !outgoingContent) || streaming || !online) return;

    if (action === "send") {
      setDraft("");
      setImages([]);
    }
    setError("");
    const key = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    // Persist every image before network I/O. For a new chat, keep it under
    // a pending key until the API returns the conversation ID.
    if (action === "send" && outgoingImages.length) {
      if (id) {
        await saveMessageImages(id, key, outgoingImages).catch(() => {
          setError("The image was sent, but its local preview could not be saved. It may not remain after refresh.");
        });
      } else {
        await savePendingMessageImages(key, outgoingImages).catch(() => {
          setError("The image was sent, but its local preview could not be saved. It may not remain after refresh.");
        });
      }
    }

    if (action === "send") {
      setMessages((current) => current.concat({ id: key, role: "user", content: outgoingContent, status: "complete", idempotency_key: key, images: outgoingImages }));
    }
    // A retry/regeneration replaces the previous answer to this turn in-place.
    // Appending here left the old partial answer visible beside the new one.
    setMessages((current) => appendOrReplaceLatestAssistant(
      current,
      { id: assistantId, role: "assistant", content: "", status: "streaming" },
      action === "regenerate",
    ));
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let requestErrorCode: string | null = null;
    let requestAccepted = false;
    let receivedAssistantText = false;
    // Keep buffered text outside try so a stream failure cannot discard it.
    let pendingText = "";
    let lastUiFlush = 0;

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
        requestErrorCode = typeof body?.error?.code === "string" ? body.error.code : null;
        if (body?.error?.code === "AUTH_REQUIRED") router.replace("/login");
        throw new Error(body?.error?.message || "Ozlind could not generate a response.");
      }

      // A successful streaming response means the server has accepted and
      // persisted the user's prompt; do not duplicate it in the composer.
      requestAccepted = true;
      const responseModel = response.headers.get("X-OZLIND-Model") || requestedModel;
      const responseProviderModel = response.headers.get("X-OZLIND-Provider-Model");
      const researchUsed = response.headers.get("X-OZLIND-Research") === "1";
      const parsedSourceCount = Number(response.headers.get("X-OZLIND-Research-Sources"));
      const researchSources = Number.isFinite(parsedSourceCount) ? Math.max(0, parsedSourceCount) : 0;
      setMessages((current) => current.map((message) => message.id === assistantId
        ? {
            ...message,
            model: responseModel,
            providerModel: responseProviderModel,
            research: researchUsed,
            researchSources,
          }
        : message));
      const nextId = response.headers.get("X-OZLIND-Conversation-ID");
      if (!id && nextId) {
        // A brand-new conversation receives its ID only after the API accepts it.
        if (outgoingImages.length) {
          let imageSavedForConversation = true;
          await saveMessageImages(nextId, key, outgoingImages).catch(() => {
            imageSavedForConversation = false;
            setError("The image was sent, but its local preview could not be saved. It may not remain after refresh.");
          });
          // Keep the pending copy if migration fails so history can recover it later.
          if (imageSavedForConversation) {
            await deleteMessageImages(PENDING_CONVERSATION_ID, key).catch(() => undefined);
          }
        }
        setId(nextId);
        router.replace("/app/" + nextId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming response unavailable.");

      const decoder = new TextDecoder();
      const flushVisibleText = (force = false) => {
        if (!shouldFlushVisibleText(pendingText, Date.now(), lastUiFlush, force)) return;
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
        if (part.value.byteLength > 0) receivedAssistantText = true;
        // Batch tiny deltas to avoid rendering every token while keeping streaming responsive.
        flushVisibleText();
      }

      pendingText += decoder.decode();
      flushVisibleText(true);
      setMessages((current) =>
        current.map((message) => (message.id === assistantId ? { ...message, status: "complete" } : message)),
      );
    } catch (caught) {
      const trailingText = pendingText;
      pendingText = "";
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : "Generation failed.");
        const promptWasPersisted =
          requestAccepted ||
          receivedAssistantText ||
          ["HISTORY_LOAD_FAILED", "ASSISTANT_CREATE_FAILED", "AI_PROVIDER_UNAVAILABLE"].includes(requestErrorCode ?? "");
        if (action === "send" && !promptWasPersisted) {
          setDraft((current) => (current.trim() ? current : outgoingContent));
        }
        if (outgoingImages.length) {
          setImages((current) => current.length ? current : outgoingImages);
        }
      }
      setMessages((current) => current.map((message) => {
        if (message.id !== assistantId) return message;
        const content = message.content + trailingText;
        return { ...message, content, status: controller.signal.aborted || content ? "interrupted" : "failed" };
      }));
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
      setError("Choose an image file to attach.");
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
      // Preserve the user's selected response mode. The API safely routes
      // image-bearing requests through its multimodal model chain.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not attach this image.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Do not submit while an IME (for example, Malayalam input) is composing text.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && preferences.enter_to_send) {
      event.preventDefault();
      void send();
    }
  };

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

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
          <h2>Ozlind</h2>
        </div>
        <ChatUtilities conversationId={id} messages={messages} streaming={streaming} />
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
                <OzlindIcon name="ozl-mark" size={36} aria-hidden="true" />
              </span>
              <h1>Hi, I’m Ozlind.</h1>
              <p>What would you like to work through today? Ask a question, explore an idea, or get help with a task.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={"message " + message.role}>
                <div className="message-role">{message.role === "user" ? "You" : "Ozlind"}</div>
                <div className="message-content">
                  {message.role === "user" ? (
                    <>
                      {message.images && message.images.length > 0 && (
                        <div className="message-attachments" aria-label="Attached images">
                          {message.images.map((image, index) => (
                            <button type="button" className="message-attachment-preview" onClick={() => setPreviewImage(image)} key={image.name + index} aria-label={"Enlarge attached image: " + image.name}>
                              <Image src={image.dataUrl} alt={image.name || "Attached image"} width={360} height={260} unoptimized />
                              <span className="image-preview-hint">Tap to enlarge</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {message.content && <p>{message.content}</p>}
                    </>
                  ) : message.content ? (
                    <MarkdownRenderer content={message.content} />
                  ) : message.status === "streaming" ? (
                    <div className="thinking-state" role="status">
                      <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                      {message.research ? "Searching the web…" : researchEnabled ? "Searching the web…" : "Thinking…"}
                    </div>
                  ) : message.status === "failed" ? (
                    <div className="interrupted" role="status">
                      No response was generated.
                      {lastUserMessage && (
                        <button
                          type="button"
                          onClick={() => void send("regenerate", lastUserMessage.content, lastUserMessage.images ?? [])}
                          disabled={streaming || !online}
                        >
                          Retry response
                        </button>
                      )}
                    </div>
                  ) : message.status === "interrupted" ? (
                    <div className="thinking-state" role="status">
                      The response stopped before any text was received.
                    </div>
                  ) : (
                    <MarkdownRenderer content=" " />
                  )}
                </div>
                {message.role === "assistant" && message.content && message.status !== "streaming" && (
                  <div className="message-meta" aria-label="Response details">
                    {message.model && (
                      <span title={message.providerModel ? "Provider model: " + message.providerModel : undefined}>
                        {modelLabel(message.model)}{message.providerModel ? " · " + message.providerModel : ""}
                      </span>
                    )}
                    {message.research && (
                      <span>Web search · {message.researchSources ? `${message.researchSources} sources` : "used"}</span>
                    )}
                  </div>
                )}
                {message.status === "interrupted" && (
                  <div className="interrupted" role="status">
                    Generation stopped.{" "}
                    <button
                      type="button"
                      onClick={() => lastUserMessage && void send("regenerate", lastUserMessage.content, lastUserMessage.images ?? [])}
                      disabled={streaming || !online || !lastUserMessage}
                    >
                      Retry response
                    </button>
                  </div>
                )}
                {message.role === "assistant" && message.status === "streaming" && message.content && (
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
                    <SaveResponseButton content={message.content} />
                    {message.id === lastAssistantMessageId && message.status !== "interrupted" && lastUserMessage && (
                      <button
                        type="button"
                        className="message-action"
                        onClick={() => lastUserMessage && void send("regenerate", lastUserMessage.content, lastUserMessage.images ?? [])}
                        disabled={streaming || !online}
                      >
                        <OzlindIcon name="i-regenerate" size={14} /> Regenerate
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="error-card" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><OzlindIcon name="i-close" size={16} /></button>
        </div>
      )}

      <div className="composer-wrap">
        {images.length > 0 && (
          <div className="composer-attachments" aria-label="Attached images">
            {images.map((image, index) => (
              <div className="composer-attachment" key={image.name + index}>
                <Image src={image.dataUrl} alt={image.name} width={34} height={34} unoptimized />
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
                  title={images.length > 0 && value !== "vision" ? description + " · image requests use a vision-capable model automatically" : description}
                  aria-label={label + ": " + (images.length > 0 && value !== "vision" ? description + ". Attached images use a vision-capable model automatically." : description)}
                  disabled={streaming}
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
            disabled={streaming ? false : !online || (!draft.trim() && images.length === 0)}
            onClick={() => (streaming ? abortRef.current?.abort() : void send())}
            aria-label={streaming ? "Stop response" : "Send message"}
          >
            {streaming ? (
              <>
                <OzlindIcon name="i-stop" size={18} />
                Stop
              </>
            ) : (
              <>
                <OzlindIcon name="i-arrow-up" size={20} strokeWidth={2.2} />
              </>
            )}
          </Button>
        </div>
        <div className="composer-meta">
          <p id="composer-help" className="composer-keyboard-hint">
            {preferences.enter_to_send ? "Enter to send · Shift + Enter for a new line" : "Shift + Enter for a new line · Tap Send to submit"}
          </p>
          {draft.length >= 18000 && (
            <p className="composer-counter" aria-live="polite">{draft.length.toLocaleString()} / 20,000</p>
          )}
        </div>
        <p className="composer-note">
          {!online ? "You’re offline. Reconnect to send a message." :
            images.length > 0 && researchEnabled ? "Web search is on · Images use a vision-capable model automatically." :
            images.length > 0 ? "Attached images use a vision-capable model automatically." :
            researchEnabled ? "Web search is on · Check sources and important details." :
            mode === "vision" ? "Vision mode uses Gemini · Attach up to 2 images." :
            "Ozlind can make mistakes. Check important details."}
        </p>
      </div>

      {previewImage && (
        <div className="image-lightbox" role="presentation" onClick={() => setPreviewImage(null)}>
          <div className="image-lightbox-panel" role="dialog" aria-modal="true" aria-label={"Image preview: " + previewImage.name} onClick={(event) => event.stopPropagation()}>
            <div className="image-lightbox-toolbar">
              <span>{previewImage.name || "Attached image"}</span>
              <button type="button" onClick={() => setPreviewImage(null)} aria-label="Close image preview"><OzlindIcon name="i-close" size={18} /></button>
            </div>
            <Image className="image-lightbox-image" src={previewImage.dataUrl} alt={previewImage.name || "Enlarged attached image"} width={1600} height={1200} unoptimized />
          </div>
        </div>
      )}
    </main>
  );
}
