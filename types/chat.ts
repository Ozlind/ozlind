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

export interface AppSettings {
  research: boolean;
  memory: boolean;
  responseStyle: ResponseStyle;
  responseLength: ResponseLength;
  customInstructions: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
  pinned?: boolean;
  archived?: boolean;
  folderId?: string | null;
  tags?: string[];
}

export interface Folder {
  id: string;
  name: string;
}

export type MessageFeedback = -1 | 1 | null;

export interface DocumentRecord {
  id: string;
  name: string;
  status: "processing" | "ready" | "failed";
  chunkCount: number;
  createdAt: number;
}

export type UserRole = "user" | "admin";