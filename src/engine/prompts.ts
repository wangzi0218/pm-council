import type { Character, Message, Skill } from "@/types";

/**
 * 为指定 NPC 构建 system prompt
 * 包含：角色人设 + 讨论上下文 + 行为规则 + 技能指令
 */
export function buildSystemPrompt(
  character: Character,
  recentMessages: Message[],
  _allCharacters: Character[],
  background?: string,
  previousContext?: string,
  activeSkills?: Skill[],
  characterMap?: Map<string, { name: string }>,
): string {
  const messageBlock = formatMessagesForPrompt(recentMessages, characterMap);
  const backgroundBlock = background?.trim()
    ? `\n# 项目背景\n${background.trim()}\n`
    : "";
  const previousBlock = previousContext?.trim()
    ? `\n# 之前的讨论\n以下是本工作区之前讨论的部分内容，你可以在合适时引用：\n${previousContext.trim()}\n`
    : "";

  const skillsBlock = activeSkills && activeSkills.length > 0
    ? `\n# 方法论技能\n你在讨论中可以运用以下方法论能力，根据讨论内容自然地使用，不需要每次都用：\n\n${activeSkills.map((s) => s.promptFragment).join("\n\n")}\n`
    : "";

  return `${character.systemPrompt}
${backgroundBlock}${previousBlock}${skillsBlock}
# 当前讨论
以下是最近的讨论内容，请基于这些内容发言：

${messageBlock}

# 行为规则
1. 不要无底线顺着用户，如果证据不足要敢于追问
2. 不要替用户做决定，分歧时把选择权交给用户
3. 每次发言都要推进讨论，不要说废话
4. 如果用户是方案先行，先问"为什么"再讨论方案
5. 保持角色一致性，不要跳出人设
6. 直接说话，不要说"作为${character.name}，我认为..."
7. 不要用括号包裹内心活动或行为描写（如「想了想」「皱眉」「（沉吟片刻）」），直接说你的话
8. 说话像真人同事在群里聊天，不是小说旁白，不要有叙述性文字`;
}

/**
 * 为收敛判断构建 prompt
 */
export function buildConvergencePrompt(
  recentMessages: Message[],
  characterNames: string,
  characterMap?: Map<string, { name: string }>,
): string {
  const messageBlock = formatMessagesForPrompt(recentMessages, characterMap);

  return `你是一个讨论分析助手。请分析以下讨论，判断讨论是否已经可以收敛。

讨论参与者：${characterNames}

最近的讨论内容：
${messageBlock}

请判断：
1. 核心问题是否已经明确？
2. 各方观点是否已经充分表达？
3. 是否还有未解决的关键分歧？

回答格式（JSON）：
{
  "shouldConverge": true/false,
  "reason": "原因",
  "coreIssue": "核心问题摘要（如已明确）"
}`;
}

/**
 * 为分歧检测构建 prompt
 */
export function buildDivergencePrompt(
  recentMessages: Message[],
  characterMap?: Map<string, { name: string }>,
): string {
  const messageBlock = formatMessagesForPrompt(recentMessages, characterMap);

  return `你是一个讨论分析助手。请分析以下讨论中是否存在明显的观点分歧。

最近的讨论内容：
${messageBlock}

请分析每个发言者的立场和观点，判断是否存在分歧。

回答格式（JSON）：
{
  "hasDivergence": true/false,
  "score": 0.0-1.0,
  "coreIssue": "分歧的核心议题（如有）",
  "viewpoints": [
    {
      "speaker": "发言者名字",
      "position": "立场摘要",
      "leaning": "strong/prefer/neutral/against"
    }
  ]
}`;
}

/**
 * 为选择点生成构建 prompt
 */
export function buildChoiceGenerationPrompt(
  divergenceInfo: string,
  recentMessages: Message[],
  characterMap?: Map<string, { name: string }>,
): string {
  const messageBlock = formatMessagesForPrompt(recentMessages, characterMap);

  return `你是一个讨论分析助手。讨论中出现了分歧，需要生成一个选择点让用户做决定。

分歧信息：
${divergenceInfo}

最近的讨论内容：
${messageBlock}

请生成一个选择点，包含：
1. 一个清晰的问题（让用户做决定）
2. 2-3 个选项，每个选项要具体可执行
3. 每个选项中各发言者的倾向

回答格式（JSON）：
{
  "question": "你倾向于哪个方向？",
  "options": [
    {
      "label": "A",
      "description": "选项描述",
      "preferences": [
        { "character": "小林", "leaning": "prefer", "reason": "原因" }
      ]
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatMessagesForPrompt(messages: Message[], characterMap?: Map<string, { name: string }>): string {
  return messages
    .slice(-10)
    .map((m) => {
      if (m.role === "user") {
        return `用户：${m.content}`;
      }
      if (m.role === "character") {
        const name = m.characterId ? characterMap?.get(m.characterId)?.name ?? m.characterId : "NPC";
        return `[${name}]：${m.content}`;
      }
      return `系统：${m.content}`;
    })
    .join("\n\n");
}
