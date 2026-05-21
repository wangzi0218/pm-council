import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InputArea } from "../InputArea";
import { useChatStore } from "@/store/chatStore";
import { useAppStore } from "@/store/appStore";

// Mock stores
vi.mock("@/store/chatStore", () => ({
  useChatStore: vi.fn(),
}));

vi.mock("@/store/appStore", () => ({
  useAppStore: vi.fn(),
}));

vi.mock("@/store/database", () => ({
  db: {
    getActiveSkillsForCharacter: vi.fn().mockResolvedValue([]),
  },
}));

describe("InputArea", () => {
  const mockOnSendMessage = vi.fn();
  const mockOnAddImages = vi.fn();
  const mockOnRemoveImage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isTyping: false,
        typingChatId: null,
      };
      return selector(state);
    });
    (useAppStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        currentChatId: "chat-1",
      };
      return selector(state);
    });
  });

  it("renders input field with placeholder", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    expect(screen.getByPlaceholderText(/输入你的想法/)).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const sendButton = screen.getByLabelText("发送");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/);
    fireEvent.change(input, { target: { value: "测试消息" } });
    const sendButton = screen.getByLabelText("发送");
    expect(sendButton).not.toBeDisabled();
  });

  it("calls onSendMessage when send button clicked", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/);
    fireEvent.change(input, { target: { value: "测试消息" } });
    const sendButton = screen.getByLabelText("发送");
    fireEvent.click(sendButton);
    expect(mockOnSendMessage).toHaveBeenCalledWith("测试消息", []);
  });

  it("calls onSendMessage on Enter key", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/);
    fireEvent.change(input, { target: { value: "测试消息" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockOnSendMessage).toHaveBeenCalledWith("测试消息", []);
  });

  it("does not send on Shift+Enter", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/);
    fireEvent.change(input, { target: { value: "测试消息" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("clears input after sending", () => {
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "测试消息" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });

  it("disables input when typing in current chat", () => {
    (useChatStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        isTyping: true,
        typingChatId: "chat-1",
      });
    });

    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/);
    expect(input).toBeDisabled();
  });

  it("allows input when typing in different chat", () => {
    (useChatStore as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      return selector({
        isTyping: true,
        typingChatId: "chat-other",
      });
    });

    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={[]}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const input = screen.getByPlaceholderText(/输入你的想法/);
    expect(input).not.toBeDisabled();
  });

  it("shows pending images", () => {
    const images = [
      { id: "1", filename: "test.png", mimeType: "image/png", localPath: "", data: "base64data" },
    ];
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={images}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    expect(screen.getByAltText("test.png")).toBeInTheDocument();
  });

  it("enables send when only images pending", () => {
    const images = [
      { id: "1", filename: "test.png", mimeType: "image/png", localPath: "", data: "base64data" },
    ];
    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        pendingImages={images}
        onAddImages={mockOnAddImages}
        onRemoveImage={mockOnRemoveImage}
      />,
    );
    const sendButton = screen.getByLabelText("发送");
    expect(sendButton).not.toBeDisabled();
  });
});
