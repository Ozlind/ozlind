import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS } from "@/constants/settings";
import { SETTINGS_KEY } from "@/constants/storage";
import type {
  AppSettings,
  ResponseLength,
  ResponseStyle,
} from "@/types/chat";

interface SettingsState extends AppSettings {
  setResearch: (enabled: boolean) => void;
  setMemory: (enabled: boolean) => void;
  setResponseStyle: (style: ResponseStyle) => void;
  setResponseLength: (length: ResponseLength) => void;
  setCustomInstructions: (instructions: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setResearch: (research) => {
        set({ research });
      },

      setMemory: (memory) => {
        set({ memory });
      },

      setResponseStyle: (responseStyle) => {
        set({ responseStyle });
      },

      setResponseLength: (responseLength) => {
        set({ responseLength });
      },

      setCustomInstructions: (customInstructions) => {
        set({ customInstructions });
      },

      updateSettings: (updates) => {
        set(updates);
      },

      resetSettings: () => {
        set(DEFAULT_SETTINGS);
      },
    }),
    {
      name: SETTINGS_KEY,
      partialize: (state): AppSettings => ({
        research: state.research,
        memory: state.memory,
        responseStyle: state.responseStyle,
        responseLength: state.responseLength,
        customInstructions: state.customInstructions,
      }),
    },
  ),
);