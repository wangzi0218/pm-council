use tauri_plugin_sql::{Migration, MigrationKind};

/// 返回数据库迁移列表，在应用启动时自动执行
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init_schema",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "workspace_background",
            sql: include_str!("../migrations/002_workspace_background.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "skill",
            sql: include_str!("../migrations/003_skill.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "chat_characters",
            sql: include_str!("../migrations/004_chat_characters.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "seed_engineering_characters",
            sql: include_str!("../migrations/005_seed_engineering_characters.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "conversation_memory",
            sql: include_str!("../migrations/006_conversation_memory.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
