import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, X } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useAppStore } from "@/store/appStore";
import { readImageFiles } from "@/lib/images";
import type { ImageAttachment } from "@/types";

interface InputAreaProps {
  onAddImages: (images: ImageAttachment[]) => void;
  pendingImages: ImageAttachment[];
  onRemoveImage: (imageId: string) => void;
  onSendMessage: (content: string, images: ImageAttachment[]) => void;
}

export function InputArea({
  onAddImages,
  pendingImages,
  onRemoveImage,
  onSendMessage,
}: InputAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTyping = useChatStore((s) => s.isTyping);
  const typingChatId = useChatStore((s) => s.typingChatId);

  // Only disable input if typing is in the CURRENT chat
  const currentChatId = useAppStore((s) => s.currentChatId);
  const isTypingInThisChat = isTyping && typingChatId === currentChatId;

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content && pendingImages.length === 0) return;
    if (isTypingInThisChat) return;

    onSendMessage(content, pendingImages);
    setInput("");
    // Clear pending images via parent
    pendingImages.forEach((img) => onRemoveImage(img.id));
  }, [input, pendingImages, isTyping, onSendMessage, onRemoveImage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    readImageFiles(Array.from(files)).then((images) => {
      if (images.length > 0) onAddImages(images);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle paste (Ctrl/Cmd + V)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        readImageFiles(imageFiles).then((images) => {
          if (images.length > 0) onAddImages(images);
        });
      }
    },
    [onAddImages],
  );

  // Auto-focus textarea on mount, chat change, or when NPC finishes typing
  const prevTypingRef = useRef(isTypingInThisChat);
  useEffect(() => {
    if (prevTypingRef.current && !isTypingInThisChat) {
      // NPC just finished typing — refocus input
      textareaRef.current?.focus();
    }
    prevTypingRef.current = isTypingInThisChat;
  }, [isTypingInThisChat]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentChatId]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const canSend = !isTypingInThisChat && (input.trim() || pendingImages.length > 0);

  return (
    <div className="border-t border-border dark:border-dark-border px-4 py-3">
      {/* Image previews */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {pendingImages.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.filename}
                className="w-12 h-12 object-cover rounded-lg border border-border dark:border-dark-border"
              />
              <button
                onClick={() => onRemoveImage(img.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isTypingInThisChat}
          className="p-2 text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors disabled:opacity-50 rounded-full hover:bg-background-chat dark:hover:bg-dark-background-chat"
          aria-label="上传图片"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isTypingInThisChat}
          placeholder="在这里输入你的想法、反馈、或贴一张图..."
          rows={1}
          className="flex-1 resize-none bg-background-chat dark:bg-dark-background-chat rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 placeholder:text-foreground-secondary dark:placeholder:text-dark-foreground-secondary"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          aria-label="发送"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
