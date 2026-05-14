import { invoke } from "@tauri-apps/api/core";
import type {
  ProcessInfo,
  SystemSnapshot,
  DiskInfo,
  BatteryInfo,
  TraySnapshot,
  AppInfo,
  AppSettings,
  DiskEntry,
  ScanProgress,
  HistoryPoint,
} from "@/types";

export const api = {
  getProcesses: () => invoke<ProcessInfo[]>("get_processes"),
  killProcess: (pid: number) => invoke<void>("kill_process", { pid }),
  getSystemInfo: () => invoke<SystemSnapshot>("get_system_info"),
  getDisks: () => invoke<DiskInfo[]>("get_disks"),
  getBattery: () => invoke<BatteryInfo>("get_battery"),
  getTraySnapshot: () => invoke<TraySnapshot>("get_tray_snapshot"),
  getInstalledApps: () => invoke<AppInfo[]>("get_installed_apps"),
  uninstallApp: (id: string, path: string) => invoke<void>("uninstall_app", { id, path }),
  getAppIconDataUrl: (path: string) => invoke<string>("get_app_icon_data_url", { path }),
  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
  scanDirectory: (path: string) => invoke<void>("scan_directory", { path }),
  getScanResults: () => invoke<[boolean, DiskEntry[]]>("get_scan_results"),
  deletePath: (path: string) => invoke<void>("delete_path", { path }),
  getHistory: () => invoke<HistoryPoint[]>("get_history"),
};
