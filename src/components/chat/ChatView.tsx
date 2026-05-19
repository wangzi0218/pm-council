import { useState, useCallback, useRef } from "react";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { useChatStore } from "@/store/chatStore";
import { useAppStore } from "@/store/appStore";
import { EmptyState } from "@/components/chat/EmptyState";
import { DiscussionManager } from "@/engine/discussion";
import { CHARACTERS } from "@/scenarios/pm-discussion/characters";
import { generateId } from "@/lib/utils";
import type { Message, ImageAttachment } from "@/types";
import { Upload, X } from "lucide-react";

export function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const createChoice = useChatStore((s) => s.createChoice);
  const selectChoiceOption = useChatStore((s) => s.selectChoiceOption);
  const startStreamingMessage = useChatStore((s) => s.startStreamingMessage);
  const appendStreamChunk = useChatStore((s) => s.appendStreamChunk);
  const finishStreaming = useChatStore((s) => s.finishStreaming);
  const setErrorMessage = useChatStore((s) => s.setErrorMessage);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const clearErrorMessage = useChatStore((s) => s.clearErrorMessage);
  const llmSettings = useAppStore((s) => s.settings.llm);
  const openSettings = useAppStore((s) => s.openSettings);
  const currentChatId = useAppStore((s) => s.currentChatId);

  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleAddImages = useCallback((images: ImageAttachment[]) => {
    setPendingImages((prev) => {
      const remaining = 5 - prev.length;
      return [...prev, ...images.slice(0, remaining)];
    });
  }, []);

  const handleRemoveImage = useCallback((imageId: string) => {
    setPendingImages((prev) => prev.filter((i) => i.id !== imageId));
  }, []);

  const handleSelectChoice = useCallback(
    (choiceId: string, optionId: string) => {
      selectChoiceOption(choiceId, optionId);
    },
    [selectChoiceOption],
  );

  const handleSendMessage = useCallback(
    async (content: string, images: ImageAttachment[]) => {
      if (!currentChatId) return;
      clearErrorMessage();

      // 1. 添加用户消息
      const userMessage: Message = {
        id: generateId(),
        chatId: currentChatId,
        role: "user",
        content,
        images,
        createdAt: new Date().toISOString(),
      };
      await addMessage(userMessage);

      // 2. 启动 NPC 讨论（流式）
      const engine = new DiscussionManager(llmSettings);

      try {
        const currentMessages = useChatStore.getState().messages;
        const result = await engine.processUserInputStream(
          currentChatId,
          content,
          images,
          currentMessages,
          CHARACTERS,
          // onChunk: 实时更新消息内容
          (_characterId, chunk) => {
            const streamingId = useChatStore.getState().streamingMessageId;
            if (streamingId) {
              appendStreamChunk(streamingId, chunk);
            }
          },
          // onMessageStart: 创建空消息，设置 typing 状态
          (msg) => {
            if (msg.characterId) {
              setTyping(msg.characterId);
            }
            startStreamingMessage(msg);
          },
        );

        // 流式完成，持久化每条消息
        for (const msg of result.messages) {
          await finishStreaming(msg.id);
        }
        setTyping(null);

        // 如果有选择点，设置到 store 并持久化
        if (result.choice) {
          await createChoice(result.choice);
        }
      } catch (err) {
        setTyping(null);
        const msg = parseLLMError(err);
        setErrorMessage(msg.text, msg.showSettingsLink);
      }
    },
    [currentChatId, addMessage, setTyping, createChoice, startStreamingMessage, appendStreamChunk, finishStreaming, setErrorMessage, llmSettings],
  );

  // Drag-and-drop handlers (full window coverage)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;

      readImageFiles(files).then((images) => {
        if (images.length > 0) handleAddImages(images);
      });
    },
    [handleAddImages],
  );

  // Empty state when no messages
  if (messages.length === 0) {
    return (
      <main
        className="flex-1 flex flex-col relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <EmptyState />
        {errorMessage && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400">
            <span className="flex-1">{errorMessage.text}</span>
            {errorMessage.showSettingsLink && (
              <button
                onClick={() => { clearErrorMessage(); openSettings(); }}
                className="shrink-0 font-medium underline hover:no-underline"
              >
                去设置
              </button>
            )}
            <button
              onClick={clearErrorMessage}
              className="shrink-0 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <InputArea
          onAddImages={handleAddImages}
          pendingImages={pendingImages}
          onRemoveImage={handleRemoveImage}
          onSendMessage={handleSendMessage}
        />
        <DragOverlay isVisible={isDragOver} />
      </main>
    );
  }

  return (
    <main
      className="flex-1 flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <MessageList onSelectChoice={handleSelectChoice} />
      {errorMessage && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400">
          <span className="flex-1">{errorMessage.text}</span>
          {errorMessage.showSettingsLink && (
            <button
              onClick={() => { clearErrorMessage(); openSettings(); }}
              className="shrink-0 font-medium underline hover:no-underline"
            >
              去设置
            </button>
          )}
          <button
            onClick={clearErrorMessage}
            className="shrink-0 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <InputArea
        onAddImages={handleAddImages}
        pendingImages={pendingImages}
        onRemoveImage={handleRemoveImage}
        onSendMessage={handleSendMessage}
      />
      <DragOverlay isVisible={isDragOver} />
    </main>
  );
}

function DragOverlay({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-40 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-message-in">
      <div className="flex flex-col items-center gap-3 bg-background dark:bg-dark-background border-2 border-dashed border-primary rounded-xl px-8 py-6 shadow-lg">
        <Upload size={32} className="text-primary" />
        <span className="text-sm font-medium text-primary">
          松开以上传图片
        </span>
      </div>
    </div>
  );
}

function parseLLMError(err: unknown): { text: string; showSettingsLink: boolean } {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("HTTP 401") || msg.includes("HTTP 403")) {
    return { text: "API Key 无效或权限不足，请在设置中检查", showSettingsLink: true };
  }
  if (msg.includes("HTTP 429")) {
    return { text: "请求过于频繁，请稍后重试", showSettingsLink: false };
  }
  if (msg.includes("HTTP 5")) {
    return { text: "模型服务暂时不可用，请稍后重试", showSettingsLink: false };
  }
  if (err instanceof TypeError || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return { text: "网络连接失败，请检查网络", showSettingsLink: false };
  }
  return { text: `请求失败：${msg}`, showSettingsLink: false };
}

async function readImageFiles(files: File[]): Promise<ImageAttachment[]> {
  const results: ImageAttachment[] = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string).split(",")[1] ?? "";
        resolve(result);
      };
      reader.readAsDataURL(file);
    });

    results.push({
      id: generateId(),
      filename: file.name,
      mimeType: file.type,
      localPath: "",
      data: base64,
    });
  }

  return results;
}
