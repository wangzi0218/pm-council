import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatHeader } from "../ChatHeader";
import { useAppStore } from "@/store/appStore";

vi.mock("@/store/appStore", () => ({
  useAppStore: vi.fn(),
}));

vi.mock("@/store/database", () => ({
  db: {},
}));

describe("ChatHeader", () => {
  const mockOnOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows chat title when chat exists", () => {
    (useAppStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        currentChatId: "chat-1",
        chats: [{ id: "chat-1", title: "小林等6人", characterIds: ["xiao-lin", "lao-chen"] }],
      });
    });

    render(<ChatHeader onOpenSettings={mockOnOpenSettings} />);
    expect(screen.getByText("小林等6人")).toBeInTheDocument();
  });

  it("shows settings button when onOpenSettings provided", () => {
    (useAppStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        currentChatId: "chat-1",
        chats: [{ id: "chat-1", title: "Test", characterIds: [] }],
      });
    });

    render(<ChatHeader onOpenSettings={mockOnOpenSettings} />);
    expect(screen.getByTitle("对话设置")).toBeInTheDocument();
  });

  it("calls onOpenSettings when gear clicked", () => {
    (useAppStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        currentChatId: "chat-1",
        chats: [{ id: "chat-1", title: "Test", characterIds: [] }],
      });
    });

    render(<ChatHeader onOpenSettings={mockOnOpenSettings} />);
    fireEvent.click(screen.getByTitle("对话设置"));
    expect(mockOnOpenSettings).toHaveBeenCalled();
  });

  it("does not show settings button when onOpenSettings not provided", () => {
    (useAppStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        currentChatId: "chat-1",
        chats: [{ id: "chat-1", title: "Test", characterIds: [] }],
      });
    });

    render(<ChatHeader />);
    expect(screen.queryByTitle("对话设置")).not.toBeInTheDocument();
  });

  it("renders nothing when no current chat", () => {
    (useAppStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        currentChatId: null,
        chats: [],
      });
    });

    const { container } = render(<ChatHeader onOpenSettings={mockOnOpenSettings} />);
    expect(container.innerHTML).toBe("");
  });
});
