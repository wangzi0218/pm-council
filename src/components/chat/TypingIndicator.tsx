import { getCharacter, getCharacterName, getCharacterColor } from "@/lib/characters";

interface TypingIndicatorProps {
  characterId: string;
}

export function TypingIndicator({ characterId }: TypingIndicatorProps) {
  const name = getCharacterName(characterId);
  const color = getCharacterColor(characterId);
  const character = getCharacter(characterId);
  const avatar = character?.avatar ?? name[0];

  return (
    <div className="flex gap-3">
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: color }}
      >
        {avatar}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color }}>
            {name}
          </span>
        </div>
        <div
          className="rounded-[var(--radius-bubble)] px-4 py-3 border"
          style={{
            backgroundColor: `${color}10`,
            borderColor: `${color}25`,
          }}
        >
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{
                  backgroundColor: color,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1.2s",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
