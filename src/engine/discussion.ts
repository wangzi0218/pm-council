import type {
  UUID,
  Message,
  Character,
  Skill,
  Scenario,
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
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// DiscussionManager
// ---------------------------------------------------------------------------

export class DiscussionManager {
  private provider: LLMProvider;
  private settings: LLMSettings;
  private scenario: Scenario;

  constructor(settings: LLMSettings, scenario: Scenario) {
    this.settings = settings;
    this.scenario = scenario;
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
    background?: string,
    previousContext?: string,
    characterSkills?: Record<string, Skill[]>,
    characters?: Character[],
  ): Promise<DiscussionResult> {
    const chars = characters ?? this.scenario.characters;
    const newMessages: Message[] = [];

    // 1. 决定发言顺序
    const speakingOrder = this.determineSpeakingOrder(userContent, chars);

    // 2. 依次让 NPC 发言
    for (const characterId of speakingOrder) {
      const character = chars.find((c) => c.id === characterId);
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
          characterSkills?.[characterId],
        );
        newMessages.push(npcMessage);
      } catch {
        const fallback = this.generateFallbackResponse(chatId, characterId);
        newMessages.push(fallback);
      }
    }

    // 3. 检测分歧并决定是否生成选择点
    const allMessages = [...recentMessages, ...newMessages];
    const choice = await this.checkAndGenerateChoice(chatId, allMessages);

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
    onChunk: (characterId: string, chunk: string, messageId: UUID) => void,
    onMessageStart: (message: Message) => void,
    onTypingStart?: (characterId: string) => void,
    onStreamEnd?: (messageId: UUID) => void,
    background?: string,
    previousContext?: string,
    characterSkills?: Record<string, Skill[]>,
    characters?: Character[],
  ): Promise<DiscussionResult> {
    const chars = characters ?? this.scenario.characters;
    const newMessages: Message[] = [];

    // 1. 决定发言顺序
    const speakingOrder = this.determineSpeakingOrder(userContent, chars);

    // 2. 依次让 NPC 发言（流式）
    for (const characterId of speakingOrder) {
      const character = chars.find((c) => c.id === characterId);
      if (!character) continue;

      const allMessages = [...recentMessages, ...newMessages];
      const systemPrompt = buildSystemPrompt(character, allMessages, [], background, previousContext, characterSkills?.[characterId]);
      const chatMessages = this.buildChatMessages(systemPrompt, allMessages, images);

      // 发言前延迟：模拟思考节奏
      if (onTypingStart) {
        onTypingStart(character.id);
      }
      const delayMs = this.scenario.speakingDelay[character.id] ?? 800;
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
          maxTokens: 1024,
        };

        const startTime = Date.now();
        const response = await this.provider.chatStream(request, (chunk) =>
          onChunk(characterId, chunk, messageId),
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
        // Notify that this NPC's stream is complete
        onStreamEnd?.(messageId);
      } catch {
        const fallback = this.generateFallbackResponse(chatId, characterId);
        onChunk(characterId, fallback.content, messageId);
        newMessages.push({ ...emptyMessage, content: fallback.content });
        onStreamEnd?.(messageId);
      }
    }

    // 3. 检测分歧并决定是否生成选择点（非流式）
    const allMessages = [...recentMessages, ...newMessages];
    const choice = await this.checkAndGenerateChoice(chatId, allMessages);

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
    activeSkills?: Skill[],
  ): Promise<Message> {
    const systemPrompt = buildSystemPrompt(character, recentMessages, [], background, previousContext, activeSkills);
    const chatMessages = this.buildChatMessages(systemPrompt, recentMessages, userImages);

    const request = {
      messages: chatMessages,
      model: this.settings.model,
      temperature: 0.7,
      maxTokens: 1024,
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
  ): Promise<Choice | undefined> {
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
        maxTokens: 1024,
      });

      const result = this.parseJSON(response.content);
      const score = typeof result?.score === "number" ? result.score : 0;
      if (!result?.hasDivergence || score < 0.5) return undefined;

      return await this.generateChoice(chatId, messages, result);
    } catch {
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
   * 将角色名解析为角色 ID（使用场景角色列表）
   */
  private resolveCharacterId(name: string): UUID {
    for (const char of this.scenario.characters) {
      if (char.name === name || char.id === name) return char.id;
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

    for (const msg of recentMessages.slice(-10)) {
      if (msg.role === "user") {
        if (msg.images.length > 0 || userImages.length > 0) {
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
   * 基于用户输入特征 + 场景默认顺序动态调整
   */
  private determineSpeakingOrder(
    userInput: string,
    activeCharacters?: Character[],
  ): string[] {
    const input = userInput.toLowerCase();
    const defaultOrder = this.scenario.speakingOrder;

    // Use the actual chat's characters, not just the scenario's
    const charIds = activeCharacters?.map((c) => c.id) ?? this.scenario.characters.map((c) => c.id);

    // Build order: scenario defaults first, then any additional characters
    const orderedIds: string[] = [];
    for (const id of defaultOrder) {
      if (charIds.includes(id)) orderedIds.push(id);
    }
    for (const id of charIds) {
      if (!orderedIds.includes(id)) orderedIds.push(id);
    }

    // 基于关键词动态调整前两个角色的顺序
    if (orderedIds.length >= 2) {
      const proposalKeywords = ["方案", "功能", "加一个", "做一个", "实现"];
      if (proposalKeywords.some((k) => input.includes(k))) {
        return orderedIds;
      }

      const evidenceKeywords = ["肯定", "一定", "必然", "所有人都", "用户都喜欢"];
      if (evidenceKeywords.some((k) => input.includes(k))) {
        return [orderedIds[1]!, orderedIds[0]!, ...orderedIds.slice(2)];
      }
    }

    return orderedIds;
  }

  /**
   * 降级回复：LLM 调用失败时使用
   */
  private generateFallbackResponse(chatId: UUID, characterId: string): Message {
    const fallback = this.scenario.fallbackResponses[characterId] ?? "能再补充一下吗？";

    return {
      id: generateId(),
      chatId,
      role: "character" as const,
      characterId,
      content: fallback,
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
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : text.trim();
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
