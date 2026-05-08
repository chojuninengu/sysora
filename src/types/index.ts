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
}

export type TabId =
  | "memory"
  | "processes"
  | "apps"
  | "disk"
  | "system-info"
  | "settings";
