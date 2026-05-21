import { create } from "zustand";
import type { Message, Choice, UUID } from "@/types";
import { db } from "./database";

interface ChatState {
  /** Current chat's messages from DB (never contains streaming messages) */
  messages: Message[];
  /** All in-progress streaming messages, keyed by message ID */
  streamingMessages: Map<UUID, Message>;
  isTyping: boolean;
  typingCharacterId: UUID | null;
  /** Which chat the typing indicator belongs to */
  typingChatId: UUID | null;
  currentChoice: Choice | null;
  resolvedChoices: Choice[];
  isLoading: boolean;
  errorMessage: { text: string; showSettingsLink: boolean } | null;

  loadMessages: (chatId: UUID) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  setTyping: (characterId: UUID | null, chatId?: UUID | null) => void;
  setCurrentChoice: (choice: Choice | null) => void;
  createChoice: (choice: Choice) => Promise<void>;
  selectChoiceOption: (choiceId: UUID, optionId: UUID) => Promise<void>;
  skipChoice: (choiceId: UUID) => Promise<void>;
  archiveCurrentChoice: () => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  startStreamingMessage: (message: Message) => void;
  appendStreamChunk: (messageId: UUID, chunk: string) => void;
  finishStreaming: (messageId: UUID) => Promise<void>;
  setErrorMessage: (text: string, showSettingsLink?: boolean) => void;
  clearErrorMessage: () => void;
  deleteMessage: (messageId: UUID) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingMessages: new Map(),
  isTyping: false,
  typingCharacterId: null,
  typingChatId: null,
  currentChoice: null,
  resolvedChoices: [],
  isLoading: false,
  errorMessage: null,

  loadMessages: async (chatId) => {
    set({ isLoading: true });
    try {
      const [messages, rawChoices] = await Promise.all([
        db.listMessages(chatId),
        db.getResolvedChoices(chatId),
      ]);

      // Infer archivedAfterMessageId for choices loaded from DB
      const resolvedChoices = rawChoices.map((choice) => {
        if (choice.archivedAfterMessageId) return choice;
        if (!choice.resolvedAt) return choice;
        // Find the last message created before the choice was resolved
        const resolvedTime = new Date(choice.resolvedAt).getTime();
        let lastMsgId: string | undefined;
        for (const msg of messages) {
          if (new Date(msg.createdAt).getTime() <= resolvedTime) {
            lastMsgId = msg.id;
          }
        }
        return { ...choice, archivedAfterMessageId: lastMsgId };
      });

      set({ messages, resolvedChoices });
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

  setTyping: (characterId, chatId) =>
    set({ isTyping: characterId !== null, typingCharacterId: characterId, typingChatId: chatId ?? null }),

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
    let resolved: Choice | undefined;
    set((state) => {
      if (state.currentChoice?.id !== choiceId) return state;
      resolved = {
        ...state.currentChoice,
        selectedOptionId: optionId,
        status: "resolved" as const,
        resolvedAt: new Date().toISOString(),
      };
      return { currentChoice: resolved };
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

  archiveCurrentChoice: () => {
    set((state) => {
      if (!state.currentChoice) return state;
      // Record the last message ID so the choice renders inline
      const lastMsgId = state.messages[state.messages.length - 1]?.id;
      const archivedChoice = {
        ...state.currentChoice,
        archivedAfterMessageId: lastMsgId,
      };
      return {
        currentChoice: null,
        resolvedChoices: [...state.resolvedChoices, archivedChoice],
      };
    });
  },

  skipChoice: async (choiceId) => {
    set((state) => {
      if (state.currentChoice?.id !== choiceId) return state;
      const skippedChoice = {
        ...state.currentChoice,
        status: "skipped" as const,
        resolvedAt: new Date().toISOString(),
      };
      const lastMsgId = state.messages[state.messages.length - 1]?.id;
      return {
        currentChoice: null,
        resolvedChoices: [...state.resolvedChoices, { ...skippedChoice, archivedAfterMessageId: lastMsgId }],
      };
    });
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
    set({
      messages: [],
      currentChoice: null,
      resolvedChoices: [],
      isTyping: false,
      typingCharacterId: null,
      typingChatId: null,
      errorMessage: null,
      // streamingMessages NOT cleared — they belong to their own chats
    }),

  startStreamingMessage: (message) =>
    set((state) => {
      const emptyMsg = { ...message, content: "" };
      const newMap = new Map(state.streamingMessages);
      newMap.set(message.id, emptyMsg);
      return { streamingMessages: newMap };
    }),

  appendStreamChunk: (messageId, chunk) =>
    set((state) => {
      const msg = state.streamingMessages.get(messageId);
      if (!msg) return state;
      const newMap = new Map(state.streamingMessages);
      newMap.set(messageId, { ...msg, content: msg.content + chunk });
      return { streamingMessages: newMap };
    }),

  finishStreaming: async (messageId) => {
    const state = get();
    const msg = state.streamingMessages.get(messageId);
    if (!msg) return;

    // Remove from streaming map
    const newMap = new Map(state.streamingMessages);
    newMap.delete(messageId);
    set({ streamingMessages: newMap });

    // Only add to messages[] if it belongs to the current chat
    if (msg.chatId === state.messages[0]?.chatId || state.messages.length === 0) {
      set((s) => ({ messages: [...s.messages, msg] }));
    }

    // Persist to DB
    try {
      await db.createMessage(msg);
    } catch (e) {
      console.error("Failed to persist streamed message:", e);
    }
  },

  setErrorMessage: (text, showSettingsLink = false) =>
    set({ errorMessage: { text, showSettingsLink } }),
  clearErrorMessage: () => set({ errorMessage: null }),

  deleteMessage: async (messageId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
    try {
      await db.deleteMessage(messageId);
    } catch (e) {
      console.error("Failed to delete message:", e);
    }
  },
}));
