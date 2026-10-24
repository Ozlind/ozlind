export type UserPresetContext = {
  name: string;
  system_prompt: string;
};

export function buildPresetContext(preset: UserPresetContext | null | undefined): string;
