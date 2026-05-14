import { useState, useEffect, useCallback } from "react";
import { 
  Settings, 
  Bell, 
  Activity, 
  RotateCcw, 
  Save,
  Rocket,
  AlertCircle
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "@/types";

const DEFAULT_SETTINGS: AppSettings = {
  refresh_interval_secs: 3,
  launch_at_login: false,
  ram_alert_threshold: 85,
  cpu_alert_threshold: 80,
  start_minimized: false,
  temp_threshold: 85,
  temp_unit: "c",
  theme: "system",
};

export function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then(setSettings)
      .catch((e) => {
        console.error("Failed to load settings:", e);
        // If backend fails, use defaults so UI is still usable
        setSettings(DEFAULT_SETTINGS);
      });
  }, []);

  const handleSave = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    setError(null);
    setSaving(true);
    try {
      await invoke("save_settings", { settings: newSettings });
    } catch (e) {
      console.error("save_settings error:", e);
      setError(String(e));
    } finally {
      setTimeout(() => setSaving(false), 600);
    }
  }, []);

  if (!settings) {
    return (
      <div className="p-6 text-surface-400 dark:text-white/40 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-brand-600/40 border-t-brand-600 rounded-full animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="p-6 pb-20 space-y-8 max-w-2xl mx-auto overflow-y-auto max-h-[85vh]" style={{ scrollbarWidth: "thin" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center border border-brand-400/20">
            <Settings className="text-brand-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">System Settings</h2>
            <p className="text-xs text-surface-400 dark:text-white/40 font-medium">Configure how Sysora monitors and behaves</p>
          </div>
        </div>

        {saving && (
          <div className="flex items-center gap-2 text-[10px] text-brand-400 font-bold bg-brand-400/10 px-3 py-1.5 rounded-full border border-brand-400/20">
            <Save size={12} />
            Saved
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Save failed</p>
            <p className="text-[11px] text-red-400/70 mt-1 font-mono break-all">{error}</p>
          </div>
        </div>
      )}

      {/* Monitoring Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-surface-400 dark:text-white/50 px-1">
          <Activity size={14} className="text-brand-600 dark:text-brand-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Monitoring</h3>
        </div>

        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-surface-200 dark:border-white/10 p-5 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm text-surface-800 dark:text-white/90 font-semibold">Refresh Interval</label>
              <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-600/10 px-2 py-0.5 rounded border border-brand-600/20">
                {settings.refresh_interval_secs}s
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.refresh_interval_secs}
              onChange={(e) => handleSave({ ...settings, refresh_interval_secs: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-surface-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-600 dark:accent-brand-400"
            />
            <div className="flex justify-between text-[9px] font-bold text-surface-300 dark:text-white/20 uppercase tracking-widest px-1">
              <span>1s</span>
              <span>3s</span>
              <span>5s</span>
              <span>10s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Alerts Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-surface-400 dark:text-white/50 px-1">
          <Bell size={14} className="text-amber-600 dark:text-amber-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Alert Thresholds</h3>
        </div>

        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-surface-200 dark:border-white/10 p-5 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm text-surface-800 dark:text-white/90 font-semibold">CPU Alert</label>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-600/10 px-2 py-0.5 rounded border border-amber-600/20">
                {settings.cpu_alert_threshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={settings.cpu_alert_threshold}
              onChange={(e) => handleSave({ ...settings, cpu_alert_threshold: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-surface-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-600 dark:accent-amber-400"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm text-surface-800 dark:text-white/90 font-semibold">RAM Alert</label>
              <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-600/10 px-2 py-0.5 rounded border border-brand-600/20">
                {settings.ram_alert_threshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={settings.ram_alert_threshold}
              onChange={(e) => handleSave({ ...settings, ram_alert_threshold: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-surface-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-600 dark:accent-brand-400"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm text-surface-800 dark:text-white/90 font-semibold">Temperature Alert</label>
              <span className="text-xs font-mono font-bold text-red-500 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                {settings.temp_threshold}°C
              </span>
            </div>
            <input
              type="range"
              min="40"
              max="100"
              value={settings.temp_threshold}
              onChange={(e) => handleSave({ ...settings, temp_threshold: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-surface-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500 dark:accent-red-400"
            />
          </div>
        </div>
      </section>

      {/* Behavior Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-surface-400 dark:text-white/50 px-1">
          <Rocket size={14} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">App Preferences</h3>
        </div>

        <div className="bg-white/[0.03] rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5 dark:bg-white/[0.03] dark:border-white/10 bg-white border-surface-200">
          <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-all group dark:hover:bg-white/[0.02] hover:bg-surface-50">
            <div>
              <h4 className="text-sm font-semibold text-surface-800 dark:text-white group-hover:text-brand-400 transition-colors">Theme</h4>
              <p className="text-[10px] text-surface-400 dark:text-white/40 font-medium">Select your preferred appearance</p>
            </div>
            <div className="flex bg-surface-100 dark:bg-white/10 p-1 rounded-lg border border-surface-200 dark:border-white/5">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleSave({ ...settings, theme: t })}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all capitalize ${
                    settings.theme === t 
                      ? "bg-brand-600 text-white shadow-lg" 
                      : "text-surface-400 dark:text-white/40 hover:text-surface-800 dark:hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-all group dark:hover:bg-white/[0.02] hover:bg-surface-50">
            <div>
              <h4 className="text-sm font-semibold text-surface-800 dark:text-white group-hover:text-brand-400 transition-colors">Temperature Unit</h4>
              <p className="text-[10px] text-surface-400 dark:text-white/40 font-medium">Toggle between Celsius and Fahrenheit</p>
            </div>
            <div className="flex bg-surface-100 dark:bg-white/10 p-1 rounded-lg border border-surface-200 dark:border-white/5">
              <button
                onClick={() => handleSave({ ...settings, temp_unit: "c" })}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${settings.temp_unit === "c" ? "bg-brand-600 text-white shadow-lg" : "text-surface-400 dark:text-white/40 hover:text-surface-800 dark:hover:text-white"}`}
              >
                Celsius (°C)
              </button>
              <button
                onClick={() => handleSave({ ...settings, temp_unit: "f" })}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${settings.temp_unit === "f" ? "bg-brand-600 text-white shadow-lg" : "text-surface-400 dark:text-white/40 hover:text-surface-800 dark:hover:text-white"}`}
              >
                Fahrenheit (°F)
              </button>
            </div>
          </div>
          <Toggle
            label="Launch at Login"
            description="Automatically start Sysora when you log in"
            value={settings.launch_at_login}
            onChange={(v) => handleSave({ ...settings, launch_at_login: v })}
          />
          <Toggle
            label="Start Minimized"
            description="Launch directly to the system tray"
            value={settings.start_minimized}
            onChange={(v) => handleSave({ ...settings, start_minimized: v })}
          />
        </div>
      </section>

      {/* Reset */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={() => handleSave(DEFAULT_SETTINGS)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-white/20 hover:text-red-500 transition-all bg-surface-50 dark:bg-white/[0.02] hover:bg-red-500/10 px-5 py-2.5 rounded-xl border border-surface-200 dark:border-white/5 hover:border-red-500/20"
        >
          <RotateCcw size={12} />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="p-5 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-all group">
      <div>
        <h4 className="text-sm font-semibold text-surface-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{label}</h4>
        <p className="text-[10px] text-surface-400 dark:text-white/40 font-medium">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full relative transition-all duration-300 ${
          value ? "bg-brand-600 shadow-lg" : "bg-surface-200 dark:bg-white/10"
        }`}
      >
        <div
          className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${
            value ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
