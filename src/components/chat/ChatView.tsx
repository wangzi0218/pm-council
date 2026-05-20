import { useState, useCallback, useRef } from "react";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { ChatSettings } from "@/components/chat/ChatSettings";
import { useChatStore } from "@/store/chatStore";
import { useAppStore } from "@/store/appStore";
import { db } from "@/store/database";
import { EmptyState } from "@/components/chat/EmptyState";
import { DiscussionManager } from "@/engine/discussion";
import { getScenario } from "@/scenarios/registry";
import { DEFAULT_SCENARIO } from "@/scenarios/registry";
import { getCharacter } from "@/lib/characters";
import { generateId } from "@/lib/utils";
import { readImageFiles } from "@/lib/images";
import type { Message, ImageAttachment, Skill, Character, Chat, Workspace } from "@/types";
import { Upload, X } from "lucide-react";

export function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const createChoice = useChatStore((s) => s.createChoice);
  const selectChoiceOption = useChatStore((s) => s.selectChoiceOption);
  const skipChoice = useChatStore((s) => s.skipChoice);
  const archiveCurrentChoice = useChatStore((s) => s.archiveCurrentChoice);
  const startStreamingMessage = useChatStore((s) => s.startStreamingMessage);
  const appendStreamChunk = useChatStore((s) => s.appendStreamChunk);
  const finishStreaming = useChatStore((s) => s.finishStreaming);
  const setErrorMessage = useChatStore((s) => s.setErrorMessage);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const clearErrorMessage = useChatStore((s) => s.clearErrorMessage);
  const llmSettings = useAppStore((s) => s.settings.llm);
  const openSettings = useAppStore((s) => s.openSettings);
  const currentChatId = useAppStore((s) => s.currentChatId);
  const workspaces = useAppStore((s) => s.workspaces);
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const currentScenarioId = useAppStore((s) => s.currentScenarioId);
  const chats = useAppStore((s) => s.chats);
  const scenario = getScenario(currentScenarioId) ?? DEFAULT_SCENARIO;

  // Resolve current chat's NPCs from characterIds, fallback to scenario defaults
  const currentChat = chats.find((c) => c.id === currentChatId);
  const chatCharacters = currentChat?.characterIds
    ? currentChat.characterIds.map((id) => getCharacter(id)).filter(Boolean) as Character[]
    : scenario.characters;

  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
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

  const handleSkipChoice = useCallback(
    (choiceId: string) => {
      skipChoice(choiceId);
    },
    [skipChoice],
  );

  const handleSelectChoice = useCallback(
    async (choiceId: string, optionId: string) => {
      await selectChoiceOption(choiceId, optionId);

      // 触发 NPC 对选择结果的回应
      const choice = useChatStore.getState().currentChoice;
      if (!choice || !currentChatId) return;

      const selectedOpt = choice.options.find((o) => o.id === optionId);
      if (!selectedOpt) return;

      // 构建描述选择结果的合成消息
      const choiceContext = [
        `[选择已做出]`,
        `问题：${choice.question}`,
        `选择了：${selectedOpt.label} — ${selectedOpt.description}`,
      ].join("\n");

      const syntheticMessage: Message = {
        id: generateId(),
        chatId: currentChatId,
        role: "user",
        content: choiceContext,
        images: [],
        createdAt: new Date().toISOString(),
      };

      // 启动新一轮 NPC 讨论
      const engine = new DiscussionManager(llmSettings, scenario);
      try {
        const characterSkills = await loadCharacterSkills(chatCharacters);
        const currentMessages = [...useChatStore.getState().messages, syntheticMessage];
        const result = await engine.processUserInputStream(
          currentChatId,
          choiceContext,
          [],
          currentMessages,
          (_characterId, chunk, msgId) => {
            appendStreamChunk(msgId, chunk);
          },
          (msg) => {
            if (msg.characterId) setTyping(msg.characterId);
            startStreamingMessage(msg);
          },
          (characterId) => setTyping(characterId),
          workspaces.find((w) => w.id === currentWorkspaceId)?.background,
          undefined,
          characterSkills,
          chatCharacters,
        );

        for (const msg of result.messages) {
          await finishStreaming(msg.id);
        }
        setTyping(null);
        archiveCurrentChoice();
      } catch (err) {
        setTyping(null);
        archiveCurrentChoice();
        const parsed = parseLLMError(err);
        setErrorMessage(parsed.text, parsed.showSettingsLink);
      }
    },
    [currentChatId, selectChoiceOption, archiveCurrentChoice, setTyping, startStreamingMessage, appendStreamChunk, finishStreaming, setErrorMessage, llmSettings],
  );

  const handleSendMessage = useCallback(
    async (content: string, images: ImageAttachment[]) => {
      clearErrorMessage();

      // 如果没有活跃讨论，自动创建一个
      let activeChatId = currentChatId;
      if (!activeChatId) {
        let workspaceId = currentWorkspaceId;
        if (!workspaceId && workspaces.length > 0) {
          workspaceId = workspaces[0]!.id;
          useAppStore.setState({ currentWorkspaceId: workspaceId });
        }
        if (!workspaceId) {
          const ws: Workspace = {
            id: generateId(),
            name: "默认工作区",
            background: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await useAppStore.getState().addWorkspace(ws);
          workspaceId = ws.id;
          useAppStore.setState({ currentWorkspaceId: ws.id });
        }
        const chat: Chat = {
          id: generateId(),
          workspaceId,
          title: content.slice(0, 20) + (content.length > 20 ? "..." : ""),
          status: "active",
          characterIds: chatCharacters.map((c) => c.id),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await useAppStore.getState().addChat(chat);
        await useAppStore.getState().setCurrentChat(chat.id);
        activeChatId = chat.id;
      }

      // 1. 添加用户消息
      const userMessage: Message = {
        id: generateId(),
        chatId: activeChatId,
        role: "user",
        content,
        images,
        createdAt: new Date().toISOString(),
      };
      await addMessage(userMessage);

      // 2. 加载同工作区其他讨论的上下文 + 技能
      let previousContext: string | undefined;
      const [prevMessages, characterSkills] = await Promise.all([
        currentWorkspaceId
          ? db.getOtherChatMessages(currentWorkspaceId, activeChatId, 10).catch(() => [])
          : Promise.resolve([]),
        loadCharacterSkills(chatCharacters),
      ]);
      if (prevMessages.length > 0) {
        previousContext = prevMessages
          .map((m) => m.role === "user" ? `用户：${m.content}` : `[${m.characterId ?? "NPC"}]：${m.content}`)
          .join("\n");
      }

      // 3. 启动 NPC 讨论（流式）
      const engine = new DiscussionManager(llmSettings, scenario);

      try {
        const currentMessages = useChatStore.getState().messages;
        const result = await engine.processUserInputStream(
          activeChatId,
          content,
          images,
          currentMessages,
          // onChunk: 实时更新消息内容
          (_characterId, chunk, msgId) => {
            appendStreamChunk(msgId, chunk);
          },
          // onMessageStart: 创建空消息，设置 typing 状态
          (msg) => {
            if (msg.characterId) {
              setTyping(msg.characterId);
            }
            startStreamingMessage(msg);
          },
          // onTypingStart: 发言前显示 typing indicator
          (characterId) => {
            setTyping(characterId);
          },
          // 项目背景
          workspaces.find((w) => w.id === currentWorkspaceId)?.background,
          previousContext,
          characterSkills,
          chatCharacters,
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
    [currentChatId, currentWorkspaceId, workspaces, addMessage, setTyping, createChoice, startStreamingMessage, appendStreamChunk, finishStreaming, setErrorMessage, clearErrorMessage, llmSettings, scenario],
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
      <MessageList onSelectChoice={handleSelectChoice} onSkipChoice={handleSkipChoice} onOpenSettings={() => setShowChatSettings(true)} />
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
      {showChatSettings && currentChat && (
        <ChatSettings chat={currentChat} onClose={() => setShowChatSettings(false)} />
      )}
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

async function loadCharacterSkills(characters: Character[]): Promise<Record<string, Skill[]>> {
  const map: Record<string, Skill[]> = {};
  for (const char of characters) {
    try {
      const skills = await db.getActiveSkillsForCharacter(char.id);
      if (skills.length > 0) map[char.id] = skills;
    } catch {
      // skill 加载失败不影响讨论
    }
  }
  return map;
}
