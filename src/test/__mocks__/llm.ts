/**
 * Mock LLM provider for testing.
 * Returns configurable responses.
 */

export const mockLLMResponse = {
  content: "这是一条测试回复。",
  usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
};

export const createMockProvider = (response = mockLLMResponse) => ({
  chat: vi.fn().mockResolvedValue(response),
  chatStream: vi.fn().mockImplementation(async (_req: unknown, onChunk: (chunk: string) => void) => {
    // Simulate streaming by calling onChunk with words
    const words = response.content.split("");
    for (const char of words) {
      onChunk(char);
    }
    return response;
  }),
  testConnection: vi.fn().mockResolvedValue({ success: true, latencyMs: 100 }),
});
