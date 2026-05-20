import type { LLMProviderType } from "@/types";

export interface ProviderPreset {
  id: string;
  name: string;
  /** API format: "openai" = OpenAI-compatible, "claude" = Anthropic Messages API */
  format: LLMProviderType;
  baseUrl: string;
  defaultModel: string;
  /** Available models for quick selection */
  models: string[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    format: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    format: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    format: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    models: ["glm-4-flash", "glm-4", "glm-4-plus"],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    format: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    format: "openai",
    baseUrl: "https://api.minimax.chat/v1",
    defaultModel: "abab6.5s-chat",
    models: ["abab6.5s-chat", "abab5.5-chat"],
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    format: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-7B-Instruct",
    models: ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3", "THUDM/glm-4-9b-chat"],
  },
  {
    id: "claude",
    name: "Claude (Anthropic)",
    format: "claude",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514"],
  },
  {
    id: "custom",
    name: "自定义",
    format: "openai",
    baseUrl: "",
    defaultModel: "",
    models: [],
  },
];

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
