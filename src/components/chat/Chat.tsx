"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Volume2, VolumeX } from "lucide-react";
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
import { trackAnalyticsEvent } from "@/lib/analytics";

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
type ChatPreset = { id: string; name: string; system_prompt: string; model: string };

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal?: boolean; 0?: { transcript: string } }>;
};
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  continuous: boolean;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

const STARTER_PROMPTS = [
  { label: "Explain simply", prompt: "Explain this topic in simple language, step by step, with an example: " },
  { label: "Write something", prompt: "Help me write a clear, polished draft for this purpose: " },
  { label: "Brainstorm ideas", prompt: "Brainstorm several creative, practical ideas for: " },
  { label: "Debug code", prompt: "Help me debug this code or error. Explain the root cause and safest fix: " },
  { label: "Research a topic", prompt: "Research this topic, compare reliable sources, and cite the sources you use: " },
  { label: "Make a plan", prompt: "Create a realistic step-by-step plan for achieving this goal: " },
] as const;

const PENDING_PRESET_KEY = "ozlind:pending-preset";
const PRESET_MODELS = [
  "groq:llama-3.3-70b-versatile",
  "groq:deepseek-r1-distill-llama-70b",
  "google:gemini-2.0-flash",
] as const;

function isChatPreset(value: unknown): value is ChatPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Partial<ChatPreset>;
  return typeof preset.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(preset.id)
    && typeof preset.name === "string" && preset.name.length > 0 && preset.name.length <= 80
    && typeof preset.system_prompt === "string" && preset.system_prompt.length <= 12000
    && typeof preset.model === "string" && (PRESET_MODELS as readonly string[]).includes(preset.model);
}

function maleVoiceByPrefix(voices: SpeechSynthesisVoice[], languagePrefix: string): SpeechSynthesisVoice | undefined {
  return voices.find(candidate =>
    candidate.lang.toLowerCase().startsWith(languagePrefix)
    && /\bmale\b|\bman\b|masculine/i.test(candidate.name),
  );
}

function modeForModel(model: string): ChatMode {
  if (model === "groq:deepseek-r1-distill-llama-70b") return "pro";
  if (model === "google:gemini-2.0-flash") return "vision";
  if (model === "groq:llama-3.3-70b-versatile") return "fast";
  return "auto";
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
  const [activePreset, setActivePreset] = useState<ChatPreset | null>(null);
  const [presetSelectionDirty, setPresetSelectionDirty] = useState(false);
  const [clearingPreset, setClearingPreset] = useState(false);
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
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceModeRef = useRef(false);
  const streamingRef = useRef(false);
  const speakingRef = useRef(false);
  const voiceSessionRef = useRef(false);
  const startVoiceRecognitionRef = useRef<(() => void) | null>(null);
  const lastSpokenMessageId = useRef<string | null>(null);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const applyPreset = useCallback((preset: ChatPreset) => {
    setActivePreset(preset);
    setModel(preset.model);
    setMode(modeForModel(preset.model));
    setPresetSelectionDirty(true);
    setError("");
  }, []);

  useEffect(() => setId(initialId), [initialId]);

  // Recover unfinished prompts only in this browser tab; never send drafts to analytics or a server.
  useEffect(() => {
    const key = "ozlind:draft:" + (id ?? "new");
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && !draft) setDraft(saved.slice(0, 20000));
    } catch {
      // Draft recovery is optional when browser storage is unavailable.
    }
  // Read a draft only when the conversation changes, not on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const key = "ozlind:draft:" + (id ?? "new");
    try {
      if (draft) sessionStorage.setItem(key, draft.slice(0, 20000));
      else sessionStorage.removeItem(key);
    } catch {
      // The composer remains usable if session storage is disabled.
    }
  }, [draft, id]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (streamingRef.current) {
          event.preventDefault();
          abortRef.current?.abort();
          return;
        }
        if (speakingRef.current && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          speakingRef.current = false;
          setSpeakingMessageId(null);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (event.isComposing || event.repeat) return;
        event.preventDefault();
        if (streamingRef.current) abortRef.current?.abort();
        else void send();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  });

  useEffect(() => {
    if (activePreset || presetSelectionDirty) return;
    setModel(preferences.default_model);
    setMode(preferences.default_model === "groq:deepseek-r1-distill-llama-70b" ? "pro" :
      preferences.default_model === "google:gemini-2.0-flash" ? "vision" : "auto");
  }, [preferences.default_model, activePreset, presetSelectionDirty]);

  useEffect(() => {
    const applyEventPreset = (event: Event) => {
      const preset = (event as CustomEvent<unknown>).detail;
      if (!isChatPreset(preset)) {
        setError("That preset could not be loaded. Open Workspace and choose it again.");
        return;
      }
      try { sessionStorage.removeItem(PENDING_PRESET_KEY); } catch { /* Optional browser storage. */ }
      applyPreset(preset);
    };

    window.addEventListener("ozlind:apply-preset", applyEventPreset);
    try {
      const pending = sessionStorage.getItem(PENDING_PRESET_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_PRESET_KEY);
        const parsed: unknown = JSON.parse(pending);
        if (isChatPreset(parsed)) applyPreset(parsed);
        else setError("That preset could not be loaded. Open Workspace and choose it again.");
      }
    } catch {
      setError("Could not load the saved preset in this browser. Please choose it again from Workspace.");
    }

    return () => window.removeEventListener("ozlind:apply-preset", applyEventPreset);
  }, [applyPreset]);

  useEffect(() => {
    if (!id || presetSelectionDirty) return;
    let live = true;

    (async () => {
      try {
        const supabase = createClient();
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("preset_id")
          .eq("id", id)
          .maybeSingle();
        if (!live || conversationError) return;

        if (!conversation?.preset_id) {
          setActivePreset(null);
          return;
        }

        const { data: preset, error: presetError } = await supabase
          .from("presets")
          .select("id,name,system_prompt,model")
          .eq("id", conversation.preset_id)
          .maybeSingle();
        if (!live || presetError) return;

        if (preset && isChatPreset(preset)) {
          setActivePreset(preset);
          setModel(preset.model);
          setMode(modeForModel(preset.model));
        } else {
          setActivePreset(null);
        }
      } catch {
        if (live) setError("Could not load this conversation’s saved preset.");
      }
    })();

    return () => { live = false; };
  }, [id, presetSelectionDirty]);

  useEffect(() => {
    if (!previewImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewImage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

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

  useEffect(() => {
    const speechWindow = window as SpeechRecognitionWindow;
    setVoiceInputSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speakMessage = useCallback((message: Message) => {
    if (!("speechSynthesis" in window) || !message.content.trim()) {
      setError("Voice playback is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const spokenText = message.content
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/!?\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/[#>*_~`]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!spokenText) return;
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    const voices = synthesis.getVoices();
    const hasMalayalamText = /[\u0D00-\u0D7F]/.test(spokenText);
    const requestedLanguage = hasMalayalamText ? "ml-IN" : (navigator.language || "en-US");
    // Prefer a voice whose provider-supplied name explicitly identifies it as male.
    // SpeechSynthesisVoice has no standard gender field, so this is best-effort only.
    const maleVoice = (language: string) => voices.find(candidate =>
      candidate.lang.toLowerCase() === language.toLowerCase()
      && /\bmale\b|\bman\b|masculine/i.test(candidate.name),
    );
    const languagePrefix = requestedLanguage.split("-")[0].toLowerCase() + "-";
    const voice = maleVoice(requestedLanguage)
      ?? voices.find(candidate => candidate.lang.toLowerCase() === requestedLanguage.toLowerCase())
      ?? maleVoiceByPrefix(voices, languagePrefix)
      ?? voices.find(candidate => candidate.lang.toLowerCase().startsWith(languagePrefix))
      ?? (!hasMalayalamText ? maleVoiceByPrefix(voices, "en-") : undefined)
      ?? (!hasMalayalamText ? voices.find(candidate => candidate.lang.toLowerCase().startsWith("en-")) : undefined)
      ?? voices[0];
    // Do not force the phone's UI locale onto unrelated text (e.g. English
    // answers on a Malayalam-configured phone); some Android TTS engines then stay silent.
    utterance.lang = voice?.lang || requestedLanguage;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { speakingRef.current = true; setSpeakingMessageId(message.id); };
    utterance.onend = () => {
      speakingRef.current = false;
      setSpeakingMessageId(current => current === message.id ? null : current);
      if (voiceModeRef.current && voiceSessionRef.current) window.setTimeout(() => startVoiceRecognitionRef.current?.(), 350);
    };
    utterance.onerror = event => {
      speakingRef.current = false;
      setSpeakingMessageId(current => current === message.id ? null : current);
      if (event.error !== "interrupted" && event.error !== "canceled") {
        setError("Speech playback failed. Check your phone's text-to-speech settings or try Read aloud again.");
      }
      if (voiceModeRef.current && voiceSessionRef.current) window.setTimeout(() => startVoiceRecognitionRef.current?.(), 350);
    };
    synthesis.resume();
    synthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!voiceMode) return;
    const latest = [...messages].reverse().find(message =>
      message.role === "assistant" && message.status === "complete" && message.content.trim(),
    );
    if (latest && lastSpokenMessageId.current !== latest.id) {
      lastSpokenMessageId.current = latest.id;
      speakMessage(latest);
    }
  }, [messages, voiceMode, speakMessage]);

  const startVoiceRecognition = useCallback(() => {
    if (!voiceSessionRef.current || streamingRef.current || speakingRef.current || voiceListening) return;
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported in this browser. Try the latest Chrome browser.");
      voiceSessionRef.current = false;
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = navigator.language || "en-US";
      // Android Chrome is more reliable with one utterance per recognition session.
      // Voice chat explicitly restarts after each completed turn in onend.
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        const transcript: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result?.[0]?.transcript && result.isFinal !== false) transcript.push(result[0].transcript);
        }
        const text = transcript.join(" ").trim();
        if (!text) return;
        if (voiceModeRef.current) {
          recognition.stop();
          void send("send", text);
        } else {
          setDraft(current => current.trim() ? current.trimEnd() + " " + text : text);
        }
      };
      recognition.onerror = event => {
        setVoiceListening(false);
        if (event.error === "no-speech") {
          if (!voiceModeRef.current) setError("No speech detected. Tap the microphone and speak clearly.");
          return;
        }
        if (event.error === "aborted") return;
        const message = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone permission was denied. Allow microphone access for ozlind.vercel.app in Chrome site settings."
          : event.error === "network"
            ? "Browser speech recognition could not reach its speech service. Check your internet connection and try again."
            : "Voice input stopped (" + event.error + "). Try again or use text input.";
        setError(message);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          voiceSessionRef.current = false;
          setVoiceMode(false);
          voiceModeRef.current = false;
        }
      };
      recognition.onend = () => {
        setVoiceListening(false);
        if (voiceModeRef.current && voiceSessionRef.current && !streamingRef.current && !speakingRef.current) {
          window.setTimeout(() => startVoiceRecognitionRef.current?.(), 350);
        }
      };
      recognitionRef.current = recognition;
      setError("");
      setVoiceListening(true);
      recognition.start();
    } catch {
      setVoiceListening(false);
      setError("Could not start the microphone. Check browser permission and try again.");
    }
  }, [voiceListening]);

  useEffect(() => { startVoiceRecognitionRef.current = startVoiceRecognition; }, [startVoiceRecognition]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  useEffect(() => { speakingRef.current = Boolean(speakingMessageId); }, [speakingMessageId]);

  function toggleVoiceInput() {
    if (voiceSessionRef.current) {
      voiceSessionRef.current = false;
      recognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    // Keep the control actionable even in browsers without Web Speech support:
    // startVoiceRecognition reports the precise limitation instead of a dead button.
    voiceSessionRef.current = true;
    startVoiceRecognition();
  }

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
    streamingRef.current = true;
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const analyticsStartedAt = Date.now();
    let analyticsStatusCode = 0;
    let analyticsResult: "success" | "failed" | "aborted" | "duplicate" = "failed";
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
          ...(presetSelectionDirty ? { presetId: activePreset?.id ?? null } : {}),
          research: researchEnabled,
          images: outgoingImages.map(({ dataUrl, mimeType }) => ({ dataUrl, mimeType })),
        }),
        signal: controller.signal,
      });

      analyticsStatusCode = response.status;
      if (response.status === 204) {
        analyticsResult = "duplicate";
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
        setPresetSelectionDirty(false);
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
      analyticsResult = "success";
    } catch (caught) {
      analyticsResult = controller.signal.aborted ? "aborted" : "failed";
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
      trackAnalyticsEvent("ozlind_ai_request_completed", {
        action,
        model_mode: mode,
        has_attachments: outgoingImages.length > 0,
        status_code: analyticsStatusCode,
        duration_ms: Math.max(0, Date.now() - analyticsStartedAt),
        result: analyticsResult,
        used_web_search: researchEnabled,
      });
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  }

  async function clearActivePreset() {
    if (!activePreset || streaming || clearingPreset) return;
    setClearingPreset(true);
    setError("");
    try {
      if (id) {
        const supabase = createClient();
        const { data, error: updateError } = await supabase
          .from("conversations")
          .update({ preset_id: null })
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (updateError || !data) throw updateError ?? new Error("Conversation was not found.");
      }
      setActivePreset(null);
      setPresetSelectionDirty(true);
    } catch {
      setError("Could not remove this preset from the conversation. Please try again.");
    } finally {
      setClearingPreset(false);
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
        <div className="chat-title-group">
          <h2>Ozlind</h2>
          {activePreset && (
            <span className="active-preset-chip">
              <OzlindIcon name="i-bookmark" size={13} aria-hidden="true" />
              <span title={activePreset.name}>{activePreset.name}</span>
              <button type="button" onClick={() => void clearActivePreset()} disabled={streaming || clearingPreset} aria-label={"Remove preset " + activePreset.name} title="Remove this preset from the conversation">
                <OzlindIcon name="i-close" size={12} />
              </button>
            </span>
          )}
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
              <div className="starter-prompts" aria-label="Start with an example">
                {STARTER_PROMPTS.map((starter) => (
                  <button
                    type="button"
                    key={starter.label}
                    className="starter-prompt"
                    onClick={() => {
                      setDraft(starter.prompt);
                      textareaRef.current?.focus();
                    }}
                    disabled={streaming}
                  >
                    <span>{starter.label}</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
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
                      {message.research ? "Searching the web…" : "Thinking…"}
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
                      <span
                        className="sr-only"
                        role="note"
                        title={message.providerModel ? "Provider model: " + message.providerModel : "Logical model: " + message.model}
                        aria-label={"Logical model: " + message.model + ". Provider model: " + (message.providerModel ?? message.model) + ". Research sources: " + (message.researchSources ?? 0)}
                      >
                        Response model details.
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
                    <button
                      type="button"
                      className="message-action"
                      onClick={() => {
                        if (speakingMessageId === message.id) {
                          window.speechSynthesis.cancel();
                          setSpeakingMessageId(null);
                        } else {
                          speakMessage(message);
                        }
                      }}
                      aria-label={speakingMessageId === message.id ? "Stop reading response aloud" : "Read response aloud"}
                      title={speakingMessageId === message.id ? "Stop reading aloud" : "Read aloud"}
                    >
                      {speakingMessageId === message.id ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                      {speakingMessageId === message.id ? "Stop voice" : "Read aloud"}
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

      {voiceMode && (
        <section
          className={"voice-orb-panel voice-orb-stage" + (speakingMessageId ? " is-speaking" : streaming ? " is-thinking" : voiceListening ? " is-listening" : "")}
          role="status"
          aria-live="polite"
          aria-label="Voice conversation"
        >
          <div className="voice-orb-visual" aria-hidden="true">
            <span className="voice-orb-ring voice-orb-ring-one" />
            <span className="voice-orb-ring voice-orb-ring-two" />
            <span className="voice-orb-ring voice-orb-ring-three" />
            <span className="voice-orb"><span /></span>
          </div>
          <div className="voice-orb-text">
            <span className="voice-orb-copy">{streaming ? "Ozlind is thinking…" : speakingMessageId ? "Ozlind is speaking…" : voiceListening ? "I’m listening" : "Voice chat ready"}</span>
            <span className="voice-orb-caption">{streaming ? "Putting a response together" : speakingMessageId ? "Listen, then speak whenever you’re ready" : voiceListening ? "Speak naturally. I’m here." : "Your microphone is ready"}</span>
          </div>
          <button type="button" className="voice-orb-stop" onClick={() => { voiceSessionRef.current = false; recognitionRef.current?.stop(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); speakingRef.current = false; setSpeakingMessageId(null); setVoiceMode(false); voiceModeRef.current = false; }} aria-label="End voice chat">End</button>
        </section>
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
            className={"composer-research" + (voiceMode ? " active" : "")}
            aria-pressed={voiceMode}
            onClick={() => {
              const nextVoiceMode = !voiceMode;
              voiceModeRef.current = nextVoiceMode;
              if (!nextVoiceMode) {
                voiceSessionRef.current = false;
                recognitionRef.current?.stop();
              } else {
                const latest = [...messages].reverse().find(message => message.role === "assistant" && message.status === "complete");
                lastSpokenMessageId.current = latest?.id ?? null;
                // Start microphone recognition directly from the user's tap so
                // mobile browsers retain the permission/user-activation gesture.
                voiceSessionRef.current = true;
              }
              setVoiceMode(nextVoiceMode);
              if (nextVoiceMode) startVoiceRecognition();
              if (voiceMode && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                speakingRef.current = false;
                setSpeakingMessageId(null);
              }
            }}
            title={voiceMode ? "Turn voice replies off" : "Automatically read new replies aloud"}
            aria-label={voiceMode ? "Turn voice replies off" : "Turn voice replies on"}
          >
            {voiceMode ? <Volume2 size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
            <span>{voiceMode ? "Voice on" : "Voice"}</span>
          </button>
          <button
            type="button"
            className={"composer-mode" + (mode !== "auto" ? " active" : "")}
            aria-expanded={showModeOptions}
            aria-controls="composer-mode-options"
            aria-label={"Response mode: " + (mode === "auto" ? "Auto" : mode === "fast" ? "Fast" : mode === "vision" ? "Vision" : "Pro")}
            title="Choose a response mode"
            onClick={() => setShowModeOptions(current => !current)}
          >
            <OzlindIcon name="i-ai-chat" size={15} />
            <span>{mode === "auto" ? "Auto" : mode === "fast" ? "Fast" : mode === "vision" ? "Vision" : "Pro"}</span>
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
                ["auto", "Auto", "Use the saved default model with automatic provider fallback"],
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
                  {value === "auto" ? <OzlindIcon name="i-ai-chat" size={15} /> :
                   value === "fast" ? <OzlindIcon name="sym-active" size={15} /> :
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
          <button
            type="button"
            className="composer-attach composer-mic"
            onClick={toggleVoiceInput}
            disabled={streaming || !online}
            aria-label={voiceListening ? "Stop voice input" : "Start voice input"}
            aria-pressed={voiceListening}
            title={!voiceInputSupported ? "Voice input may be unavailable in this browser; tap for details" : voiceListening ? "Listening… tap to stop" : "Dictate a message"}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
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
          <p className="composer-shortcut-hint">Ctrl/⌘ + Enter to send · Esc to stop</p>
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
