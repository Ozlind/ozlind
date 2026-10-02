export type Role = "user" | "assistant";

export type ChatMode =
  | "auto"
  | "fast"
  | "pro"
  | "vision";

export type ResponseStyle =
  | "balanced"
  | "professional"
  | "friendly"
  | "direct";

export type ResponseLength =
  | "short"
  | "medium"
  | "long";

export interface Source {
  title: string;
  url: string;
  domain: string;
  content: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;

  /** Base64 data URL. Set only for images. */
  dataUrl: string | null;

  /** Extracted file contents. Set only for text files. */
  text: string | null;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  attachment: Attachment | null;
  sources: Source[];
  streaming?: boolean;
  failed?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

/** Lightweight shape used by the sidebar. */
export type ConversationSummary = Pick<
  Conversation,
  "id" | "title" | "updatedAt"
>;

export interface AppSettings {
  research: boolean;
  memory: boolean;
  responseStyle: ResponseStyle;
  responseLength: ResponseLength;
  customInstructions: string;
}

/* ---------- API wire format ---------- */

export interface ApiTextPart {
  type: "text";
  text: string;
}

export interface ApiImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ApiContentPart =
  | ApiTextPart
  | ApiImagePart;

export interface ApiMessage {
  role: Role;
  content: string | ApiContentPart[];
}

export interface ChatRequestBody {
  messages: ApiMessage[];
  mode: ChatMode;
  research: boolean;
  memory: boolean;
  responseStyle: ResponseStyle;
  responseLength: ResponseLength;
  customInstructions: string;
}

/* ---------- SSE events ---------- */

export interface StreamReadyEvent {
  type: "ready";
}

export interface StreamNoticeEvent {
  type: "notice";
  message: string;
}

export interface StreamDeltaEvent {
  type: "delta";
  content: string;
}

export interface StreamSourcesEvent {
  type: "sources";
  sources: Source[];
}

export interface StreamMetaEvent {
  type: "meta";
  provider: string;
  model: string;
}

export interface StreamDoneEvent {
  type: "done";
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
}

export type StreamEvent =
  | StreamReadyEvent
  | StreamNoticeEvent
  | StreamDeltaEvent
  | StreamSourcesEvent
  | StreamMetaEvent
  | StreamDoneEvent
  | StreamErrorEvent;