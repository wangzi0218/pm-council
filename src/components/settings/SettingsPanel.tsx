import { useState, useEffect, useCallback } from "react";
import { X, Bot, Users, Zap, Download, Upload } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useChatStore } from "@/store/chatStore";
import { db } from "@/store/database";
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

          {/* Data Management — always visible */}
          <div className="pt-4 mt-4 border-t border-border dark:border-dark-border space-y-3">
            <h3 className="text-sm font-medium text-foreground-secondary dark:text-dark-foreground-secondary">
              数据管理
            </h3>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const workspaces = useAppStore.getState().workspaces;
                    if (workspaces.length === 0) return;
                    const json = await db.exportWorkspace(workspaces[0]!.id);
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `my-forum-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    alert(`导出失败：${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-border dark:border-dark-border rounded-md hover:bg-background-chat dark:hover:bg-dark-background-chat transition-colors"
              >
                <Download size={14} />
                导出数据
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm("导入将覆盖当前数据，确定继续吗？")) return;
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const wsId = await db.importWorkspace(text);
                      const workspaces = await db.listWorkspaces();
                      const chats = await db.listChats(wsId);
                      useAppStore.setState({ workspaces, chats, currentWorkspaceId: wsId, currentChatId: null });
                      useChatStore.getState().clearMessages();
                      alert("导入成功！");
                    } catch (e) {
                      alert(`导入失败：${e instanceof Error ? e.message : String(e)}`);
                    }
                  };
                  input.click();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-border dark:border-dark-border rounded-md hover:bg-background-chat dark:hover:bg-dark-background-chat transition-colors"
              >
                <Upload size={14} />
                导入数据
              </button>
            </div>
          </div>
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
      {/* Provider Grid */}
      <div className="space-y-1.5">
        <label className="text-sm">服务提供商</label>
        <div className="grid grid-cols-4 gap-2">
          {PROVIDER_PRESETS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition-all ${
                  selectedPresetId === p.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border dark:border-dark-border hover:border-foreground/20 dark:hover:border-dark-foreground/20"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: p.color }}
                >
                  <Icon size={16} />
                </div>
                <span className="text-[11px] font-medium leading-tight text-center">{p.name}</span>
              </button>
            );
          })}
        </div>
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
        <input
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-background-chat dark:bg-dark-background-chat rounded-md border border-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={isCustom ? "模型名称" : currentPreset?.defaultModel ?? "模型名称"}
        />
        {currentPreset && !isCustom && (
          <p className="text-[11px] text-foreground-secondary dark:text-dark-foreground-secondary">
            默认：{currentPreset.defaultModel}，可自行修改
          </p>
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
