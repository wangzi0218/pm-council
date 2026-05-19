import type {
  UUID,
  Message,
  Character,
  ImageAttachment,
  ChatMessage,
  DiscussionResult,
  Choice,
  ChoiceOption,
  CharacterPreference,
  PreferenceLeaning,
  LLMSettings,
} from "@/types";
import type { LLMProvider } from "@/llm/provider";
import { createProvider } from "@/llm/factory";
import { generateId } from "@/lib/utils";
import {
  buildSystemPrompt,
  buildDivergencePrompt,
  buildChoiceGenerationPrompt,
} from "./prompts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 默认发言顺序 */
const DEFAULT_SPEAKING_ORDER = ["xiao-lin", "lao-chen", "a-zhe"] as const;

/** NPC 名称映射 */
const CHARACTER_NAMES: Record<string, string> = {
  "xiao-lin": "小林",
  "lao-chen": "老陈",
  "a-zhe": "阿哲",
};

/** NPC 发言前延迟（ms）— 模拟思考节奏 */
const SPEAKING_DELAY: Record<string, number> = {
  "xiao-lin": 500,   // 小林反应快，脱口而出
  "lao-chen": 1000,  // 老陈沉稳，想一下再说
  "a-zhe": 1500,     // 阿哲深思熟虑，最后收敛
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// DiscussionManager
// ---------------------------------------------------------------------------

export class DiscussionManager {
  private provider: LLMProvider;
  private settings: LLMSettings;

  constructor(settings: LLMSettings) {
    this.settings = settings;
    this.provider = createProvider(settings);
  }

  /**
   * 处理用户输入，启动 NPC 讨论流程
   *
   * 流程：
   * 1. 分析用户输入，决定发言顺序
   * 2. 依次让每个 NPC 发言（调用 LLM）
   * 3. 检测分歧
   * 4. 如有分歧，生成选择点
   */
  async processUserInput(
    chatId: UUID,
    userContent: string,
    images: ImageAttachment[],
    recentMessages: Message[],
    characters: Character[],
    background?: string,
    previousContext?: string,
  ): Promise<DiscussionResult> {
    const newMessages: Message[] = [];

    // 1. 决定发言顺序
    const speakingOrder = this.determineSpeakingOrder(userContent, recentMessages);

    // 2. 依次让 NPC 发言
    for (const characterId of speakingOrder) {
      const character = characters.find((c) => c.id === characterId);
      if (!character) continue;

      const allMessages = [...recentMessages, ...newMessages];

      try {
        const npcMessage = await this.generateNPCResponse(
          chatId,
          character,
          allMessages,
          images,
          background,
          previousContext,
        );
        newMessages.push(npcMessage);
      } catch (err) {
        // LLM 调用失败时使用降级回复
        const fallback = this.generateFallbackResponse(chatId, characterId);
        newMessages.push(fallback);
      }
    }

    // 3. 检测分歧并决定是否生成选择点
    const allMessages = [...recentMessages, ...newMessages];
    const choice = await this.checkAndGenerateChoice(chatId, allMessages, characters);

    return {
      messages: newMessages,
      choice,
      converged: false,
    };
  }

  /**
   * 处理用户输入，启动 NPC 讨论流程（流式版本）
   *
   * 与 processUserInput 相同流程，但 NPC 回复使用 chatStream 实时输出。
   * 分歧检测和选择点生成仍用非流式 chat()。
   */
  async processUserInputStream(
    chatId: UUID,
    userContent: string,
    images: ImageAttachment[],
    recentMessages: Message[],
    _characters: Character[],
    onChunk: (characterId: string, chunk: string) => void,
    onMessageStart: (message: Message) => void,
    onTypingStart?: (characterId: string) => void,
    background?: string,
    previousContext?: string,
  ): Promise<DiscussionResult> {
    const newMessages: Message[] = [];

    // 1. 决定发言顺序
    const speakingOrder = this.determineSpeakingOrder(userContent, recentMessages);

    // 2. 依次让 NPC 发言（流式）
    for (const characterId of speakingOrder) {
      const character = _characters.find((c) => c.id === characterId);
      if (!character) continue;

      const allMessages = [...recentMessages, ...newMessages];
      const systemPrompt = buildSystemPrompt(character, allMessages, [], background, previousContext);
      const chatMessages = this.buildChatMessages(systemPrompt, allMessages, images);

      // 发言前延迟：模拟思考节奏
      // 小林快（反应快），老陈中（稳重），阿哲慢（深思熟虑）
      if (onTypingStart) {
        onTypingStart(character.id);
      }
      const delayMs = SPEAKING_DELAY[character.id] ?? 800;
      await sleep(delayMs);

      // 创建空消息，通知 UI
      const messageId = generateId();
      const emptyMessage: Message = {
        id: messageId,
        chatId,
        role: "character" as const,
        characterId: character.id,
        content: "",
        images: [],
        metadata: {
          turnNumber: allMessages.filter((m) => m.role === "character").length + 1,
          model: this.settings.model,
        },
        createdAt: new Date().toISOString(),
      };
      onMessageStart(emptyMessage);

      try {
        const request = {
          messages: chatMessages,
          model: this.settings.model,
          temperature: 0.7,
          maxTokens: 512,
        };

        const startTime = Date.now();
        const response = await this.provider.chatStream(request, (chunk) =>
          onChunk(characterId, chunk),
        );
        const latencyMs = Date.now() - startTime;

        const completedMessage: Message = {
          ...emptyMessage,
          content: response.content,
          metadata: {
            ...emptyMessage.metadata,
            latencyMs,
          },
        };
        newMessages.push(completedMessage);
      } catch {
        // LLM 调用失败时使用降级回复
        const fallback = this.generateFallbackResponse(chatId, characterId);
        // 用降级内容替换空消息
        onChunk(characterId, fallback.content);
        newMessages.push({ ...emptyMessage, content: fallback.content });
      }
    }

    // 3. 检测分歧并决定是否生成选择点（非流式）
    const allMessages = [...recentMessages, ...newMessages];
    const choice = await this.checkAndGenerateChoice(chatId, allMessages, _characters);

    return {
      messages: newMessages,
      choice,
      converged: false,
    };
  }

  /**
   * 生成单个 NPC 的回复
   */
  private async generateNPCResponse(
    chatId: UUID,
    character: Character,
    recentMessages: Message[],
    userImages: ImageAttachment[],
    background?: string,
    previousContext?: string,
  ): Promise<Message> {
    const systemPrompt = buildSystemPrompt(character, recentMessages, [], background, previousContext);
    const chatMessages = this.buildChatMessages(systemPrompt, recentMessages, userImages);

    const request = {
      messages: chatMessages,
      model: this.settings.model,
      temperature: 0.7,
      maxTokens: 512,
    };

    const startTime = Date.now();
    const response = await this.provider.chat(request);
    const latencyMs = Date.now() - startTime;

    return {
      id: generateId(),
      chatId,
      role: "character" as const,
      characterId: character.id,
      content: response.content,
      images: [],
      metadata: {
        turnNumber: recentMessages.filter((m) => m.role === "character").length + 1,
        model: this.settings.model,
        latencyMs,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 检测分歧并生成选择点
   */
  private async checkAndGenerateChoice(
    chatId: UUID,
    messages: Message[],
    _characters: Character[],
  ): Promise<Choice | undefined> {
    // 只在有足够 NPC 发言时才检测分歧
    const npcMessages = messages.filter((m) => m.role === "character");
    if (npcMessages.length < 2) return undefined;

    try {
      const divergencePrompt = buildDivergencePrompt(messages);
      const response = await this.provider.chat({
        messages: [
          { role: "system", content: "你是一个讨论分析助手，只输出 JSON。" },
          { role: "user", content: divergencePrompt },
        ],
        model: this.settings.model,
        temperature: 0.3,
        maxTokens: 512,
      });

      const result = this.parseJSON(response.content);
      const score = typeof result?.score === "number" ? result.score : 0;
      if (!result?.hasDivergence || score < 0.5) return undefined;

      // 有分歧，生成选择点
      return await this.generateChoice(chatId, messages, result);
    } catch {
      // 分歧检测失败不影响主流程
      return undefined;
    }
  }

  /**
   * 生成选择点
   */
  private async generateChoice(
    chatId: UUID,
    messages: Message[],
    divergenceInfo: Record<string, unknown>,
  ): Promise<Choice | undefined> {
    try {
      const prompt = buildChoiceGenerationPrompt(
        JSON.stringify(divergenceInfo),
        messages,
      );

      const response = await this.provider.chat({
        messages: [
          { role: "system", content: "你是一个讨论分析助手，只输出 JSON。" },
          { role: "user", content: prompt },
        ],
        model: this.settings.model,
        temperature: 0.5,
        maxTokens: 1024,
      });

      const result = this.parseJSON(response.content);
      if (!result?.question || !Array.isArray(result.options)) return undefined;

      const question = String(result.question);
      const options: ChoiceOption[] = (
        result.options as Record<string, unknown>[]
      ).map((opt, i) => ({
        id: generateId(),
        label: typeof opt.label === "string" ? opt.label : String.fromCharCode(65 + i),
        description: typeof opt.description === "string" ? opt.description : "",
        characterPreferences: this.parsePreferences(
          opt.preferences as Record<string, unknown>[] | undefined,
        ),
      }));

      return {
        id: generateId(),
        chatId,
        question,
        options,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * 解析 NPC 偏好
   */
  private parsePreferences(
    prefs: Record<string, unknown>[] | undefined,
  ): CharacterPreference[] {
    if (!Array.isArray(prefs)) return [];

    return prefs.map((p) => ({
      characterId: this.resolveCharacterId(p.character as string),
      leaning: (p.leaning as PreferenceLeaning) ?? "neutral",
      reason: p.reason as string | undefined,
    }));
  }

  /**
   * 将角色名解析为角色 ID
   */
  private resolveCharacterId(name: string): UUID {
    for (const [id, n] of Object.entries(CHARACTER_NAMES)) {
      if (n === name || id === name) return id;
    }
    return name;
  }

  /**
   * 构建发送给 LLM 的消息列表
   */
  private buildChatMessages(
    systemPrompt: string,
    recentMessages: Message[],
    userImages: ImageAttachment[],
  ): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // 取最近 10 条消息作为上下文
    for (const msg of recentMessages.slice(-10)) {
      if (msg.role === "user") {
        if (msg.images.length > 0 || userImages.length > 0) {
          // 多模态消息
          const parts: ChatMessage["content"] = [
            { type: "text" as const, text: msg.content },
          ];
          for (const img of msg.images) {
            parts.push({
              type: "image" as const,
              data: img.data,
              mediaType: img.mimeType,
            });
          }
          messages.push({ role: "user", content: parts });
        } else {
          messages.push({ role: "user", content: msg.content });
        }
      } else if (msg.role === "character") {
        messages.push({ role: "assistant", content: msg.content });
      }
    }

    return messages;
  }

  /**
   * 决定 NPC 发言顺序
   * 基于用户输入特征动态调整
   */
  private determineSpeakingOrder(
    userInput: string,
    _recentMessages: Message[],
  ): string[] {
    const input = userInput.toLowerCase();

    // 方案先行：小林先追问
    const proposalKeywords = ["方案", "功能", "加一个", "做一个", "实现"];
    if (proposalKeywords.some((k) => input.includes(k))) {
      return ["xiao-lin", "lao-chen", "a-zhe"];
    }

    // 缺乏证据：老陈先追问数据
    const evidenceKeywords = ["肯定", "一定", "必然", "所有人都", "用户都喜欢"];
    if (evidenceKeywords.some((k) => input.includes(k))) {
      return ["lao-chen", "xiao-lin", "a-zhe"];
    }

    // 默认顺序
    return [...DEFAULT_SPEAKING_ORDER];
  }

  /**
   * 降级回复：LLM 调用失败时使用
   */
  private generateFallbackResponse(chatId: UUID, characterId: string): Message {
    const fallbacks: Record<string, string> = {
      "xiao-lin": "我有个疑问，能再详细说说吗？",
      "lao-chen": "这个问题你有相关的数据或案例吗？",
      "a-zhe": "我们说了不少，你觉得最重要的点是什么？",
    };

    return {
      id: generateId(),
      chatId,
      role: "character" as const,
      characterId,
      content: fallbacks[characterId] ?? "能再补充一下吗？",
      images: [],
      metadata: {
        turnNumber: 0,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 安全解析 JSON
   */
  private parseJSON(text: string): Record<string, unknown> | null {
    try {
      // 尝试提取 JSON 块（LLM 可能会包裹在 markdown code block 中）
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : text.trim();
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
