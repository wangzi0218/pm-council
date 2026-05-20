import { useState, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { Plus, Settings, ChevronRight, FolderOpen, Download, Upload, Trash2 } from "lucide-react";
import { generateId } from "@/lib/utils";
import { db } from "@/store/database";
import { useChatStore } from "@/store/chatStore";
import { getScenario, DEFAULT_SCENARIO, SCENARIOS } from "@/scenarios/registry";
import { getCharacter } from "@/lib/characters";
import { NpcPicker } from "./NpcPicker";
import type { Workspace, Chat, UUID } from "@/types";

/** Merge all characters from all scenarios (deduplicated) */
const ALL_CHARACTERS = [...new Map(
  SCENARIOS.flatMap((s) => s.characters).map((c) => [c.id, c])
).values()];

export function Sidebar() {
  const openSettings = useAppStore((s) => s.openSettings);
  const workspaces = useAppStore((s) => s.workspaces);
  const chats = useAppStore((s) => s.chats);
  const currentChatId = useAppStore((s) => s.currentChatId);
  const setCurrentChat = useAppStore((s) => s.setCurrentChat);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const addChat = useAppStore((s) => s.addChat);
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);

  const handleExport = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const json = await db.exportWorkspace(currentWorkspaceId);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pm-council-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`导出失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [currentWorkspaceId]);

  const handleImport = useCallback(async () => {
    if (!window.confirm("导入将覆盖当前工作区数据，确定继续吗？")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const wsId = await db.importWorkspace(text);
        const workspaces = await db.listWorkspaces();
        const chats = await db.listChats(wsId);
        useAppStore.setState({ workspaces, chats, currentWorkspaceId: wsId, currentChatId: null });
        useChatStore.getState().clearMessages();
      } catch (e) {
        alert(`导入失败：${e instanceof Error ? e.message : String(e)}`);
      }
    };
    input.click();
  }, []);

  const [showNpcPicker, setShowNpcPicker] = useState(false);

  const handleNewChat = useCallback(() => {
    setShowNpcPicker(true);
  }, []);

  const handleNpcPickerConfirm = useCallback(async (selectedIds: string[]) => {
    setShowNpcPicker(false);
    if (selectedIds.length === 0) return;

    // Find or create a default workspace
    let workspaceId: UUID;
    if (workspaces.length > 0) {
      workspaceId = workspaces[0]!.id;
    } else {
      const ws: Workspace = {
        id: generateId(),
        name: "默认工作区",
        background: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addWorkspace(ws);
      workspaceId = ws.id;
    }

    // Generate title from selected characters
    const names = selectedIds.map((id) => getCharacter(id)?.name ?? "NPC");
    const title = names.length <= 2 ? names.join("、") : `${names[0]}等${names.length}人`;

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
    setCurrentWorkspace(workspaceId);
    await setCurrentChat(chat.id);
  }, [workspaces, addWorkspace, addChat, setCurrentWorkspace, setCurrentChat]);

  const handleSelectChat = useCallback(
    async (chatId: UUID) => {
      await setCurrentChat(chatId);
    },
    [setCurrentChat],
  );

  const currentScenarioId = useAppStore((s) => s.currentScenarioId);
  const activeScenario = getScenario(currentScenarioId) ?? DEFAULT_SCENARIO;

  // Group chats by workspace
  const workspaceGroups = workspaces.map((ws) => ({
    workspace: ws,
    chats: chats.filter((c) => c.workspaceId === ws.id),
  }));

  return (
    <aside className="w-[280px] shrink-0 border-r border-border dark:border-dark-border flex flex-col bg-background-secondary dark:bg-dark-background-secondary">
      {/* Header */}
      <div className="p-4 border-b border-border dark:border-dark-border">
        <h1 className="text-sm font-semibold text-foreground-secondary dark:text-dark-foreground-secondary">
          PM Workflow Harness
        </h1>
      </div>

      {/* Workspace & Chat List */}
      <div className="flex-1 overflow-y-auto p-2">
        {workspaceGroups.length === 0 ? (
          <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary px-2 py-4 text-center">
            暂无讨论
          </div>
        ) : (
          workspaceGroups.map(({ workspace, chats: wsChats }) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              chats={wsChats}
              currentChatId={currentChatId}
              onSelectChat={handleSelectChat}
            />
          ))
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-border dark:border-dark-border space-y-2">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          新建讨论
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors rounded-md hover:bg-background dark:hover:bg-dark-background"
            title="导出工作区"
          >
            <Download size={13} />
            导出
          </button>
          <button
            onClick={handleImport}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors rounded-md hover:bg-background dark:hover:bg-dark-background"
            title="导入工作区"
          >
            <Upload size={13} />
            导入
          </button>
          <button
            onClick={openSettings}
            className="flex items-center justify-center p-1.5 text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors rounded-md hover:bg-background dark:hover:bg-dark-background"
            aria-label="设置"
          >
            <Settings size={13} />
          </button>
        </div>
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

interface WorkspaceItemProps {
  workspace: Workspace;
  chats: Chat[];
  currentChatId: UUID | null;
  onSelectChat: (chatId: UUID) => void;
}

function WorkspaceItem({
  workspace,
  chats,
  currentChatId,
  onSelectChat,
}: WorkspaceItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showBackground, setShowBackground] = useState(false);
  const [backgroundText, setBackgroundText] = useState(workspace.background);
  const updateWorkspace = useAppStore((s) => s.updateWorkspace);

  const handleBackgroundSave = useCallback(() => {
    if (backgroundText !== workspace.background) {
      updateWorkspace(workspace.id, { background: backgroundText });
    }
    setShowBackground(false);
  }, [backgroundText, workspace.background, workspace.id, updateWorkspace]);

  return (
    <div className="mb-1">
      {/* Workspace header */}
      <div className="flex items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center gap-2 px-2 py-2 text-sm font-semibold text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors rounded-md hover:bg-background dark:hover:bg-dark-background"
        >
          <ChevronRight
            size={14}
            className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />
          <FolderOpen size={14} className="shrink-0" />
          <span className="truncate">{workspace.name}</span>
        </button>
        <button
          onClick={() => setShowBackground(!showBackground)}
          className={`p-1 text-xs rounded transition-colors ${
            showBackground || workspace.background
              ? "text-primary"
              : "text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground"
          }`}
          title="项目背景"
        >
          背景
        </button>
      </div>

      {/* Background editor */}
      {showBackground && (
        <div className="mx-2 mb-1 px-2 py-1.5">
          <textarea
            value={backgroundText}
            onChange={(e) => setBackgroundText(e.target.value)}
            onBlur={handleBackgroundSave}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleBackgroundSave(); } }}
            placeholder="描述项目背景，NPC 会在讨论时参考..."
            rows={3}
            className="w-full px-2 py-1.5 text-xs bg-background dark:bg-dark-background border border-border dark:border-dark-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <p className="text-[10px] text-foreground-secondary dark:text-dark-foreground-secondary mt-1">
            Shift+Enter 换行，Enter 保存
          </p>
        </div>
      )}

      {/* Chat list */}
      {isExpanded && (
        <div className="ml-2 space-y-0.5">
          {chats.length === 0 ? (
            <div className="px-3 py-2 text-xs text-foreground-secondary dark:text-dark-foreground-secondary">
              暂无讨论
            </div>
          ) : (
            chats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === currentChatId}
                onClick={() => onSelectChat(chat.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

function ChatItem({ chat, isActive, onClick }: ChatItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const updateChat = useAppStore((s) => s.updateChat);
  const currentChatId = useAppStore((s) => s.currentChatId);
  const setCurrentChat = useAppStore((s) => s.setCurrentChat);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除对话「${chat.title}」吗？`)) return;
    await db.deleteChat(chat.id);
    useAppStore.setState((s) => ({
      chats: s.chats.filter((c) => c.id !== chat.id),
    }));
    if (currentChatId === chat.id) {
      await setCurrentChat(null);
    }
  };

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
            if (e.key === "Escape") { setEditing(false); setEditTitle(chat.title); }
          }}
          className="w-full px-2 py-1 text-sm bg-background dark:bg-dark-background border border-primary rounded-md focus:outline-none"
        />
      </div>
    );
  }

  const chatCharacters = (chat.characterIds ?? [])
    .map((id) => getCharacter(id))
    .filter(Boolean);

  return (
    <div
      onClick={onClick}
      onDoubleClick={() => { setEditing(true); setEditTitle(chat.title); }}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer group relative ${
        isActive
          ? "bg-primary/10 text-primary border-l-[3px] border-l-primary"
          : "text-foreground dark:text-dark-foreground hover:bg-background dark:hover:bg-dark-background"
      }`}
      title="双击改名"
    >
      <div className="truncate font-medium pr-6">{chat.title}</div>
      <div className="flex items-center gap-1 mt-1">
        {chatCharacters.slice(0, 4).map((char) => (
          <div
            key={char!.id}
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white shrink-0"
            style={{ backgroundColor: char!.color }}
            title={char!.name}
          >
            {char!.avatar}
          </div>
        ))}
        {chatCharacters.length > 4 && (
          <span className="text-[10px] text-foreground-secondary dark:text-dark-foreground-secondary">
            +{chatCharacters.length - 4}
          </span>
        )}
      </div>
      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-opacity"
        title="删除对话"
      >
        <Trash2 size={12} className="text-red-500" />
      </button>
    </div>
  );
}
