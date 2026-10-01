import { create } from "zustand";
import type { Conversation, Message } from "@/types/chat";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  error: string | null;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (
    id: string,
    updates: Partial<Pick<Conversation, "title" | "updatedAt" | "messages">>,
  ) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;

  setConversationMessages: (id: string, messages: Message[]) => void;
  appendMessage: (id: string, message: Message) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updates: Partial<Message>,
  ) => void;

  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  resetChat: () => void;
}

const INITIAL_CHAT_STATE = {
  conversations: [] as Conversation[],
  activeConversationId: null,
  isStreaming: false,
  error: null,
};

export const useChatStore = create<ChatState>((set) => ({
  ...INITIAL_CHAT_STATE,

  setConversations: (conversations) => {
    set({ conversations });
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
      error: null,
    }));
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id
          ? { ...conversation, ...updates }
          : conversation,
      ),
    }));
  },

  removeConversation: (id) => {
    set((state) => {
      const remaining = state.conversations.filter(
        (conversation) => conversation.id !== id,
      );

      const nextActiveId =
        state.activeConversationId === id
          ? (remaining[0]?.id ?? null)
          : state.activeConversationId;

      return {
        conversations: remaining,
        activeConversationId: nextActiveId,
      };
    });
  },

  setActiveConversation: (id) => {
    set({
      activeConversationId: id,
      error: null,
    });
  },

  setConversationMessages: (id, messages) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages,
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    }));
  },

  appendMessage: (id, message) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages: [...conversation.messages, message],
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    }));
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId
                  ? { ...message, ...updates }
                  : message,
              ),
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    }));
  },

  setStreaming: (isStreaming) => {
    set({ isStreaming });
  },

  setError: (error) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  resetChat: () => {
    set(INITIAL_CHAT_STATE);
  },
}));