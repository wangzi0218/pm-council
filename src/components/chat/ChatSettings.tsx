import { useState, useEffect, useCallback } from "react";
import { X, Users, FileText, Save } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CHARACTERS as PM_CHARACTERS } from "@/scenarios/pm-discussion/characters";
import { CHARACTERS as ENG_CHARACTERS } from "@/scenarios/engineering-review/characters";
import type { Chat } from "@/types";

const ALL_CHARACTERS = [...PM_CHARACTERS, ...ENG_CHARACTERS];

interface ChatSettingsProps {
  chat: Chat;
  onClose: () => void;
}

export function ChatSettings({ chat, onClose }: ChatSettingsProps) {
  const updateChat = useAppStore((s) => s.updateChat);
  const workspaces = useAppStore((s) => s.workspaces);
  const updateWorkspace = useAppStore((s) => s.updateWorkspace);

  const [title, setTitle] = useState(chat.title);
  const [characterIds, setCharacterIds] = useState<string[]>(chat.characterIds ?? []);
  const [background, setBackground] = useState("");
  const [saved, setSaved] = useState(false);

  const workspace = workspaces.find((w) => w.id === chat.workspaceId);

  useEffect(() => {
    if (workspace) setBackground(workspace.background);
  }, [workspace]);

  const handleSave = useCallback(async () => {
    await updateChat(chat.id, {
      title: title.trim() || chat.title,
      characterIds,
    });
    if (workspace) {
      await updateWorkspace(workspace.id, { background });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [chat, title, characterIds, background, workspace, updateChat, updateWorkspace]);

  const toggleCharacter = (id: string) => {
    setCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[360px] bg-background dark:bg-dark-background border-l border-border dark:border-dark-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-dark-border">
          <h3 className="text-sm font-semibold">群聊设置</h3>
          <button onClick={onClose} className="p-1 hover:bg-background-chat dark:hover:bg-dark-background-chat rounded-md">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Title */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              <FileText size={12} />
              群名称
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </section>

          {/* Members */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              <Users size={12} />
              群成员（{characterIds.length}）
            </div>
            <div className="space-y-1">
              {ALL_CHARACTERS.map((char) => {
                const isInChat = characterIds.includes(char.id);
                return (
                  <label
                    key={char.id}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                      isInChat ? "bg-primary/5" : "hover:bg-background-chat dark:hover:bg-dark-background-chat"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isInChat}
                      onChange={() => toggleCharacter(char.id)}
                      className="w-3.5 h-3.5 rounded border-border dark:border-dark-border text-primary focus:ring-primary/50"
                    />
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
                      style={{ backgroundColor: char.color }}
                    >
                      {char.avatar}
                    </div>
                    <span className="text-sm">{char.name}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Background */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              <FileText size={12} />
              群公告 / 项目背景
            </div>
            <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary -mt-1">
              NPC 会在讨论时参考这些背景信息。
            </p>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="描述项目背景、目标、约束..."
            />
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border dark:border-dark-border">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
          >
            <Save size={14} />
            {saved ? "已保存" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
