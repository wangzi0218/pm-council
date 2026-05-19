import type { Scenario } from "@/types";
import { PM_SCENARIO } from "./pm-discussion";
import { ENGINEERING_REVIEW_SCENARIO } from "./engineering-review";

/**
 * 所有可用场景的注册表
 * 新增场景只需在这里添加一行
 */
export const SCENARIOS: Scenario[] = [
  PM_SCENARIO,
  ENGINEERING_REVIEW_SCENARIO,
];

/**
 * 根据 ID 获取场景
 */
export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/**
 * 默认场景
 */
export const DEFAULT_SCENARIO = PM_SCENARIO;
