import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "@/store/chatStore";
import { NPCMessage } from "@/components/chat/NPCMessage";
import { UserMessage } from "@/components/chat/UserMessage";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ChoiceCard } from "@/components/chat/ChoiceCard";
import { ChevronDown } from "lucide-react";

interface MessageListProps {
  onSelectChoice: (choiceId: string, optionId: string) => void;
  onSkipChoice?: (choiceId: string) => void;
}

export function MessageList({ onSelectChoice, onSkipChoice }: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const isTyping = useChatStore((s) => s.isTyping);
  const typingCharacterId = useChatStore((s) => s.typingCharacterId);
  const currentChoice = useChatStore((s) => s.currentChoice);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Auto-scroll when messages change or typing starts
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Check if user is near the bottom (within 150px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (isNearBottom) {
      // Use a small delay to let the DOM update
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } else {
      setShowScrollButton(true);
    }
  }, [messages, isTyping, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    setShowScrollButton(!isNearBottom);
  };

  const isChoiceDisabled =
    currentChoice?.status === "resolved" || currentChoice?.status === "skipped";

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="animate-message-in">
              <UserMessage message={msg} />
            </div>
          ) : msg.role === "character" ? (
            <div key={msg.id} className="animate-message-in">
              <NPCMessage message={msg} isStreaming={msg.id === streamingMessageId} />
            </div>
          ) : null
        )}

        {isTyping && typingCharacterId && !streamingMessageId && (
          <TypingIndicator characterId={typingCharacterId} />
        )}

        {currentChoice && (
          <ChoiceCard
            question={currentChoice.question}
            options={currentChoice.options}
            selectedOptionId={currentChoice.selectedOptionId}
            onSelect={(optionId) =>
              onSelectChoice(currentChoice.id, optionId)
            }
            onSkip={onSkipChoice ? () => onSkipChoice(currentChoice.id) : undefined}
            disabled={isChoiceDisabled}
          />
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-background dark:bg-dark-background border border-border dark:border-dark-border shadow-md flex items-center justify-center hover:bg-background-chat dark:hover:bg-dark-background-chat transition-colors"
          aria-label="滚动到底部"
        >
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
