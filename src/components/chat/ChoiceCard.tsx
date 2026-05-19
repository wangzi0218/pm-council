import { Check, Zap } from "lucide-react";
import type { ChoiceOption, PreferenceLeaning } from "@/types";
import { CHARACTERS } from "@/scenarios/pm-discussion/characters";

const characterMap = new Map(CHARACTERS.map((c) => [c.id, c]));

const leaningLabel: Record<PreferenceLeaning, string> = {
  strong: "强烈推荐",
  prefer: "倾向",
  neutral: "觉得也可以",
  against: "不太建议",
};

interface ChoiceCardProps {
  question: string;
  options: ChoiceOption[];
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  onSkip?: () => void;
  disabled: boolean;
}

export function ChoiceCard({
  question,
  options,
  selectedOptionId,
  onSelect,
  onSkip,
  disabled,
}: ChoiceCardProps) {
  return (
    <div className="animate-choice-in bg-background-secondary dark:bg-dark-background-secondary border border-border dark:border-dark-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-foreground-secondary dark:text-dark-foreground-secondary" />
        <span className="text-sm font-semibold text-foreground-secondary dark:text-dark-foreground-secondary">
          选择
        </span>
      </div>

      {/* Question */}
      <p className="text-[15px] font-medium text-foreground dark:text-dark-foreground mb-4">
        {question}
      </p>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            isSelected={selectedOptionId === option.id}
            isDisabled={disabled && selectedOptionId !== option.id}
            onClick={() => {
              if (!disabled) onSelect(option.id);
            }}
          />
        ))}
      </div>

      {/* Selected confirmation */}
      {selectedOptionId && (
        <div className="mt-4 text-sm text-primary font-medium">
          {(() => {
            const selected = options.find((o) => o.id === selectedOptionId);
            return selected
              ? `你选择了 ${selected.label}. ${selected.description}`
              : null;
          })()}
        </div>
      )}

      {/* Skip button */}
      {!selectedOptionId && !disabled && onSkip && (
        <div className="mt-3 pt-3 border-t border-border dark:border-dark-border">
          <button
            onClick={onSkip}
            className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground transition-colors"
          >
            跳过，继续讨论
          </button>
        </div>
      )}
    </div>
  );
}

interface OptionCardProps {
  option: ChoiceOption;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

function OptionCard({ option, isSelected, isDisabled, onClick }: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full text-left rounded-lg p-4 border transition-all ${
        isSelected
          ? "border-primary bg-primary/8 border-l-[3px] border-l-primary"
          : "border-border dark:border-dark-border hover:bg-background-chat dark:hover:bg-dark-background-chat hover:border-primary/50"
      } ${isDisabled ? "opacity-50 cursor-default" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-2">
        {isSelected && (
          <Check size={16} className="text-primary mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-sm text-foreground dark:text-dark-foreground">
            <span className="font-semibold">{option.label}.</span>{" "}
            {option.description}
          </p>

          {/* Character preferences */}
          {option.characterPreferences.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {option.characterPreferences.map((pref) => {
                const character = characterMap.get(pref.characterId);
                if (!character) return null;
                return (
                  <span
                    key={pref.characterId}
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: character.color }}
                    />
                    <span style={{ color: character.color }}>
                      {character.name}
                    </span>
                    <span className="text-foreground-secondary dark:text-dark-foreground-secondary">
                      {leaningLabel[pref.leaning]}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
