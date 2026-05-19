import { create } from "zustand";
import type { Message, Choice, UUID } from "@/types";
import { db } from "./database";

interface ChatState {
  messages: Message[];
  isTyping: boolean;
  typingCharacterId: UUID | null;
  currentChoice: Choice | null;
  isLoading: boolean;
  streamingMessageId: UUID | null;
  errorMessage: { text: string; showSettingsLink: boolean } | null;

  loadMessages: (chatId: UUID) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  setTyping: (characterId: UUID | null) => void;
  setCurrentChoice: (choice: Choice | null) => void;
  createChoice: (choice: Choice) => Promise<void>;
  selectChoiceOption: (choiceId: UUID, optionId: UUID) => Promise<void>;
  skipChoice: (choiceId: UUID) => Promise<void>;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  startStreamingMessage: (message: Message) => void;
  appendStreamChunk: (messageId: UUID, chunk: string) => void;
  finishStreaming: (messageId: UUID) => Promise<void>;
  setErrorMessage: (text: string, showSettingsLink?: boolean) => void;
  clearErrorMessage: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  typingCharacterId: null,
  currentChoice: null,
  isLoading: false,
  streamingMessageId: null,
  errorMessage: null,

  loadMessages: async (chatId) => {
    set({ isLoading: true });
    try {
      const messages = await db.listMessages(chatId);
      set({ messages });
    } finally {
      set({ isLoading: false });
    }
  },

  addMessage: async (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
    try {
      await db.createMessage(message);
    } catch (e) {
      console.error("Failed to persist message:", e);
    }
  },

  setTyping: (characterId) =>
    set({ isTyping: characterId !== null, typingCharacterId: characterId }),

  setCurrentChoice: (choice) => set({ currentChoice: choice }),

  createChoice: async (choice) => {
    set({ currentChoice: choice });
    try {
      await db.createChoice(
        choice,
        choice.options.map((opt) => ({
          option: { id: opt.id, label: opt.label, description: opt.description, createdAt: choice.createdAt },
          preferences: opt.characterPreferences.map((pref) => ({
            characterId: pref.characterId,
            leaning: pref.leaning,
            reason: pref.reason,
          })),
        })),
      );
    } catch (e) {
      console.error("Failed to persist choice:", e);
    }
  },

  selectChoiceOption: async (choiceId, optionId) => {
    set((state) => {
      if (state.currentChoice?.id !== choiceId) return state;
      return {
        currentChoice: {
          ...state.currentChoice,
          selectedOptionId: optionId,
          status: "resolved" as const,
          resolvedAt: new Date().toISOString(),
        },
      };
    });
    try {
      await db.updateChoice(choiceId, {
        selectedOptionId: optionId,
        status: "resolved",
        resolvedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to persist choice update:", e);
    }
  },

  skipChoice: async (choiceId) => {
    set((state) => {
      if (state.currentChoice?.id !== choiceId) return state;
      return {
        currentChoice: {
          ...state.currentChoice,
          status: "skipped" as const,
          resolvedAt: new Date().toISOString(),
        },
      };
    });
    // 延迟清除 choice，让用户看到跳过状态
    setTimeout(() => {
      set({ currentChoice: null });
    }, 300);
    try {
      await db.updateChoice(choiceId, {
        status: "skipped",
        resolvedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to persist choice skip:", e);
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () =>
    set({ messages: [], currentChoice: null, isTyping: false, typingCharacterId: null, streamingMessageId: null, errorMessage: null }),

  startStreamingMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, content: "" }],
      streamingMessageId: message.id,
    })),

  appendStreamChunk: (messageId, chunk) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + chunk } : m,
      ),
    })),

  finishStreaming: async (messageId) => {
    const state = useChatStore.getState();
    const msg = state.messages.find((m) => m.id === messageId);
    set({ streamingMessageId: null });
    if (msg) {
      try {
        await db.createMessage(msg);
      } catch (e) {
        console.error("Failed to persist streamed message:", e);
      }
    }
  },

  setErrorMessage: (text, showSettingsLink = false) =>
    set({ errorMessage: { text, showSettingsLink } }),
  clearErrorMessage: () => set({ errorMessage: null }),
}));
