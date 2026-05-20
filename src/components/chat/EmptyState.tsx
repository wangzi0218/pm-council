import { MessageSquare } from "lucide-react";

interface EmptyStateProps {
  characterCount?: number;
  onStartChat?: () => void;
}

export function EmptyState({ characterCount, onStartChat }: EmptyStateProps) {
  const count = characterCount ?? 3;
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-background-chat dark:bg-dark-background-chat flex items-center justify-center mx-auto">
          <MessageSquare
            size={28}
            className="text-foreground-secondary dark:text-dark-foreground-secondary"
          />
        </div>
        <div>
          <h2 className="text-lg font-medium text-foreground dark:text-dark-foreground">
            开始一个新的讨论
          </h2>
          <p className="text-sm text-foreground-secondary dark:text-dark-foreground-secondary mt-1">
            输入你的想法、反馈或问题，{count} 位同事会和你一起讨论
          </p>
        </div>
        {onStartChat && (
          <button
            onClick={onStartChat}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
          >
            开始讨论
          </button>
        )}
      </div>
    </div>
  );
}
