import {
  Activity, List, AppWindow, HardDrive,
  Info, Settings, Cpu, Globe, History
} from "lucide-react";
import { useAppStore } from "@/store/app";
import type { TabId } from "@/types";

const NAV = [
  { section: "Monitor" },
  { id: "memory",     label: "Memory",     icon: Activity  },
  { id: "processes",  label: "Processes",  icon: List      },
  { id: "network",    label: "Network",    icon: Globe     },
  { id: "history",    label: "History",    icon: History   },
  { section: "Manage" },
  { id: "apps",       label: "Applications", icon: AppWindow },
  { id: "disk",       label: "Disk Scanner", icon: HardDrive },
  { section: "System" },
  { id: "system-info", label: "System Info", icon: Info     },
  { id: "settings",   label: "Settings",   icon: Settings  },
] as const;

export function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col bg-white border-r border-surface-200 dark:bg-surface-900 dark:border-white/5 select-none transition-colors">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-surface-200 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center glow-brand">
            <Cpu size={15} className="text-brand-100" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white leading-none">Sysora</p>
            <p className="text-[10px] text-surface-400 dark:text-white/30 mt-0.5">System Monitor</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item, i) => {
          if ("section" in item) {
            return (
              <p key={i} className="px-2 pt-4 pb-1 text-[10px] font-medium text-surface-300 dark:text-white/25 uppercase tracking-widest first:pt-2">
                {item.section}
              </p>
            );
          }
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabId)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-brand-600/20 text-brand-600 dark:text-brand-200 font-medium"
                  : "text-surface-400 hover:text-surface-900 hover:bg-surface-100 dark:text-white/40 dark:hover:text-white/70 dark:hover:bg-white/5"
              }`}
            >
              <Icon size={15} className={active ? "text-brand-600 dark:text-brand-400" : ""} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Version footer */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-white/5">
        <p className="text-[10px] text-surface-400 dark:text-white/20">v0.3.0 · Phase 4</p>
      </div>
    </aside>
  );
}
