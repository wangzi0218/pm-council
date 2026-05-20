import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Save, Check } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { db } from "@/store/database";
import { CHARACTERS as PM_CHARACTERS } from "@/scenarios/pm-discussion/characters";
import { CHARACTERS as ENG_CHARACTERS } from "@/scenarios/engineering-review/characters";
import type { Character, Skill } from "@/types";

const ALL_SCENE_CHARACTERS = [...PM_CHARACTERS, ...ENG_CHARACTERS];

const DEFAULT_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export function CharacterProfile() {
  const viewingCharacterId = useAppStore((s) => s.viewingCharacterId);
  const closeProfile = useAppStore((s) => s.closeCharacterProfile);

  const [character, setCharacter] = useState<Character | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [characterSkills, setCharacterSkills] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [avatar, setAvatar] = useState("");
  const [personality, setPersonality] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (!viewingCharacterId) return;
    loadCharacter(viewingCharacterId);
  }, [viewingCharacterId]);

  const loadCharacter = async (id: string) => {
    setLoading(true);
    try {
      // Try DB first (custom characters)
      let char = await db.getCharacter(id);
      // Fallback to scene characters
      if (!char) {
        char = ALL_SCENE_CHARACTERS.find((c) => c.id === id) ?? null;
      }
      if (char) {
        setCharacter(char);
        setName(char.name);
        setColor(char.color);
        setAvatar(char.avatar);
        setPersonality(char.personality);
        setSpeakingStyle(char.speakingStyle);
        setSystemPrompt(char.systemPrompt);
      }

      // Load skills
      const allSkills = await db.listSkills();
      setSkills(allSkills);
      const assignments = await db.listCharacterSkills(id);
      const skillMap: Record<string, boolean> = {};
      for (const skill of allSkills) {
        const found = assignments.find((a) => a.skillId === skill.id);
        skillMap[skill.id] = found ? found.enabled : false;
      }
      setCharacterSkills(skillMap);
    } catch {
      // 加载失败
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!character) return;
    await db.updateCharacter(character.id, {
      name: name.trim(),
      color,
      avatar: avatar.trim() || name.trim()[0]!,
      personality: personality.trim(),
      speakingStyle: speakingStyle.trim(),
      systemPrompt: systemPrompt.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [character, name, color, avatar, personality, speakingStyle, systemPrompt]);

  const handleSkillToggle = useCallback(async (skillId: string) => {
    if (!character) return;
    const current = characterSkills[skillId] ?? false;
    const next = !current;
    setCharacterSkills((prev) => ({ ...prev, [skillId]: next }));
    try {
      await db.setCharacterSkill(character.id, skillId, next);
    } catch {
      setCharacterSkills((prev) => ({ ...prev, [skillId]: current }));
    }
  }, [character, characterSkills]);

  if (!viewingCharacterId) return null;

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-foreground-secondary dark:text-dark-foreground-secondary">加载中...</p>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-foreground-secondary dark:text-dark-foreground-secondary">角色不存在</p>
          <button onClick={closeProfile} className="text-sm text-primary hover:underline">返回</button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-border dark:border-dark-border">
        <button
          onClick={closeProfile}
          className="p-1.5 hover:bg-background-chat dark:hover:bg-dark-background-chat rounded-md transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{name}</h1>
          <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary truncate">
            {character.isBuiltin ? "内置角色" : "自定义角色"}
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "已保存" : "保存"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">
          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              基本信息
            </h2>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">名字</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="w-20 space-y-1.5">
                <label className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">头像</label>
                <input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">颜色</label>
              <div className="flex gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Persona */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              人设
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">性格</label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">说话风格</label>
              <textarea
                value={speakingStyle}
                onChange={(e) => setSpeakingStyle(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono"
              />
            </div>
          </section>

          {/* Skills */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              技能
            </h2>
            <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary -mt-2">
              启用的技能会在讨论中自然运用。
            </p>

            <div className="space-y-2">
              {skills.map((skill) => (
                <label
                  key={skill.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border dark:border-dark-border hover:bg-background-chat dark:hover:bg-dark-background-chat transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={characterSkills[skill.id] ?? false}
                    onChange={() => handleSkillToggle(skill.id)}
                    className="mt-0.5 w-4 h-4 rounded border-border dark:border-dark-border text-primary focus:ring-primary/50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary mt-0.5">
                      {skill.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
