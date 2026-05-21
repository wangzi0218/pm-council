import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatStore } from "../chatStore";
import type { Message } from "@/types";

// Mock database
vi.mock("../database", () => ({
  db: {
    listMessages: vi.fn().mockResolvedValue([]),
    getResolvedChoices: vi.fn().mockResolvedValue([]),
    getPendingChoice: vi.fn().mockResolvedValue(null),
    createMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

const createMockMessage = (overrides: Partial<Message> = {}): Message => ({
  id: `msg-${Date.now()}`,
  chatId: "chat-1",
  role: "user",
  content: "测试消息",
  images: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("chatStore", () => {
  beforeEach(() => {
    // Reset store state
    useChatStore.setState({
      messages: [],
      streamingMessages: new Map(),
      isTyping: false,
      typingCharacterId: null,
      typingChatId: null,
      currentChoice: null,
      resolvedChoices: [],
      isLoading: false,
      errorMessage: null,
    });
  });

  describe("addMessage", () => {
    it("adds message to messages array", async () => {
      const msg = createMockMessage({ id: "msg-1" });
      await useChatStore.getState().addMessage(msg);
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("msg-1");
    });
  });

  describe("setTyping", () => {
    it("sets typing state with character and chat", () => {
      useChatStore.getState().setTyping("char-1", "chat-1");
      const state = useChatStore.getState();
      expect(state.isTyping).toBe(true);
      expect(state.typingCharacterId).toBe("char-1");
      expect(state.typingChatId).toBe("chat-1");
    });

    it("clears typing state", () => {
      useChatStore.getState().setTyping("char-1", "chat-1");
      useChatStore.getState().setTyping(null);
      const state = useChatStore.getState();
      expect(state.isTyping).toBe(false);
      expect(state.typingCharacterId).toBeNull();
      expect(state.typingChatId).toBeNull();
    });
  });

  describe("startStreamingMessage", () => {
    it("adds empty message to streaming map", () => {
      const msg = createMockMessage({ id: "stream-1", chatId: "chat-1" });
      useChatStore.getState().startStreamingMessage(msg);
      const state = useChatStore.getState();
      expect(state.streamingMessages.size).toBe(1);
      expect(state.streamingMessages.get("stream-1")).toBeDefined();
      expect(state.streamingMessages.get("stream-1")!.content).toBe("");
    });
  });

  describe("appendStreamChunk", () => {
    it("appends chunk to streaming message", () => {
      const msg = createMockMessage({ id: "stream-1", chatId: "chat-1" });
      useChatStore.getState().startStreamingMessage(msg);
      useChatStore.getState().appendStreamChunk("stream-1", "你");
      useChatStore.getState().appendStreamChunk("stream-1", "好");
      const state = useChatStore.getState();
      expect(state.streamingMessages.get("stream-1")!.content).toBe("你好");
    });
  });

  describe("finishStreaming", () => {
    it("removes from streaming map and adds to messages", async () => {
      const msg = createMockMessage({ id: "stream-1", chatId: "chat-1" });
      useChatStore.getState().startStreamingMessage(msg);
      useChatStore.getState().appendStreamChunk("stream-1", "你好");

      await useChatStore.getState().finishStreaming("stream-1");

      const state = useChatStore.getState();
      expect(state.streamingMessages.size).toBe(0);
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe("你好");
    });
  });

  describe("clearMessages", () => {
    it("clears messages but preserves streaming", async () => {
      const msg1 = createMockMessage({ id: "msg-1" });
      await useChatStore.getState().addMessage(msg1);

      const streamMsg = createMockMessage({ id: "stream-1", chatId: "chat-other" });
      useChatStore.getState().startStreamingMessage(streamMsg);

      useChatStore.getState().clearMessages();

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(0);
      // Streaming message from different chat is preserved
      expect(state.streamingMessages.size).toBe(1);
    });
  });

  describe("archiveCurrentChoice", () => {
    it("moves current choice to resolved with archivedAfterMessageId", async () => {
      const msg = createMockMessage({ id: "msg-last" });
      await useChatStore.getState().addMessage(msg);

      const choice = {
        id: "choice-1",
        chatId: "chat-1",
        question: "测试问题",
        options: [],
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
      useChatStore.getState().setCurrentChoice(choice);
      useChatStore.getState().archiveCurrentChoice();

      const state = useChatStore.getState();
      expect(state.currentChoice).toBeNull();
      expect(state.resolvedChoices).toHaveLength(1);
      expect(state.resolvedChoices[0].archivedAfterMessageId).toBe("msg-last");
    });
  });

  describe("deleteMessage", () => {
    it("removes message from messages array", async () => {
      const msg1 = createMockMessage({ id: "msg-1" });
      const msg2 = createMockMessage({ id: "msg-2" });
      await useChatStore.getState().addMessage(msg1);
      await useChatStore.getState().addMessage(msg2);

      await useChatStore.getState().deleteMessage("msg-1");

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].id).toBe("msg-2");
    });
  });

  describe("setErrorMessage", () => {
    it("sets error message", () => {
      useChatStore.getState().setErrorMessage("出错了", true);
      const state = useChatStore.getState();
      expect(state.errorMessage).toEqual({ text: "出错了", showSettingsLink: true });
    });

    it("clears error message", () => {
      useChatStore.getState().setErrorMessage("出错了");
      useChatStore.getState().clearErrorMessage();
      expect(useChatStore.getState().errorMessage).toBeNull();
    });
  });
});
