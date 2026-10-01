export type Role = "user" | "assistant";

export type ChatMode = "auto" | "fast" | "pro" | "vision";

export type ResponseStyle = "balanced" | "professional" | "friendly" | "direct";

export type ResponseLength = "short" | "medium" | "long";

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

/** Lightweight shape for the sidebar list; avoids loading every message. */
export type ConversationSummary = Pick<Conversation, "id" | "title" | "updatedAt">;

export interface AppSettings {
  research: boolean;
  memory: boolean;
  responseStyle: ResponseStyle;
  responseLength: ResponseLength;
  customInstructions: string;
}

/* ---------- Wire format: what /api/chat sends and receives ---------- */

export interface ApiTextPart {
  type: "text";
  text: string;
}

export interface ApiImagePart {
  type: "image_url";
  image_url: { url: string };
}

export type ApiContentPart = ApiTextPart | ApiImagePart;

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

/** Server-sent events emitted by /api/chat. A discriminated union lets
 *  `switch (event.type)` narrow the payload without casts. */
export type StreamEvent =
  | { type: "ready" }
  | { type: "notice"; message: string }
  | { type: "delta"; content: string }
  | { type: "sources"; sources: Source[] }
  | { type: "done" }
  | { type: "error"; error: string };