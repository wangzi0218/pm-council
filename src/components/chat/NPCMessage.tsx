import { useState } from "react";
import type { Message, ImageAttachment, MessageQuote } from "@/types";
import { getCharacter } from "@/lib/characters";
import { X } from "lucide-react";

interface NPCMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function NPCMessage({ message, isStreaming }: NPCMessageProps) {
  const character = message.characterId
    ? getCharacter(message.characterId)
    : undefined;

  const name = character?.name ?? "NPC";
  const avatar = character?.avatar ?? name[0];
  const color = character?.color ?? "#6b7280";
  const quote = message.metadata?.quote;

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: color }}
      >
        {avatar}
      </div>

      {/* Content */}
      <div className="max-w-[70%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color }}>
            {name}
          </span>
          <span className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">
            {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div
          className="rounded-[var(--radius-bubble)] px-4 py-3 text-sm leading-relaxed border whitespace-pre-wrap"
          style={{
            backgroundColor: `${color}10`,
            borderColor: `${color}25`,
          }}
        >
          {/* Quote block */}
          {quote && <QuoteBlock quote={quote} />}

          {message.content}
          {isStreaming && (
            <span className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom animate-pulse" style={{ backgroundColor: color }} />
          )}

          {/* Image attachments */}
          {message.images.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {message.images.map((img) => (
                <ImageThumb key={img.id} image={img} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteBlock({ quote }: { quote: MessageQuote }) {
  const displayContent =
    quote.content.length > 30
      ? quote.content.slice(0, 30) + "..."
      : quote.content;

  return (
    <div
      className="mb-2 pl-2 py-1.5 rounded border-l-2 bg-black/[0.03] dark:bg-white/[0.05]"
      style={{ borderLeftColor: quote.characterColor }}
    >
      <span
        className="text-xs font-medium"
        style={{ color: quote.characterColor }}
      >
        引用{quote.characterName}
      </span>
      <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary mt-0.5">
        "{displayContent}"
      </p>
    </div>
  );
}

function ImageThumb({ image }: { image: ImageAttachment }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="block rounded-lg overflow-hidden border border-border dark:border-dark-border hover:border-primary/50 transition-colors"
      >
        <img
          src={`data:${image.mimeType};base64,${image.data}`}
          alt={image.filename}
          className="max-w-[300px] max-h-[200px] object-cover"
        />
      </button>

      {/* Lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-background dark:bg-dark-background rounded-full flex items-center justify-center shadow-lg"
            >
              <X size={16} />
            </button>
            <img
              src={`data:${image.mimeType};base64,${image.data}`}
              alt={image.filename}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
