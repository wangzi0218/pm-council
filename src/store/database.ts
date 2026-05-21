import Database from "@tauri-apps/plugin-sql";
import type {
  UUID,
  Workspace,
  Chat,
  Message,
  MessageMetadata,

  Choice,
  ChoiceOption,
  CharacterPreference,
  Character,
  Skill,
  AppSettings,
  LLMSettings,
} from "@/types";

// ---------------------------------------------------------------------------
// 内部类型（数据库行格式）
// ---------------------------------------------------------------------------

interface SettingRow {
  key: string;
  value: string;
  group_name: string;
}

interface CharacterRow {
  id: string;
  name: string;
  color: string;
  avatar: string;
  personality: string;
  speaking_style: string;
  capabilities: string;
  trigger_conditions: string;
  system_prompt: string;
  is_builtin: number;
  created_at: string;
}

interface SkillRow {
  id: string;
  name: string;
  description: string;
  prompt_fragment: string;
  triggers: string;
  is_builtin: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// DatabaseManager 单例
// ---------------------------------------------------------------------------

/** Mock DB for browser debugging (no Tauri runtime) */
function createMockDb(): Database {
  return {
    execute: async () => {},
    select: async <T>(): Promise<T[]> => {
      return [] as T[];
    },
  } as unknown as Database;
}

class DatabaseManager {
  private db: Database | null = null;

  async init(): Promise<void> {
    try {
      this.db = await Database.load("sqlite:app.db");
    } catch {
      // Browser fallback — no Tauri runtime
      this.db = createMockDb();
    }
  }

  private getDb(): Database {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    return this.db;
  }

  // =========================================================================
  // Workspace
  // =========================================================================

  async createWorkspace(ws: Omit<Workspace, "createdAt" | "updatedAt">): Promise<Workspace> {
    const db = this.getDb();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO workspace (id, name, description, background, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [ws.id, ws.name, ws.description ?? null, ws.background ?? "", now, now],
    );
    return { ...ws, createdAt: now, updatedAt: now };
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const db = this.getDb();
    const rows = await db.select<Array<{ id: string; name: string; description: string | null; background: string | null; created_at: string; updated_at: string }>>(
      "SELECT * FROM workspace ORDER BY updated_at DESC",
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      background: r.background ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async updateWorkspace(id: UUID, updates: Partial<Pick<Workspace, "name" | "description" | "background">>): Promise<void> {
    const db = this.getDb();
    if (updates.name !== undefined) {
      await db.execute("UPDATE workspace SET name = $1, updated_at = $2 WHERE id = $3", [updates.name, new Date().toISOString(), id]);
    }
    if (updates.description !== undefined) {
      await db.execute("UPDATE workspace SET description = $1, updated_at = $2 WHERE id = $3", [updates.description, new Date().toISOString(), id]);
    }
    if (updates.background !== undefined) {
      await db.execute("UPDATE workspace SET background = $1, updated_at = $2 WHERE id = $3", [updates.background, new Date().toISOString(), id]);
    }
  }

  async getOtherChatMessages(workspaceId: UUID, excludeChatId: UUID, limit: number = 5): Promise<Message[]> {
    const db = this.getDb();
    // 获取同工作区其他讨论的最近消息
    const rows = await db.select<Array<{
      id: string;
      chat_id: string;
      role: string;
      character_id: string | null;
      content: string;
      metadata: string | null;
      created_at: string;
    }>>(
      `SELECT m.* FROM message m
       JOIN chat c ON m.chat_id = c.id
       WHERE c.workspace_id = $1 AND m.chat_id != $2 AND m.role IN ('user', 'character')
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [workspaceId, excludeChatId, limit],
    );

    return rows.reverse().map((r) => ({
      id: r.id,
      chatId: r.chat_id,
      role: r.role as Message["role"],
      characterId: r.character_id ?? undefined,
      content: r.content,
      images: [],
      metadata: r.metadata ? (JSON.parse(r.metadata) as MessageMetadata) : undefined,
      createdAt: r.created_at,
    }));
  }

  async deleteWorkspace(id: UUID): Promise<void> {
    const db = this.getDb();
    await db.execute("DELETE FROM workspace WHERE id = $1", [id]);
  }

  // =========================================================================
  // Chat
  // =========================================================================

  async createChat(chat: Omit<Chat, "createdAt" | "updatedAt">): Promise<Chat> {
    const db = this.getDb();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO chat (id, workspace_id, title, status, character_ids, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [chat.id, chat.workspaceId, chat.title, chat.status, JSON.stringify(chat.characterIds ?? []), now, now],
    );
    return { ...chat, createdAt: now, updatedAt: now };
  }

  async listChats(workspaceId: UUID): Promise<Chat[]> {
    const db = this.getDb();
    const rows = await db.select<Array<{ id: string; workspace_id: string; title: string; status: string; character_ids: string; created_at: string; updated_at: string }>>(
      "SELECT * FROM chat WHERE workspace_id = $1 ORDER BY updated_at DESC",
      [workspaceId],
    );
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title,
      status: r.status as Chat["status"],
      characterIds: JSON.parse(r.character_ids) as string[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async updateChat(id: UUID, updates: Partial<Pick<Chat, "title" | "status" | "characterIds">>): Promise<void> {
    const db = this.getDb();
    if (updates.title !== undefined) {
      await db.execute("UPDATE chat SET title = $1 WHERE id = $2", [updates.title, id]);
    }
    if (updates.status !== undefined) {
      await db.execute("UPDATE chat SET status = $1 WHERE id = $2", [updates.status, id]);
    }
    if (updates.characterIds !== undefined) {
      await db.execute("UPDATE chat SET character_ids = $1 WHERE id = $2", [JSON.stringify(updates.characterIds), id]);
    }
  }

  async deleteChat(id: UUID): Promise<void> {
    const db = this.getDb();
    await db.execute("DELETE FROM chat WHERE id = $1", [id]);
  }

  async moveChatToWorkspace(chatId: UUID, workspaceId: UUID): Promise<void> {
    const db = this.getDb();
    await db.execute("UPDATE chat SET workspace_id = $1 WHERE id = $2", [workspaceId, chatId]);
  }

  // =========================================================================
  // Message
  // =========================================================================

  async createMessage(msg: Omit<Message, "createdAt">): Promise<Message> {
    const db = this.getDb();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO message (id, chat_id, role, character_id, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        msg.id,
        msg.chatId,
        msg.role,
        msg.characterId ?? null,
        msg.content,
        msg.metadata ? JSON.stringify(msg.metadata) : null,
        now,
      ],
    );
    // 保存图片附件
    for (const img of msg.images) {
      await db.execute(
        "INSERT INTO message_image (id, message_id, filename, mime_type, data, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [img.id, msg.id, img.filename, img.mimeType, img.data, now],
      );
    }
    return { ...msg, createdAt: now };
  }

  async listMessages(chatId: UUID): Promise<Message[]> {
    const db = this.getDb();
    const rows = await db.select<Array<{
      id: string;
      chat_id: string;
      role: string;
      character_id: string | null;
      content: string;
      metadata: string | null;
      created_at: string;
    }>>(
      "SELECT * FROM message WHERE chat_id = $1 ORDER BY created_at ASC",
      [chatId],
    );

    const messages: Message[] = [];
    for (const r of rows) {
      // 加载图片
      const images = await db.select<Array<{ id: string; filename: string; mime_type: string; data: string }>>(
        "SELECT * FROM message_image WHERE message_id = $1",
        [r.id],
      );

      messages.push({
        id: r.id,
        chatId: r.chat_id,
        role: r.role as Message["role"],
        characterId: r.character_id ?? undefined,
        content: r.content,
        images: images.map((img) => ({
          id: img.id,
          filename: img.filename,
          mimeType: img.mime_type,
          localPath: "",
          data: img.data,
        })),
        metadata: r.metadata ? (JSON.parse(r.metadata) as MessageMetadata) : undefined,
        createdAt: r.created_at,
      });
    }
    return messages;
  }

  async deleteMessage(id: UUID): Promise<void> {
    const db = this.getDb();
    await db.execute("DELETE FROM message WHERE id = $1", [id]);
  }

  // =========================================================================
  // Choice
  // =========================================================================

  async createChoice(
    choice: Omit<Choice, "createdAt">,
    options: Array<{ option: Omit<ChoiceOption, "characterPreferences">; preferences: Omit<CharacterPreference, "characterId">[] & { characterId: string }[] }>,
  ): Promise<Choice> {
    const db = this.getDb();
    const now = new Date().toISOString();

    await db.execute(
      "INSERT INTO choice (id, chat_id, trigger_message_id, question, selected_option_id, status, created_at, resolved_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [choice.id, choice.chatId, choice.triggerMessageId ?? null, choice.question, choice.selectedOptionId ?? null, choice.status, now, choice.resolvedAt ?? null],
    );

    for (const { option, preferences } of options) {
      await db.execute(
        "INSERT INTO choice_option (id, choice_id, label, description, created_at) VALUES ($1, $2, $3, $4, $5)",
        [option.id, choice.id, option.label, option.description, now],
      );
      for (const pref of preferences) {
        await db.execute(
          "INSERT INTO character_preference (id, choice_option_id, character_id, leaning, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [crypto.randomUUID(), option.id, pref.characterId, pref.leaning, pref.reason ?? null, now],
        );
      }
    }

    return { ...choice, createdAt: now };
  }

  async getPendingChoice(chatId: UUID): Promise<Choice | null> {
    const db = this.getDb();
    const rows = await db.select<Array<{
      id: string;
      chat_id: string;
      trigger_message_id: string | null;
      question: string;
      selected_option_id: string | null;
      status: string;
      created_at: string;
      resolved_at: string | null;
    }>>(
      "SELECT * FROM choice WHERE chat_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
      [chatId],
    );

    if (rows.length === 0) return null;
    const r = rows[0]!;

    // 加载选项和偏好
    const optionRows = await db.select<Array<{ id: string; label: string; description: string }>>(
      "SELECT * FROM choice_option WHERE choice_id = $1",
      [r.id],
    );

    const options: ChoiceOption[] = [];
    for (const opt of optionRows) {
      const prefRows = await db.select<Array<{ character_id: string; leaning: string; reason: string | null }>>(
        "SELECT * FROM character_preference WHERE choice_option_id = $1",
        [opt.id],
      );
      options.push({
        id: opt.id,
        label: opt.label,
        description: opt.description,
        characterPreferences: prefRows.map((p) => ({
          characterId: p.character_id,
          leaning: p.leaning as CharacterPreference["leaning"],
          reason: p.reason ?? undefined,
        })),
      });
    }

    return {
      id: r.id,
      chatId: r.chat_id,
      triggerMessageId: r.trigger_message_id ?? undefined,
      question: r.question,
      options,
      selectedOptionId: r.selected_option_id ?? undefined,
      status: r.status as Choice["status"],
      createdAt: r.created_at,
      resolvedAt: r.resolved_at ?? undefined,
    };
  }

  async getResolvedChoices(chatId: UUID): Promise<Choice[]> {
    const db = this.getDb();
    const rows = await db.select<Array<{
      id: string;
      chat_id: string;
      trigger_message_id: string | null;
      question: string;
      selected_option_id: string | null;
      status: string;
      created_at: string;
      resolved_at: string | null;
    }>>(
      "SELECT * FROM choice WHERE chat_id = $1 AND status IN ('resolved', 'skipped') ORDER BY created_at ASC",
      [chatId],
    );

    const choices: Choice[] = [];
    for (const r of rows) {
      const optionRows = await db.select<Array<{ id: string; label: string; description: string }>>(
        "SELECT * FROM choice_option WHERE choice_id = $1",
        [r.id],
      );

      const options: ChoiceOption[] = [];
      for (const opt of optionRows) {
        const prefRows = await db.select<Array<{ character_id: string; leaning: string; reason: string | null }>>(
          "SELECT * FROM character_preference WHERE choice_option_id = $1",
          [opt.id],
        );
        options.push({
          id: opt.id,
          label: opt.label,
          description: opt.description,
          characterPreferences: prefRows.map((p) => ({
            characterId: p.character_id,
            leaning: p.leaning as CharacterPreference["leaning"],
            reason: p.reason ?? undefined,
          })),
        });
      }

      choices.push({
        id: r.id,
        chatId: r.chat_id,
        triggerMessageId: r.trigger_message_id ?? undefined,
        question: r.question,
        options,
        selectedOptionId: r.selected_option_id ?? undefined,
        status: r.status as Choice["status"],
        createdAt: r.created_at,
        resolvedAt: r.resolved_at ?? undefined,
      });
    }
    return choices;
  }

  async updateChoice(id: UUID, updates: Partial<Pick<Choice, "selectedOptionId" | "status" | "resolvedAt">>): Promise<void> {
    const db = this.getDb();
    if (updates.selectedOptionId !== undefined) {
      await db.execute("UPDATE choice SET selected_option_id = $1 WHERE id = $2", [updates.selectedOptionId, id]);
    }
    if (updates.status !== undefined) {
      await db.execute("UPDATE choice SET status = $1 WHERE id = $2", [updates.status, id]);
    }
    if (updates.resolvedAt !== undefined) {
      await db.execute("UPDATE choice SET resolved_at = $1 WHERE id = $2", [updates.resolvedAt, id]);
    }
  }

  // =========================================================================
  // Character
  // =========================================================================

  async listCharacters(): Promise<Character[]> {
    const db = this.getDb();
    const rows = await db.select<CharacterRow[]>("SELECT * FROM character ORDER BY created_at ASC");
    return rows.map(this.rowToCharacter);
  }

  async getCharacter(id: UUID): Promise<Character | null> {
    const db = this.getDb();
    const rows = await db.select<CharacterRow[]>("SELECT * FROM character WHERE id = $1", [id]);
    return rows.length > 0 ? this.rowToCharacter(rows[0]!) : null;
  }

  async createCharacter(char: Omit<Character, "createdAt">): Promise<Character> {
    const db = this.getDb();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO character (id, name, color, avatar, personality, speaking_style, capabilities, trigger_conditions, system_prompt, is_builtin, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        char.id, char.name, char.color, char.avatar,
        char.personality, char.speakingStyle,
        JSON.stringify(char.capabilities), JSON.stringify(char.triggerConditions),
        char.systemPrompt, char.isBuiltin ? 1 : 0, now,
      ],
    );
    return { ...char, createdAt: now };
  }

  async updateCharacter(id: UUID, updates: Partial<Pick<Character, "name" | "color" | "avatar" | "personality" | "speakingStyle" | "capabilities" | "triggerConditions" | "systemPrompt">>): Promise<void> {
    const db = this.getDb();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.color !== undefined) { fields.push(`color = $${idx++}`); values.push(updates.color); }
    if (updates.avatar !== undefined) { fields.push(`avatar = $${idx++}`); values.push(updates.avatar); }
    if (updates.personality !== undefined) { fields.push(`personality = $${idx++}`); values.push(updates.personality); }
    if (updates.speakingStyle !== undefined) { fields.push(`speaking_style = $${idx++}`); values.push(updates.speakingStyle); }
    if (updates.capabilities !== undefined) { fields.push(`capabilities = $${idx++}`); values.push(JSON.stringify(updates.capabilities)); }
    if (updates.triggerConditions !== undefined) { fields.push(`trigger_conditions = $${idx++}`); values.push(JSON.stringify(updates.triggerConditions)); }
    if (updates.systemPrompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(updates.systemPrompt); }

    if (fields.length === 0) return;
    values.push(id);
    await db.execute(`UPDATE character SET ${fields.join(", ")} WHERE id = $${idx}`, values);
  }

  async deleteCharacter(id: UUID): Promise<void> {
    const db = this.getDb();
    await db.execute("DELETE FROM character WHERE id = $1 AND is_builtin = 0", [id]);
  }

  private rowToCharacter(r: CharacterRow): Character {
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      avatar: r.avatar,
      personality: r.personality,
      speakingStyle: r.speaking_style,
      capabilities: JSON.parse(r.capabilities) as string[],
      triggerConditions: JSON.parse(r.trigger_conditions) as string[],
      systemPrompt: r.system_prompt,
      isBuiltin: r.is_builtin === 1,
      createdAt: r.created_at,
    };
  }

  // =========================================================================
  // Skill
  // =========================================================================

  async listSkills(): Promise<Skill[]> {
    const db = this.getDb();
    const rows = await db.select<SkillRow[]>("SELECT * FROM skill ORDER BY created_at ASC");
    return rows.map(this.rowToSkill);
  }

  async getActiveSkillsForCharacter(characterId: UUID): Promise<Skill[]> {
    const db = this.getDb();
    const rows = await db.select<Array<SkillRow & { cs_enabled: number }>>(
      `SELECT s.*, cs.enabled as cs_enabled
       FROM skill s
       JOIN character_skill cs ON cs.skill_id = s.id
       WHERE cs.character_id = $1 AND cs.enabled = 1
       ORDER BY s.created_at ASC`,
      [characterId],
    );
    return rows.map(this.rowToSkill);
  }

  async setCharacterSkill(characterId: UUID, skillId: UUID, enabled: boolean): Promise<void> {
    const db = this.getDb();
    const id = `cs-${characterId}-${skillId.replace("skill-", "")}`;
    await db.execute(
      `INSERT INTO character_skill (id, character_id, skill_id, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(character_id, skill_id) DO UPDATE SET enabled = $4`,
      [id, characterId, skillId, enabled ? 1 : 0],
    );
  }

  async listCharacterSkills(characterId: UUID): Promise<Array<{ skillId: UUID; enabled: boolean }>> {
    const db = this.getDb();
    const rows = await db.select<Array<{ skill_id: string; enabled: number }>>(
      "SELECT skill_id, enabled FROM character_skill WHERE character_id = $1",
      [characterId],
    );
    return rows.map((r) => ({ skillId: r.skill_id, enabled: r.enabled === 1 }));
  }

  private rowToSkill(r: SkillRow): Skill {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      promptFragment: r.prompt_fragment,
      triggers: JSON.parse(r.triggers) as string[],
      isBuiltin: r.is_builtin === 1,
    };
  }

  // =========================================================================
  // Setting
  // =========================================================================

  async getSetting(key: string): Promise<string | null> {
    const db = this.getDb();
    const rows = await db.select<SettingRow[]>("SELECT * FROM setting WHERE key = $1", [key]);
    if (rows.length === 0) return null;
    return rows[0]!.value;
  }

  async setSetting(key: string, value: string, group: string): Promise<void> {
    const db = this.getDb();
    const id = `setting-${key}`;
    await db.execute(
      "INSERT INTO setting (id, key, value, group_name) VALUES ($1, $2, $3, $4) ON CONFLICT(key) DO UPDATE SET value = $3",
      [id, key, value, group],
    );
  }

  async getSettingsByGroup(group: string): Promise<Array<{ key: string; value: string }>> {
    const db = this.getDb();
    const rows = await db.select<SettingRow[]>("SELECT * FROM setting WHERE group_name = $1", [group]);
    return rows.map((r) => ({ key: r.key, value: r.value }));
  }

  // =========================================================================
  // 高层方法：加载设置
  // =========================================================================

  async loadAppSettings(): Promise<AppSettings> {
    const llmRows = await this.getSettingsByGroup("llm");
    const uiRows = await this.getSettingsByGroup("ui");

    const llmMap = new Map(llmRows.map((r) => [r.key, r.value]));
    const uiMap = new Map(uiRows.map((r) => [r.key, r.value]));

    const parseJSON = (val: string | undefined, fallback: string): string => {
      if (!val) return fallback;
      try { return JSON.parse(val) as string; } catch { return fallback; }
    };

    const llm: LLMSettings = {
      provider: (parseJSON(llmMap.get("llm.provider"), "openai") as LLMSettings["provider"]),
      baseUrl: parseJSON(llmMap.get("llm.baseUrl"), "https://api.openai.com/v1"),
      apiKey: parseJSON(llmMap.get("llm.apiKey"), ""),
      model: parseJSON(llmMap.get("llm.model"), "gpt-4o"),
    };

    return {
      llm,
      theme: (parseJSON(uiMap.get("theme"), "system") as AppSettings["theme"]),
      fontSize: (parseJSON(uiMap.get("fontSize"), "medium") as AppSettings["fontSize"]),
    };
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    await this.setSetting("llm.provider", JSON.stringify(settings.llm.provider), "llm");
    await this.setSetting("llm.baseUrl", JSON.stringify(settings.llm.baseUrl), "llm");
    await this.setSetting("llm.apiKey", JSON.stringify(settings.llm.apiKey), "llm");
    await this.setSetting("llm.model", JSON.stringify(settings.llm.model), "llm");
    await this.setSetting("theme", JSON.stringify(settings.theme), "ui");
    await this.setSetting("fontSize", JSON.stringify(settings.fontSize), "ui");
  }

  // =========================================================================
  // 导出/导入
  // =========================================================================

  async exportWorkspace(workspaceId: UUID): Promise<string> {
    const db = this.getDb();
    const workspaces = await db.select<Array<{ id: string; name: string; description: string | null; created_at: string; updated_at: string }>>(
      "SELECT * FROM workspace WHERE id = $1", [workspaceId],
    );
    if (workspaces.length === 0) throw new Error("Workspace not found");
    const ws = workspaces[0]!;

    const chats = await db.select<Array<{ id: string; title: string; status: string; created_at: string; updated_at: string }>>(
      "SELECT * FROM chat WHERE workspace_id = $1 ORDER BY created_at ASC", [workspaceId],
    );

    const chatData = [];
    for (const chat of chats) {
      const messages = await this.listMessages(chat.id);
      const choices = await this.getResolvedChoices(chat.id);
      const pendingChoice = await this.getPendingChoice(chat.id);
      chatData.push({
        id: chat.id,
        title: chat.title,
        status: chat.status,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        messages,
        choices: pendingChoice ? [...choices, pendingChoice] : choices,
      });
    }

    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace: {
        id: ws.id,
        name: ws.name,
        description: ws.description ?? undefined,
        createdAt: ws.created_at,
        updatedAt: ws.updated_at,
      },
      chats: chatData,
    }, null, 2);
  }

  async importWorkspace(json: string): Promise<UUID> {
    const data = JSON.parse(json) as {
      version: number;
      workspace: { id: string; name: string; description?: string; createdAt: string; updatedAt: string };
      chats: Array<{
        id: string;
        title: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        messages: Message[];
        choices: Choice[];
      }>;
    };

    if (data.version !== 1) throw new Error("Unsupported export version");

    const ws = data.workspace;
    await this.createWorkspace({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      background: (ws as Record<string, unknown>).background as string ?? "",
    });

    for (const chat of data.chats) {
      await this.createChat({
        id: chat.id,
        workspaceId: ws.id,
        title: chat.title,
        status: chat.status as Chat["status"],
        characterIds: (chat as Record<string, unknown>).characterIds as string[] ?? [],
      });

      for (const msg of chat.messages) {
        await this.createMessage(msg);
      }

      for (const choice of chat.choices) {
        await this.createChoice(choice, choice.options.map((opt) => ({
          option: { id: opt.id, label: opt.label, description: opt.description, createdAt: choice.createdAt },
          preferences: opt.characterPreferences.map((pref) => ({
            characterId: pref.characterId,
            leaning: pref.leaning,
            reason: pref.reason,
          })),
        })));
        if (choice.status !== "pending") {
          await this.updateChoice(choice.id, {
            selectedOptionId: choice.selectedOptionId,
            status: choice.status,
            resolvedAt: choice.resolvedAt,
          });
        }
      }
    }

    return ws.id;
  }
}

export const db = new DatabaseManager();
