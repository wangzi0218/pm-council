import type { LLMProviderType } from "@/types";
import type { IconType } from "react-icons";
import { FaRobot, FaBrain, FaMicrochip, FaMoon, FaWater, FaCommentDots, FaGear, FaCube } from "react-icons/fa6";

export interface ProviderPreset {
  id: string;
  name: string;
  format: LLMProviderType;
  baseUrl: string;
  defaultModel: string;
  color: string;
  icon: IconType;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    format: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    color: "#10a37f",
    icon: FaRobot,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    format: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    color: "#4d6bfe",
    icon: FaBrain,
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    format: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    color: "#6366f1",
    icon: FaMicrochip,
  },
  {
    id: "moonshot",
    name: "Moonshot",
    format: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    color: "#1a1a2e",
    icon: FaMoon,
  },
  {
    id: "minimax",
    name: "MiniMax",
    format: "openai",
    baseUrl: "https://api.minimax.chat/v1",
    defaultModel: "abab6.5s-chat",
    color: "#ff6b35",
    icon: FaCube,
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    format: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-7B-Instruct",
    color: "#8b5cf6",
    icon: FaWater,
  },
  {
    id: "claude",
    name: "Claude",
    format: "claude",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    color: "#d97706",
    icon: FaCommentDots,
  },
  {
    id: "custom",
    name: "自定义",
    format: "openai",
    baseUrl: "",
    defaultModel: "",
    color: "#6b7280",
    icon: FaGear,
  },
];

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
