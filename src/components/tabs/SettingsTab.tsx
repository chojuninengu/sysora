import { Settings } from "lucide-react";

export function SettingsTab() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center">
        <Settings size={20} className="text-brand-400" />
      </div>
      <h2 className="text-sm font-medium text-white/60">Settings — coming in Phase 2</h2>
      <p className="text-xs text-white/30 max-w-xs">
        Configure refresh rate, startup behaviour, notification thresholds, and auto-launch on login.
      </p>
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-600/20 text-brand-300 border border-brand-600/30">
        Roadmap · Phase 2
      </span>
    </div>
  );
}
