import { useState } from "react";
import { X, Check } from "lucide-react";
import type { Character } from "@/types";

interface NpcPickerProps {
  /** All available characters */
  characters: Character[];
  /** Pre-selected character IDs */
  initialSelected: string[];
  /** Called when user confirms selection */
  onConfirm: (selectedIds: string[]) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function NpcPicker({ characters, initialSelected, onConfirm, onCancel }: NpcPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[360px] bg-background dark:bg-dark-background rounded-xl shadow-xl border border-border dark:border-dark-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-dark-border">
          <h3 className="text-sm font-semibold">选择参与讨论的成员</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-background-chat dark:hover:bg-dark-background-chat rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Character list */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {characters.map((char) => {
            const isSelected = selected.has(char.id);
            return (
              <button
                key={char.id}
                onClick={() => toggle(char.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-primary/10"
                    : "hover:bg-background-chat dark:hover:bg-dark-background-chat"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0"
                  style={{ backgroundColor: char.color }}
                >
                  {char.avatar}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium">{char.name}</div>
                  <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary truncate">
                    {char.personality.slice(0, 40)}...
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-white"
                    : "border-border dark:border-dark-border"
                }`}>
                  {isSelected && <Check size={12} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border dark:border-dark-border flex items-center justify-between">
          <span className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">
            已选 {selected.size} 人
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm border border-border dark:border-dark-border rounded-md hover:bg-background-chat dark:hover:bg-dark-background-chat transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
              className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
