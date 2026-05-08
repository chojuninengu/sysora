import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Shell } from "@/components/layout/Shell";
import { useAppStore } from "@/store/app";
import type { TabId } from "@/types";

export default function App() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  // Listen for tray "System Info" / "Settings" menu navigation
  useEffect(() => {
    const unlisten = listen<TabId>("navigate", (event) => {
      setActiveTab(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setActiveTab]);

  return <Shell />;
}
