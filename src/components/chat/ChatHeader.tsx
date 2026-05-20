import { Settings } from "lucide-react";
import { useAppStore } from "@/store/appStore";

interface ChatHeaderProps {
  onOpenSettings?: () => void;
}

export function ChatHeader({ onOpenSettings }: ChatHeaderProps) {
  const currentChatId = useAppStore((s) => s.currentChatId);
  const chats = useAppStore((s) => s.chats);
  const currentChat = chats.find((c) => c.id === currentChatId);

  if (!currentChat) return null;

  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border dark:border-dark-border">
      <div className="text-sm font-semibold truncate">{currentChat.title}</div>
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="p-1.5 hover:bg-background-chat dark:hover:bg-dark-background-chat rounded-md transition-colors"
          title="群聊设置"
        >
          <Settings size={16} className="text-foreground-secondary dark:text-dark-foreground-secondary" />
        </button>
      )}
    </div>
  );
}
