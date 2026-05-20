import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscussionManager } from "../discussion";
import { PM_SCENARIO } from "@/scenarios/pm-discussion";
import type { LLMSettings, Message } from "@/types";

// Mock the LLM provider
vi.mock("@/llm/factory", () => ({
  createProvider: () => ({
    chat: vi.fn().mockResolvedValue({ content: "测试回复", usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 } }),
    chatStream: vi.fn().mockImplementation(async (_req, onChunk) => {
      onChunk("测试");
      onChunk("回复");
      return { content: "测试回复", usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 } };
    }),
    testConnection: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

const mockSettings: LLMSettings = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "test-key",
  model: "gpt-4o",
};

const mockMessages: Message[] = [
  {
    id: "1",
    chatId: "chat-1",
    role: "user",
    content: "我想做一个用户反馈收集功能",
    images: [],
    createdAt: new Date().toISOString(),
  },
];

describe("DiscussionManager", () => {
  let manager: DiscussionManager;

  beforeEach(() => {
    manager = new DiscussionManager(mockSettings, PM_SCENARIO);
  });

  it("creates instance with scenario", () => {
    expect(manager).toBeDefined();
  });

  describe("processUserInput", () => {
    it("returns messages from NPCs", async () => {
      const result = await manager.processUserInput(
        "chat-1",
        "我想做一个用户反馈收集功能",
        [],
        mockMessages,
      );
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages.every((m) => m.role === "character")).toBe(true);
    });

    it("each message has correct chatId", async () => {
      const result = await manager.processUserInput(
        "chat-1",
        "测试消息",
        [],
        mockMessages,
      );
      for (const msg of result.messages) {
        expect(msg.chatId).toBe("chat-1");
      }
    });

    it("each message has characterId from scenario", async () => {
      const result = await manager.processUserInput(
        "chat-1",
        "测试消息",
        [],
        mockMessages,
      );
      const scenarioCharacterIds = PM_SCENARIO.characters.map((c) => c.id);
      for (const msg of result.messages) {
        expect(scenarioCharacterIds).toContain(msg.characterId);
      }
    });
  });

  describe("processUserInputStream", () => {
    it("calls onMessageStart for each NPC", async () => {
      const onMessageStart = vi.fn();
      const onChunk = vi.fn();

      await manager.processUserInputStream(
        "chat-1",
        "测试消息",
        [],
        mockMessages,
        onChunk,
        onMessageStart,
      );

      expect(onMessageStart).toHaveBeenCalledTimes(PM_SCENARIO.characters.length);
    }, 15000);

    it("calls onChunk during streaming", async () => {
      const onMessageStart = vi.fn();
      const onChunk = vi.fn();

      await manager.processUserInputStream(
        "chat-1",
        "测试消息",
        [],
        mockMessages,
        onChunk,
        onMessageStart,
      );

      expect(onChunk).toHaveBeenCalled();
    }, 15000);
  });
});
