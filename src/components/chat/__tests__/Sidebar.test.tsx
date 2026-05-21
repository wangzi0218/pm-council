import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Define mocks before vi.mock (they get hoisted)
const { mockUseAppStore, mockSetCurrentChat, mockOpenSettings } = vi.hoisted(() => {
  const mockSetCurrentChat = vi.fn();
  const mockOpenSettings = vi.fn();
  const mockAppState = {
    currentChatId: null,
    chats: [
      { id: "chat-1", title: "小林等3人", characterIds: ["xiao-lin", "lao-chen", "a-zhe"], updatedAt: new Date().toISOString(), workspaceId: "ws-1" },
      { id: "chat-2", title: "小林", characterIds: ["xiao-lin"], updatedAt: new Date(Date.now() - 60000).toISOString(), workspaceId: "ws-1" },
    ],
    workspaces: [{ id: "ws-1", name: "默认工作区" }],
    currentWorkspaceId: "ws-1",
    currentScenarioId: "pm-discussion",
    setCurrentChat: mockSetCurrentChat,
    addChat: vi.fn(),
    openSettings: mockOpenSettings,
  };
  const mockUseAppStore = vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector(mockAppState));
  mockUseAppStore.getState = () => mockAppState;
  return { mockUseAppStore, mockSetCurrentChat, mockOpenSettings };
});

vi.mock("@/store/appStore", () => ({
  useAppStore: mockUseAppStore,
}));

vi.mock("@/store/chatStore", () => ({
  useChatStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    messages: [],
    streamingMessages: new Map(),
  })),
}));

vi.mock("@/store/database", () => ({
  db: {},
}));

vi.mock("@/lib/characters", () => ({
  getCharacter: vi.fn((id: string) => {
    const chars: Record<string, { id: string; name: string; color: string; avatar: string }> = {
      "xiao-lin": { id: "xiao-lin", name: "小林", color: "#22c55e", avatar: "林" },
      "lao-chen": { id: "lao-chen", name: "老陈", color: "#3b82f6", avatar: "陈" },
      "a-zhe": { id: "a-zhe", name: "阿哲", color: "#a855f7", avatar: "哲" },
    };
    return chars[id];
  }),
}));

// Import Sidebar AFTER mocks are set up
const { Sidebar } = await import("../Sidebar");

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sidebar header", () => {
    render(<Sidebar />);
    expect(screen.getByText("我的团队")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<Sidebar />);
    expect(screen.getByPlaceholderText("搜索对话...")).toBeInTheDocument();
  });

  it("renders 全员大群 button", () => {
    render(<Sidebar />);
    expect(screen.getByText("全员大群")).toBeInTheDocument();
  });

  it("renders chat list items", () => {
    render(<Sidebar />);
    expect(screen.getByText("小林等3人")).toBeInTheDocument();
    expect(screen.getAllByText("小林").length).toBeGreaterThan(0);
  });

  it("renders new chat button", () => {
    render(<Sidebar />);
    expect(screen.getByText("新建讨论")).toBeInTheDocument();
  });

  it("renders settings button", () => {
    render(<Sidebar />);
    expect(screen.getByLabelText("设置")).toBeInTheDocument();
  });

  it("opens settings when gear clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByLabelText("设置"));
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it("filters chats by search query", () => {
    render(<Sidebar />);
    const searchInput = screen.getByPlaceholderText("搜索对话...");
    fireEvent.change(searchInput, { target: { value: "小林" } });
    expect(screen.getByText("小林等3人")).toBeInTheDocument();
    expect(screen.getAllByText("小林").length).toBeGreaterThan(0);
  });

  it("shows no results for unmatched search", () => {
    render(<Sidebar />);
    const searchInput = screen.getByPlaceholderText("搜索对话...");
    fireEvent.change(searchInput, { target: { value: "不存在的对话" } });
    expect(screen.getByText("没有匹配的对话")).toBeInTheDocument();
  });

  it("calls setCurrentChat when chat clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText("小林等3人"));
    expect(mockSetCurrentChat).toHaveBeenCalledWith("chat-1");
  });
});
