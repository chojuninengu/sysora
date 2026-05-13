import { invoke } from "@tauri-apps/api/core";
import type {
  ProcessInfo,
  SystemSnapshot,
  DiskInfo,
  BatteryInfo,
  TraySnapshot,
  AppInfo,
} from "@/types";

export const api = {
  getProcesses: () => invoke<ProcessInfo[]>("get_processes"),
  killProcess:  (pid: number) => invoke<boolean>("kill_process", { pid }),
  getSystemInfo: () => invoke<SystemSnapshot>("get_system_info"),
  getDisks:     () => invoke<DiskInfo[]>("get_disks"),
  getBattery:   () => invoke<BatteryInfo>("get_battery"),
  getTraySnapshot: () => invoke<TraySnapshot>("get_tray_snapshot"),
  getInstalledApps: () => invoke<AppInfo[]>("get_installed_apps"),
  uninstallApp: (id: string, path: string) => invoke<void>("uninstall_app", { id, path }),
  getAppIconDataUrl: (path: string) => invoke<string>("get_app_icon_data_url", { path }),
};
