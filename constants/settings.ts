import type {
  AppSettings,
  ResponseLength,
  ResponseStyle,
} from "@/types/chat";

export const DEFAULT_SETTINGS: AppSettings = {
  research: false,
  memory: true,
  responseStyle: "balanced",
  responseLength: "medium",
  customInstructions: "",
};

export interface Option<T extends string> {
  value: T;
  label: string;
  description: string;
}

export const RESPONSE_STYLES: readonly Option<ResponseStyle>[] = [
  { value: "balanced", label: "Balanced", description: "Clear and approachable" },
  { value: "professional", label: "Professional", description: "Formal and precise" },
  { value: "friendly", label: "Friendly", description: "Warm and conversational" },
  { value: "direct", label: "Direct", description: "Straight to the point" },
];

export const RESPONSE_LENGTHS: readonly Option<ResponseLength>[] = [
  { value: "short", label: "Short", description: "Essential points only" },
  { value: "medium", label: "Medium", description: "Complete but never padded" },
  { value: "long", label: "Long", description: "Thorough, with examples" },
];