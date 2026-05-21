import { useState, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { Plus, Settings } from "lucide-react";
import { generateId } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import { getScenario, DEFAULT_SCENARIO, SCENARIOS } from "@/scenarios/registry";
import { getCharacter } from "@/lib/characters";
import { NpcPicker } from "./NpcPicker";
import type { Chat, UUID } from "@/types";

/** Merge all characters from all scenarios (deduplicated) */
const ALL_CHARACTERS = [...new Map(
  SCENARIOS.flatMap((s) => s.characters).map((c) => [c.id, c])
).values()];

/** All character IDs for the "全员大群" */
const ALL_CHARACTER_IDS = ALL_CHARACTERS.map((c) => c.id);

export function Sidebar() {
  const openSettings = useAppStore((s) => s.openSettings);
  const chats = useAppStore((s) => s.chats);
  const currentChatId = useAppStore((s) => s.currentChatId);
  const setCurrentChat = useAppStore((s) => s.setCurrentChat);
  const addChat = useAppStore((s) => s.addChat);
  const workspaces = useAppStore((s) => s.workspaces);

  const [showNpcPicker, setShowNpcPicker] = useState(false);

  const currentScenarioId = useAppStore((s) => s.currentScenarioId);
  const activeScenario = getScenario(currentScenarioId) ?? DEFAULT_SCENARIO;

  // Sort chats by most recent
  const sortedChats = [...chats].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  // Find or create "全员大群"
  const allGroupChat = chats.find((c) => c.title === "全员大群");

  const handleNewChat = useCallback(() => {
    setShowNpcPicker(true);
  }, []);

  const handleNpcPickerConfirm = useCallback(
    async (selectedIds: string[]) => {
      setShowNpcPicker(false);
      if (selectedIds.length === 0) return;

      const workspaceId = workspaces[0]!.id;
      const names = selectedIds.map((id) => getCharacter(id)?.name ?? "NPC");
      const title =
        selectedIds.length === ALL_CHARACTER_IDS.length
          ? "全员大群"
          : names.length <= 2
            ? names.join("、")
            : `${names[0]}等${names.length}人`;

      const chat: Chat = {
        id: generateId(),
        workspaceId,
        title,
        status: "active",
        characterIds: selectedIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addChat(chat);
      await setCurrentChat(chat.id);
    },
    [workspaces, addChat, setCurrentChat],
  );

  const handleOpenAllGroup = useCallback(async () => {
    if (allGroupChat) {
      await setCurrentChat(allGroupChat.id);
      return;
    }
    // Create the all-group chat
    const workspaceId = workspaces[0]!.id;
    const chat: Chat = {
      id: generateId(),
      workspaceId,
      title: "全员大群",
      status: "active",
      characterIds: ALL_CHARACTER_IDS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addChat(chat);
    await setCurrentChat(chat.id);
  }, [allGroupChat, workspaces, addChat, setCurrentChat]);

  const handleSelectChat = useCallback(
    async (chatId: UUID) => {
      await setCurrentChat(chatId);
    },
    [setCurrentChat],
  );

  return (
    <aside className="w-[280px] shrink-0 border-r border-border dark:border-dark-border flex flex-col bg-background-secondary dark:bg-dark-background-secondary">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border dark:border-dark-border">
        <h1 className="text-sm font-semibold text-foreground-secondary dark:text-dark-foreground-secondary">
          我的团队
        </h1>
      </div>

      {/* All Group — pinned */}
      <div className="px-2 pb-1">
        <button
          onClick={handleOpenAllGroup}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            allGroupChat?.id === currentChatId
              ? "bg-primary/10"
              : "hover:bg-background dark:hover:bg-dark-background"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
            全
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium truncate">全员大群</div>
            <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary truncate">
              {ALL_CHARACTER_IDS.length} 位同事
            </div>
          </div>
        </button>
      </div>

      <div className="px-3 pb-1">
        <div className="text-[11px] font-medium text-foreground-secondary dark:text-dark-foreground-secondary uppercase tracking-wider">
          最近对话
        </div>
      </div>

      {/* Chat List — flat, sorted by time */}
      <div className="flex-1 overflow-y-auto px-2">
        {sortedChats.length === 0 ? (
          <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary px-2 py-8 text-center">
            暂无对话，点击新建
          </div>
        ) : (
          sortedChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              onClick={() => handleSelectChat(chat.id)}
            />
          ))
        )}
      </div>

      {/* Bottom Actions */}
      <div className="px-4 py-3 border-t border-border dark:border-dark-border flex gap-2 items-center">
        <button
          onClick={handleNewChat}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          新建讨论
        </button>
        <button
          onClick={openSettings}
          className="flex items-center justify-center p-2 text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors rounded-md hover:bg-background dark:hover:bg-dark-background border border-border dark:border-dark-border"
          aria-label="设置"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* NPC Picker */}
      {showNpcPicker && (
        <NpcPicker
          characters={ALL_CHARACTERS}
          initialSelected={activeScenario.characters.map((c) => c.id)}
          onConfirm={handleNpcPickerConfirm}
          onCancel={() => setShowNpcPicker(false)}
        />
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Chat List Item — IM style with avatar + title + preview + time
// ---------------------------------------------------------------------------

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const updateChat = useAppStore((s) => s.updateChat);

  // Get last message for preview (from current store messages if this chat is active)
  const lastMessage = useChatStore((s) => {
    // Only show preview for the active chat
    if (chat.id !== useAppStore.getState().currentChatId) return null;
    const msgs = s.messages;
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  });

  const handleRename = async () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== chat.title) {
      await updateChat(chat.id, { title: trimmed });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-2 py-1">
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") {
              setEditing(false);
              setEditTitle(chat.title);
            }
          }}
          className="w-full px-2 py-1 text-sm bg-background dark:bg-dark-background border border-primary rounded-md focus:outline-none"
        />
      </div>
    );
  }

  const chatCharacters = (chat.characterIds ?? [])
    .map((id) => getCharacter(id))
    .filter(Boolean);

  const isGroup = chatCharacters.length > 1;

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div
      onClick={onClick}
      onDoubleClick={() => {
        setEditing(true);
        setEditTitle(chat.title);
      }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-primary/10"
          : "hover:bg-background dark:hover:bg-dark-background"
      }`}
      title="双击改名"
    >
      {/* Avatar — single character or group composite */}
      {isGroup ? (
        <div className="relative w-10 h-10 shrink-0">
          {/* Show up to 4 small avatars in a 2x2 grid */}
          <div className="grid grid-cols-2 gap-0.5 w-10 h-10">
            {chatCharacters.slice(0, 4).map((char) => (
              <div
                key={char!.id}
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-medium text-white"
                style={{ backgroundColor: char!.color }}
              >
                {char!.avatar}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0"
          style={{ backgroundColor: chatCharacters[0]?.color ?? "#6b7280" }}
        >
          {chatCharacters[0]?.avatar ?? "?"}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-sm truncate ${isActive ? "font-medium text-primary" : "font-medium"}`}
          >
            {chat.title}
          </span>
          <span className="text-[10px] text-foreground-secondary dark:text-dark-foreground-secondary shrink-0 ml-2">
            {formatTime(chat.updatedAt)}
          </span>
        </div>
        <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary truncate mt-0.5">
          {lastMessage
            ? lastMessage.role === "user"
              ? lastMessage.content
              : `[${getCharacter(lastMessage.characterId ?? "")?.name ?? "NPC"}] ${lastMessage.content}`
            : isGroup
              ? `${chatCharacters.length} 位成员`
              : chatCharacters[0]?.name ?? ""}
        </div>
      </div>
    </div>
  );
}
