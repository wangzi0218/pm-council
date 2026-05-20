import { useState, useEffect, useCallback } from "react";
import { X, Bot, Users, Zap } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { createProvider } from "@/llm/factory";
import { PROVIDER_PRESETS } from "@/llm/presets";
import { SkillManager } from "./SkillManager";
import { CharacterManager } from "./CharacterManager";
import type { LLMProviderType } from "@/types";

type SettingsTab = "llm" | "characters" | "skills";

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Bot }> = [
  { id: "llm", label: "模型", icon: Bot },
  { id: "characters", label: "角色", icon: Users },
  { id: "skills", label: "技能", icon: Zap },
];

export function SettingsPanel() {
  const closeSettings = useAppStore((s) => s.closeSettings);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [activeTab, setActiveTab] = useState<SettingsTab>("llm");
  const [provider, setProvider] = useState<LLMProviderType>(settings.llm.provider);
  const [baseUrl, setBaseUrl] = useState(settings.llm.baseUrl);
  const [apiKey, setApiKey] = useState(settings.llm.apiKey);
  const [model, setModel] = useState(settings.llm.model);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDirty =
    provider !== settings.llm.provider ||
    baseUrl !== settings.llm.baseUrl ||
    apiKey !== settings.llm.apiKey ||
    model !== settings.llm.model;

  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm("有未保存的更改，确定离开吗？")) return;
    closeSettings();
  }, [isDirty, closeSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        llm: { provider, baseUrl, apiKey, model },
      });
      closeSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey) {
      setTestResult("请先填写 API Key");
      return;
    }
    setTestResult("测试中...");
    try {
      const llmProvider = createProvider({ provider, baseUrl, apiKey, model });
      const result = await llmProvider.testConnection();
      if (result.success) {
        setTestResult(`连接成功 (${result.latencyMs}ms)`);
      } else {
        setTestResult(`连接失败：${result.error ?? "未知错误"}`);
      }
    } catch (err) {
      setTestResult(`测试出错：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="ml-auto w-[420px] bg-background dark:bg-dark-background border-l border-border dark:border-dark-border flex flex-col relative" role="dialog" aria-modal="true" aria-label="设置">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-dark-border">
          <h2 className="text-base font-semibold">设置</h2>
          <button
            onClick={handleClose}
            aria-label="关闭设置"
            className="p-1 hover:bg-background-chat dark:hover:bg-dark-background-chat rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border dark:border-dark-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary font-medium"
                    : "text-foreground-secondary dark:text-dark-foreground-secondary hover:text-foreground dark:hover:text-dark-foreground"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "llm" && (
            <LLMConfigTab
              provider={provider}
              baseUrl={baseUrl}
              apiKey={apiKey}
              model={model}
              testResult={testResult}
              onProviderChange={setProvider}
              onBaseUrlChange={setBaseUrl}
              onApiKeyChange={setApiKey}
              onModelChange={setModel}
              onTest={handleTest}
            />
          )}

          {activeTab === "characters" && <CharacterManager />}
          {activeTab === "skills" && <SkillManager />}
        </div>

        {/* Footer — only show on LLM tab */}
        {activeTab === "llm" && (
          <div className="p-4 border-t border-border dark:border-dark-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LLM Config Tab
// ---------------------------------------------------------------------------

interface LLMConfigTabProps {
  provider: LLMProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  testResult: string | null;
  onProviderChange: (p: LLMProviderType) => void;
  onBaseUrlChange: (url: string) => void;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onTest: () => void;
}

function LLMConfigTab({
  provider, baseUrl, apiKey, model, testResult,
  onProviderChange, onBaseUrlChange, onApiKeyChange, onModelChange, onTest,
}: LLMConfigTabProps) {
  // Find current preset by matching baseUrl
  const currentPreset = PROVIDER_PRESETS.find((p) => p.baseUrl === baseUrl && p.format === provider);
  const [selectedPresetId, setSelectedPresetId] = useState(currentPreset?.id ?? "custom");

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset && preset.id !== "custom") {
      onProviderChange(preset.format);
      onBaseUrlChange(preset.baseUrl);
      onModelChange(preset.defaultModel);
    }
  };

  const isCustom = selectedPresetId === "custom";

  return (
    <div className="space-y-4">
      {/* Provider Preset */}
      <div className="space-y-1.5">
        <label className="text-sm">服务提供商</label>
        <select
          value={selectedPresetId}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Format indicator */}
      <div className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">
        {isCustom ? "自定义配置" : `API 格式：${provider === "claude" ? "Claude Messages API" : "OpenAI 兼容"}`}
      </div>

      {/* API Key (always shown) */}
      <div className="space-y-1.5">
        <label className="text-sm">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="sk-..."
        />
      </div>

      {/* Base URL (editable for custom, shown but dimmed for presets) */}
      <div className="space-y-1.5">
        <label className="text-sm">API 地址</label>
        <input
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="https://api.openai.com/v1"
        />
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="text-sm">模型</label>
        {currentPreset && currentPreset.models.length > 0 && !isCustom ? (
          <div className="space-y-1.5">
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {currentPreset.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="或输入其他模型名"
            />
          </div>
        ) : (
          <input
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="gpt-4o"
          />
        )}
      </div>

      {/* Test */}
      <button
        onClick={onTest}
        className="w-full px-3 py-2 text-sm border border-border dark:border-dark-border rounded-md hover:bg-background-chat dark:hover:bg-dark-background-chat transition-colors"
      >
        测试连接
      </button>
      {testResult && (
        <p className="text-xs text-foreground-secondary dark:text-dark-foreground-secondary">
          {testResult}
        </p>
      )}
    </div>
  );
}
