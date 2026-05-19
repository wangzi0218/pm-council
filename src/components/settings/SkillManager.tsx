import { useState, useEffect, useCallback } from "react";
import { db } from "@/store/database";
import { CHARACTERS } from "@/scenarios/pm-discussion/characters";
import type { Skill } from "@/types";

interface CharacterSkillState {
  [characterId: string]: { [skillId: string]: boolean };
}

export function SkillManager() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [state, setState] = useState<CharacterSkillState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const allSkills = await db.listSkills();
      setSkills(allSkills);

      const newState: CharacterSkillState = {};
      for (const char of CHARACTERS) {
        const assignments = await db.listCharacterSkills(char.id);
        const charSkills: Record<string, boolean> = {};
        for (const skill of allSkills) {
          const found = assignments.find((a) => a.skillId === skill.id);
          charSkills[skill.id] = found ? found.enabled : false;
        }
        newState[char.id] = charSkills;
      }
      setState(newState);
    } catch {
      // 加载失败不影响使用
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = useCallback(async (characterId: string, skillId: string) => {
    const current = state[characterId]?.[skillId] ?? false;
    const next = !current;

    // 乐观更新
    setState((prev) => ({
      ...prev,
      [characterId]: { ...prev[characterId], [skillId]: next },
    }));

    try {
      await db.setCharacterSkill(characterId, skillId, next);
    } catch {
      // 回滚
      setState((prev) => ({
        ...prev,
        [characterId]: { ...prev[characterId], [skillId]: current },
      }));
    }
  }, [state]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
          技能管理
        </h3>
        <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">加载中...</p>
      </div>
    );
  }

  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
        技能管理
      </h3>
      <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary -mt-2">
        为每个 NPC 启用或禁用方法论技能，NPC 会在讨论中自然运用已启用的技能。
      </p>

      <div className="space-y-3">
        {CHARACTERS.map((char) => (
          <div
            key={char.id}
            className="rounded-lg border border-border dark:border-dark-border p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0"
                style={{ backgroundColor: char.color }}
              >
                {char.avatar}
              </div>
              <span className="text-sm font-medium">{char.name}</span>
            </div>

            <div className="space-y-1.5 pl-8">
              {skills.map((skill) => (
                <label
                  key={skill.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={state[char.id]?.[skill.id] ?? false}
                    onChange={() => handleToggle(char.id, skill.id)}
                    className="w-3.5 h-3.5 rounded border-border dark:border-dark-border text-primary focus:ring-primary/50"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm group-hover:text-foreground dark:group-hover:text-dark-foreground transition-colors">
                      {skill.name}
                    </span>
                    <span className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary ml-1.5 hidden group-hover:inline">
                      — {skill.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
