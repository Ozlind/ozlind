import type { ChatMode } from "@/types/chat";

export type ModeIconName = "sparkles" | "zap" | "brain-circuit" | "telescope";

interface ModeDefinition {
  id: ChatMode;
  label: string;
  description: string;
  iconName: ModeIconName;
}

export const MODES: readonly ModeDefinition[] = [
  {
    id: "auto",
    label: "Balanced",
    description: "Balanced handling for general tasks",
    iconName: "sparkles",
  },
  {
    id: "fast",
    label: "Fast",
    description: "Quick answers for everyday tasks",
    iconName: "zap",
  },
  {
    id: "pro",
    label: "Pro",
    description: "Deeper reasoning for complex tasks",
    iconName: "brain-circuit",
  },
  {
    id: "vision",
    label: "Vision",
    description: "Understand images and visual files",
    iconName: "telescope",
  },
];