import { create } from "zustand";
import type { AppSettings, UUID, Workspace, Chat } from "@/types";
import { db } from "./database";
import { useChatStore } from "./chatStore";
import { generateId } from "@/lib/utils";

interface AppState {
  currentWorkspaceId: UUID | null;
  currentChatId: UUID | null;
  currentScenarioId: string;
  viewingCharacterId: UUID | null;
  isSettingsOpen: boolean;
  settings: AppSettings;
  workspaces: Workspace[];
  chats: Chat[];
  isReady: boolean;

  initApp: () => Promise<void>;
  setCurrentWorkspace: (id: UUID | null) => void;
  setCurrentChat: (id: UUID | null) => Promise<void>;
  setCurrentScenario: (id: string) => void;
  openCharacterProfile: (id: UUID) => void;
  closeCharacterProfile: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  addWorkspace: (workspace: Workspace) => Promise<void>;
  updateWorkspace: (id: UUID, updates: Partial<Pick<Workspace, "name" | "description" | "background">>) => Promise<void>;
  addChat: (chat: Chat) => Promise<void>;
}

const defaultSettings: AppSettings = {
  llm: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
  },
  theme: "system",
  fontSize: "medium",
};

export const useAppStore = create<AppState>((set, get) => ({
  currentWorkspaceId: null,
  currentChatId: null,
  currentScenarioId: "pm-discussion",
  viewingCharacterId: null,
  isSettingsOpen: false,
  settings: defaultSettings,
  workspaces: [],
  chats: [],
  isReady: false,

  initApp: async () => {
    await db.init();
    const [workspaces, settings, scenarioSetting] = await Promise.all([
      db.listWorkspaces(),
      db.loadAppSettings(),
      db.getSetting("engine.currentScenario"),
    ]);

    const currentScenarioId = scenarioSetting
      ? (JSON.parse(scenarioSetting) as string)
      : "pm-discussion";

    // 如果没有工作区，创建默认工作区
    if (workspaces.length === 0) {
      const defaultWs: Workspace = {
        id: generateId(),
        name: "默认工作区",
        background: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.createWorkspace(defaultWs);
      set({ workspaces: [defaultWs], settings, currentScenarioId, isReady: true });
      return;
    }

    // 加载第一个工作区的讨论列表
    const firstWs = workspaces[0]!;
    const chats = await db.listChats(firstWs.id);
    set({
      workspaces,
      chats,
      currentWorkspaceId: firstWs.id,
      settings,
      currentScenarioId,
      isReady: true,
    });
  },

  setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),

  setCurrentChat: async (id) => {
    set({ currentChatId: id });
    if (id) {
      // 加载消息到 chatStore
      await useChatStore.getState().loadMessages(id);
      // 加载待处理的 choice
      const choice = await db.getPendingChoice(id);
      useChatStore.getState().setCurrentChoice(choice);
    } else {
      useChatStore.getState().clearMessages();
    }
  },

  setCurrentScenario: (id) => {
    set({ currentScenarioId: id });
    db.setSetting("engine.currentScenario", JSON.stringify(id), "engine").catch(() => {});
  },

  openCharacterProfile: (id) => set({ viewingCharacterId: id, isSettingsOpen: false }),
  closeCharacterProfile: () => set({ viewingCharacterId: null }),

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  updateSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    await db.saveAppSettings(newSettings);
  },

  addWorkspace: async (workspace) => {
    await db.createWorkspace(workspace);
    set((state) => ({ workspaces: [...state.workspaces, workspace] }));
  },

  updateWorkspace: async (id, updates) => {
    await db.updateWorkspace(id, updates);
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    }));
  },

  addChat: async (chat) => {
    await db.createChat(chat);
    set((state) => ({ chats: [...state.chats, chat] }));
  },
}));
