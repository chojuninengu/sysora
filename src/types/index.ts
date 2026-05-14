export interface ProcessInfo {
  pid: number;
  name: string;
  memory_bytes: number;
  memory_label: string;
  cpu_usage: number;
  threads: number;
  status: string;
}

export interface SystemSnapshot {
  total_memory: number;
  used_memory: number;
  total_swap: number;
  used_swap: number;
  cpu_usage: number;
  cpu_count: number;
  cpu_brand: string;
  os_name: string;
  os_version: string;
  kernel_version: string;
  hostname: string;
  uptime_secs: number;
}

export interface DiskInfo {
  name: string;
  mount: string;
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  file_system: string;
  removable: boolean;
}

export interface BatteryInfo {
  present: boolean;
  charge_percent: number;
  health_percent: number;
  design_capacity_mwh: number | null;
  current_capacity_mwh: number | null;
  cycle_count: number | null;
  status: string;
  time_to_empty_mins: number | null;
}

export interface TraySnapshot {
  cpu_usage: number;
  used_memory: number;
  total_memory: number;
  disk_used_pct: number;
  battery: BatteryInfo;
  network: [number, number];
}

export interface AppInfo {
  id: string;
  name: string;
  version: string;
  install_path: string;
  size_bytes: number;
  icon_path: string;
}

export interface AppSettings {
  refresh_interval_secs: number;
  launch_at_login: boolean;
  ram_alert_threshold: number;
  cpu_alert_threshold: number;
  start_minimized: boolean;
}

export interface DiskEntry {
  path: string;
  name: string;
  size_bytes: number;
  is_dir: boolean;
}

export interface NetworkInterface {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_speed: number;
  tx_speed: number;
  total_rx: number;
  total_tx: number;
  mac_address: string;
  ip_address: string;
}

export interface NetworkHistoryPoint {
  ts: number;
  rx_speed: number;
  tx_speed: number;
}

export interface ScanProgress {
  scanned: number;
  current_path: string;
}

export interface HistoryPoint {
  ts: number;
  cpu: number;
  ram_used: number;
}

export type TabId =
  | "memory"
  | "processes"
  | "network"
  | "apps"
  | "disk"
  | "system-info"
  | "settings";
