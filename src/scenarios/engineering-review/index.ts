import type { Scenario } from "@/types";
import { CHARACTERS } from "./characters";

export { CHARACTERS } from "./characters";

/**
 * 工程评审场景
 * 架构师、QA、安全工程师围绕技术方案展开评审讨论。
 */
export const ENGINEERING_REVIEW_SCENARIO: Scenario = {
  id: "engineering-review",
  name: "工程评审",
  description: "老周、小杨、阿安三位工程师围绕技术方案展开评审",
  characters: CHARACTERS,
  speakingOrder: ["lao-zhou", "xiao-yang", "a-an"],
  speakingDelay: {
    "lao-zhou": 400,
    "xiao-yang": 200,
    "a-an": 300,
  },
  fallbackResponses: {
    "lao-zhou": "这个问题需要从系统层面再看看。",
    "xiao-yang": "有没有考虑过边界情况？",
    "a-an": "安全方面有几个点需要确认一下。",
  },
};
