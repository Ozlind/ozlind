import type { AppSettings } from "@/types/chat";

export const DEFAULT_SETTINGS: AppSettings = {
  research: false,
  memory: true,
  responseStyle: "balanced",
  responseLength: "medium",
  customInstructions: "",
};