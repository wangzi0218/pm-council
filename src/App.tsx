import { useEffect } from "react";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatView } from "@/components/chat/ChatView";
import { CharacterProfile } from "@/components/character/CharacterProfile";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useAppStore } from "@/store/appStore";

function App() {
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const viewingCharacterId = useAppStore((s) => s.viewingCharacterId);
  const isReady = useAppStore((s) => s.isReady);
  const initApp = useAppStore((s) => s.initApp);
  const theme = useAppStore((s) => s.settings.theme);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Apply dark mode class to <html> based on theme setting
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.add("light");
    } else {
      // system: follow OS preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    }
  }, [theme]);

  if (!isReady) {
    return (
      <div className="flex h-screen bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground items-center justify-center">
        <div className="text-foreground-secondary dark:text-dark-foreground-secondary text-sm">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground dark:bg-dark-background dark:text-dark-foreground">
      <Sidebar />
      {viewingCharacterId ? <CharacterProfile /> : <ChatView />}
      {isSettingsOpen && <SettingsPanel />}
    </div>
  );
}

export default App;
