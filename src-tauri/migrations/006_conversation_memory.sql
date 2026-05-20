-- 对话记忆/摘要表 — 为未来的记忆检索优化预留结构
-- 当前阶段：存储每轮对话的 LLM 生成摘要
-- 未来扩展：可加 embedding BLOB 列支持向量检索

CREATE TABLE IF NOT EXISTS conversation_memory (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chat(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_chat_id ON conversation_memory(chat_id);
CREATE INDEX IF NOT EXISTS idx_memory_character_id ON conversation_memory(character_id);

-- 未来可选：添加 embedding 列支持向量检索
-- ALTER TABLE conversation_memory ADD COLUMN embedding BLOB;
-- ALTER TABLE conversation_memory ADD COLUMN keywords TEXT;
