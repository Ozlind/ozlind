import { create } from "zustand";
import type { ChatMode } from "@/types/chat";
import type { UserProfile } from "@/types/user";

interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  accountOpen: boolean;
  accountSection: string | null;
  modeOpen: boolean;
  historySearch: string;
  notice: string;
  error: string;
  copiedMessageId: string | null;
  selectedFile: File | null;
  accountUser: UserProfile | null;
  loggingOut: boolean;
  darkMode: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  setSettingsOpen: (open: boolean) => void;
  setAccountOpen: (open: boolean) => void;
  setAccountSection: (section: string | null) => void;
  setModeOpen: (open: boolean) => void;

  setHistorySearch: (search: string) => void;
  setNotice: (notice: string) => void;
  setError: (error: string) => void;
  setCopiedMessageId: (id: string | null) => void;
  setSelectedFile: (file: File | null) => void;
  setAccountUser: (user: UserProfile | null) => void;
  setLoggingOut: (loggingOut: boolean) => void;

  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;

  resetTransientState: () => void;
}

const INITIAL_UI_STATE = {
  sidebarOpen: false,
  settingsOpen: false,
  accountOpen: false,
  accountSection: null,
  modeOpen: false,
  historySearch: "",
  notice: "",
  error: "",
  copiedMessageId: null,
  selectedFile: null,
  accountUser: null,
  loggingOut: false,
  darkMode: false,
};

export const useUIStore = create<UIState>((set) => ({
  ...INITIAL_UI_STATE,

  setSidebarOpen: (sidebarOpen) => {
    set({ sidebarOpen });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSettingsOpen: (settingsOpen) => {
    set({ settingsOpen });
  },

  setAccountOpen: (accountOpen) => {
    set({ accountOpen });
  },

  setAccountSection: (accountSection) => {
    set({ accountSection });
  },

  setModeOpen: (modeOpen) => {
    set({ modeOpen });
  },

  setHistorySearch: (historySearch) => {
    set({ historySearch });
  },

  setNotice: (notice) => {
    set({ notice });
  },

  setError: (error) => {
    set({ error });
  },

  setCopiedMessageId: (copiedMessageId) => {
    set({ copiedMessageId });
  },

  setSelectedFile: (selectedFile) => {
    set({ selectedFile });
  },

  setAccountUser: (accountUser) => {
    set({ accountUser });
  },

  setLoggingOut: (loggingOut) => {
    set({ loggingOut });
  },

  setDarkMode: (darkMode) => {
    set({ darkMode });
  },

  toggleDarkMode: () => {
    set((state) => ({ darkMode: !state.darkMode }));
  },

  resetTransientState: () => {
    set({
      sidebarOpen: false,
      settingsOpen: false,
      accountOpen: false,
      accountSection: null,
      modeOpen: false,
      historySearch: "",
      notice: "",
      error: "",
      copiedMessageId: null,
      selectedFile: null,
      loggingOut: false,
    });
  },
}));