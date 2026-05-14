import { Search, Circle } from "lucide-react";
import { useAppStore } from "@/store/app";

const TAB_TITLES: Record<string, string> = {
  memory:      "Memory Monitor",
  processes:   "Process Manager",
  apps:        "Applications",
  disk:        "Disk Scanner",
  "system-info": "System Info",
  settings:    "Settings",
};

export function TopBar() {
  const { activeTab, searchQuery, setSearchQuery } = useAppStore();
  const showSearch = ["memory", "processes", "apps"].includes(activeTab);

  return (
    <header className="h-12 flex-shrink-0 flex items-center gap-3 px-5 border-b border-surface-200 dark:border-white/5 bg-white dark:bg-surface-900 transition-colors">
      <h1 className="text-sm font-medium text-surface-400 dark:text-white/60 min-w-[160px]">
        {TAB_TITLES[activeTab]}
      </h1>

      {showSearch && (
        <div className="flex-1 max-w-xs relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300 dark:text-white/25" />
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-lg text-surface-800 dark:text-white/80 placeholder-surface-300 dark:placeholder-white/25 focus:outline-none focus:border-brand-600/60 focus:bg-white/8 transition-colors"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Circle size={6} className="fill-emerald-400 text-emerald-400 animate-pulse-slow" />
          <span className="text-[11px] text-surface-400 dark:text-white/30">Live · 3s</span>
        </div>
      </div>
    </header>
  );
}
