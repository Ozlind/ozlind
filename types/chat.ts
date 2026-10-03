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