import type { Scenario } from "@/types";
import { CHARACTERS } from "./characters";

export { CHARACTERS } from "./characters";
export { BUILTIN_SKILLS } from "./skills";

/**
 * PM 讨论场景
 * 3 位 NPC 围绕产品决策展开讨论，各自有鲜明的立场和追问风格。
 */
export const PM_SCENARIO: Scenario = {
  id: "pm-discussion",
  name: "PM 讨论",
  description: "小林、老陈、阿哲三位产品同事围绕产品决策展开讨论",
  characters: CHARACTERS,
  speakingOrder: ["xiao-lin", "lao-chen", "a-zhe"],
  speakingDelay: {
    "xiao-lin": 200,
    "lao-chen": 400,
    "a-zhe": 600,
  },
  fallbackResponses: {
    "xiao-lin": "我有个疑问，能再详细说说吗？",
    "lao-chen": "这个问题你有相关的数据或案例吗？",
    "a-zhe": "我们说了不少，你觉得最重要的点是什么？",
  },
};
