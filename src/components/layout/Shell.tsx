import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MemoryTab }    from "@/components/tabs/MemoryTab";
import { ProcessesTab } from "@/components/tabs/ProcessesTab";
import { AppsTab }      from "@/components/tabs/AppsTab";
import { DiskTab }      from "@/components/tabs/DiskTab";
import { SystemInfoTab } from "@/components/tabs/SystemInfoTab";
import { SettingsTab }  from "@/components/tabs/SettingsTab";
import { useAppStore }  from "@/store/app";

export function Shell() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-900 text-white font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-5 animate-fade-in">
          {activeTab === "memory"      && <MemoryTab />}
          {activeTab === "processes"   && <ProcessesTab />}
          {activeTab === "apps"        && <AppsTab />}
          {activeTab === "disk"        && <DiskTab />}
          {activeTab === "system-info" && <SystemInfoTab />}
          {activeTab === "settings"    && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}
