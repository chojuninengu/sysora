use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Mutex;
use sysinfo::{Disks, System};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};
use tokio::time::{sleep, Duration};

// ─── Shared system state ────────────────────────────────────────────────────
#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct AppSettings {
    pub refresh_interval_secs: u64,
    pub launch_at_login: bool,
    pub ram_alert_threshold: f32,
    pub cpu_alert_threshold: f32,
    pub start_minimized: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            refresh_interval_secs: 3,
            launch_at_login: false,
            ram_alert_threshold: 85.0,
            cpu_alert_threshold: 80.0,
            start_minimized: false,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct SnapPoint {
    pub ts: u64,
    pub cpu: f32,
    pub ram_used: u64,
}

pub struct SysState {
    pub sys: Mutex<System>,
    pub settings: Mutex<AppSettings>,
    pub history: Mutex<VecDeque<SnapPoint>>,
}

// ─── Data types (serialized to JSON for the frontend) ───────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory_bytes: u64,
    pub memory_label: String,
    pub cpu_usage: f32,
    pub threads: u32,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SystemSnapshot {
    pub total_memory: u64,
    pub used_memory: u64,
    pub total_swap: u64,
    pub used_swap: u64,
    pub cpu_usage: f32,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub hostname: String,
    pub uptime_secs: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiskInfo {
    pub name: String,
    pub mount: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub file_system: String,
    pub removable: bool,
}

#[derive(Debug, Serialize, Clone, Default)]
pub struct BatteryInfo {
    pub present: bool,
    pub charge_percent: f32,
    pub health_percent: f32,
    pub design_capacity_mwh: Option<u64>,
    pub current_capacity_mwh: Option<u64>,
    pub cycle_count: Option<u32>,
    pub status: String,
    pub time_to_empty_mins: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TraySnapshot {
    pub cpu_usage: f32,
    pub used_memory: u64,
    pub total_memory: u64,
    pub disk_used_pct: f32,
    pub battery: BatteryInfo,
}

#[derive(Debug, Serialize, Clone, Default)]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub install_path: String,
    pub size_bytes: u64,
    pub icon_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiskEntry {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct ScanProgress {
    pub scanned: u64,
    pub current_path: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn fmt_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn read_battery() -> BatteryInfo {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        let base = "/sys/class/power_supply/BAT0";
        if std::path::Path::new(base).exists() {
            let read = |f: &str| {
                fs::read_to_string(format!("{}/{}", base, f))
                    .ok()
                    .and_then(|s| s.trim().parse::<u64>().ok())
            };
            let status_str = fs::read_to_string(format!("{}/status", base))
                .unwrap_or_default()
                .trim()
                .to_string();
            let charge_now = read("charge_now").or_else(|| read("energy_now"));
            let charge_full = read("charge_full").or_else(|| read("energy_full"));
            let charge_full_design =
                read("charge_full_design").or_else(|| read("energy_full_design"));
            let cycle_count = read("cycle_count").map(|v| v as u32);
            let charge_pct = match (charge_now, charge_full) {
                (Some(n), Some(f)) if f > 0 => (n as f32 / f as f32 * 100.0).min(100.0),
                _ => 0.0,
            };
            let health_pct = match (charge_full, charge_full_design) {
                (Some(f), Some(d)) if d > 0 => (f as f32 / d as f32 * 100.0).min(100.0),
                _ => 0.0,
            };

            return BatteryInfo {
                present: true,
                charge_percent: charge_pct,
                health_percent: health_pct,
                design_capacity_mwh: charge_full_design.map(|v| v / 1000),
                current_capacity_mwh: charge_full.map(|v| v / 1000),
                cycle_count,
                status: if status_str.is_empty() { "Unknown".to_string() } else { status_str },
                time_to_empty_mins: None,
            };
        }
    }

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        if let Ok(manager) = battery::Manager::new() {
            if let Ok(mut batteries) = manager.batteries() {
                if let Some(Ok(bat)) = batteries.next() {
                    let charge_pct = (bat.state_of_charge().value * 100.0).min(100.0);
                    let energy_full = bat.energy_full().value;
                    let energy_design = bat.energy_full_design().value;
                    let health_pct = if energy_design > 0.0 {
                        (energy_full / energy_design * 100.0).min(100.0)
                    } else {
                        100.0
                    };

                    return BatteryInfo {
                        present: true,
                        charge_percent: charge_pct,
                        health_percent: health_pct,
                        design_capacity_mwh: Some((energy_design / 3.6) as u64),
                        current_capacity_mwh: Some((energy_full / 3.6) as u64),
                        cycle_count: bat.cycle_count(),
                        status: format!("{:?}", bat.state()),
                        time_to_empty_mins: bat.time_to_empty().map(|t| (t.value / 60.0) as u64),
                    };
                }
            }
        }
    }

    BatteryInfo {
        present: false,
        status: "N/A".to_string(),
        ..Default::default()
    }
}

fn resolve_linux_icon(icon_name: &str) -> String {
    if icon_name.is_empty() { return String::new(); }
    if icon_name.starts_with('/') {
        if std::path::Path::new(icon_name).exists() {
            return icon_name.to_string();
        }
        return String::new();
    }

    let home = std::env::var("HOME").unwrap_or_default();
    let base_paths = vec![
        format!("{}/.local/share/icons", home),
        "/usr/share/icons".to_string(),
        "/usr/share/pixmaps".to_string(),
    ];

    let extensions = vec!["svg", "png", "xpm", "jpg"];
    let sizes = vec!["scalable", "256x256", "128x128", "64x64", "48x48", "32x32", "24x24", "16x16"];

    for base in &base_paths {
        let base_path = std::path::Path::new(base);
        if !base_path.exists() { continue; }

        // 1. Check direct match in pixmaps or local icons
        for ext in &extensions {
            let p = base_path.join(format!("{}.{}", icon_name, ext));
            if p.exists() { return p.to_string_lossy().to_string(); }
        }
        let direct = base_path.join(icon_name);
        if direct.exists() && direct.is_file() {
            return direct.to_string_lossy().to_string();
        }

        // 2. Search through themes
        if let Ok(themes) = std::fs::read_dir(base) {
            for theme in themes.filter_map(|e| e.ok()) {
                let theme_path = theme.path();
                if !theme_path.is_dir() { continue; }

                for size in &sizes {
                    let apps_dir = theme_path.join(size).join("apps");
                    if apps_dir.exists() {
                        for ext in &extensions {
                            let p = apps_dir.join(format!("{}.{}", icon_name, ext));
                            if p.exists() { return p.to_string_lossy().to_string(); }
                        }
                    }
                    // Try with @2x suffix
                    let apps_dir_2x = theme_path.join(format!("{}@2x", size)).join("apps");
                    if apps_dir_2x.exists() {
                        for ext in &extensions {
                            let p = apps_dir_2x.join(format!("{}.{}", icon_name, ext));
                            if p.exists() { return p.to_string_lossy().to_string(); }
                        }
                    }
                }
            }
        }
    }
    
    String::new()
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

/// Returns the top 60 processes sorted by memory usage descending.
#[tauri::command]
fn get_processes(state: State<SysState>) -> Vec<ProcessInfo> {
    use std::collections::HashMap;

    let mut sys = state.sys.lock().unwrap();
    sys.refresh_all();

    let mut groups: HashMap<String, ProcessInfo> = HashMap::new();

    for (pid, p) in sys.processes() {
        // Skip threads on Linux to avoid double-counting shared memory
        if p.thread_kind().is_some() {
            continue;
        }

        let mem = p.memory();
        let name = p.exe()
            .and_then(|path| path.file_name())
            .map(|os_str| os_str.to_string_lossy().to_string())
            .unwrap_or_else(|| p.name().to_string_lossy().to_string());

        let entry = groups.entry(name.clone()).or_insert(ProcessInfo {
            pid: pid.as_u32(), // Keep the first PID found as the "representative"
            name,
            memory_bytes: 0,
            memory_label: String::new(),
            cpu_usage: 0.0,
            threads: 0,
            status: format!("{:?}", p.status()),
        });

        entry.memory_bytes += mem;
        entry.cpu_usage += p.cpu_usage();
        entry.threads += p.thread_kind().map(|_| 1).unwrap_or(0);
    }

    let mut procs: Vec<ProcessInfo> = groups
        .into_values()
        .map(|mut p| {
            p.memory_label = fmt_bytes(p.memory_bytes);
            p
        })
        .collect();

    procs.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
    procs.truncate(60);
    procs
}

/// Kills a process by PID. Returns success or an error message.
#[tauri::command]
fn kill_process(pid: u32, state: State<SysState>) -> Result<(), String> {
    let mut sys = state.sys.lock().unwrap();
    
    // Refresh only the processes to get an up-to-date PID list
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    
    if let Some(p) = sys.process(sysinfo::Pid::from_u32(pid)) {
        if p.kill() {
            Ok(())
        } else {
            Err("Failed to kill process (permission denied or system protected)".to_string())
        }
    } else {
        Err(format!("Process with PID {} not found or already terminated", pid))
    }
}

/// Returns a full system snapshot (RAM, CPU, OS info, uptime).
#[tauri::command]
fn get_system_info(state: State<SysState>) -> SystemSnapshot {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_all();
    let cpu_count = sys.cpus().len();
    let cpu_usage = if cpu_count > 0 {
        sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / cpu_count as f32
    } else {
        0.0
    };
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_default();
    SystemSnapshot {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_swap: sys.total_swap(),
        used_swap: sys.used_swap(),
        cpu_usage,
        cpu_count,
        cpu_brand,
        os_name: System::name().unwrap_or_default(),
        os_version: System::os_version().unwrap_or_default(),
        kernel_version: System::kernel_version().unwrap_or_default(),
        hostname: System::host_name().unwrap_or_default(),
        uptime_secs: System::uptime(),
    }
}

/// Returns all mounted disks.
#[tauri::command]
fn get_disks() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .map(|d| {
            let total = d.total_space();
            let avail = d.available_space();
            DiskInfo {
                name: d.name().to_string_lossy().to_string(),
                mount: d.mount_point().to_string_lossy().to_string(),
                total_bytes: total,
                available_bytes: avail,
                used_bytes: total.saturating_sub(avail),
                file_system: d.file_system().to_string_lossy().to_string(),
                removable: d.is_removable(),
            }
        })
        .collect()
}

/// Returns battery info (health, charge, cycles).
#[tauri::command]
fn get_battery() -> BatteryInfo {
    read_battery()
}

/// Scans a directory tree and returns the top 50 entries by size.
/// Emits `scan-progress` events during the scan.
#[tauri::command]
fn scan_directory(app: AppHandle, path: String) -> Vec<DiskEntry> {
    use walkdir::WalkDir;
    use std::collections::HashMap;

    let root = std::path::PathBuf::from(&path);
    let mut file_sizes: Vec<(std::path::PathBuf, u64, bool)> = Vec::new();
    let mut dir_sizes: HashMap<std::path::PathBuf, u64> = HashMap::new();
    let mut scanned: u64 = 0;

    // First pass: collect all files and their sizes
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok()) // skip permission errors gracefully
    {
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        scanned += 1;

        // Emit progress every 200 entries to not flood the channel
        if scanned % 200 == 0 {
            let _ = app.emit("scan-progress", ScanProgress {
                scanned,
                current_path: entry.path().to_string_lossy().to_string(),
            });
        }

        let entry_path = entry.path().to_path_buf();

        if meta.is_file() {
            let size = meta.len();
            file_sizes.push((entry_path.clone(), size, false));

            // Accumulate into all ancestor directories
            let mut ancestor = entry_path.parent();
            while let Some(dir) = ancestor {
                if !dir.starts_with(&root) { break; }
                *dir_sizes.entry(dir.to_path_buf()).or_insert(0) += size;
                ancestor = dir.parent();
            }
        }
    }

    // Emit final progress
    let _ = app.emit("scan-progress", ScanProgress {
        scanned,
        current_path: "done".to_string(),
    });

    // Build result: direct children of root only (top-level entries)
    let mut entries: Vec<DiskEntry> = Vec::new();

    // Add direct children dirs with accumulated sizes
    for (dir, size) in &dir_sizes {
        // Only include direct children of root
        if dir.parent() == Some(root.as_path()) {
            let name = dir.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            entries.push(DiskEntry {
                path: dir.to_string_lossy().to_string(),
                name,
                size_bytes: *size,
                is_dir: true,
            });
        }
    }

    // Add direct child files
    for (file, size, _) in &file_sizes {
        if file.parent() == Some(root.as_path()) {
            let name = file.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            entries.push(DiskEntry {
                path: file.to_string_lossy().to_string(),
                name,
                size_bytes: *size,
                is_dir: false,
            });
        }
    }

    // Sort by size descending, return top 50
    entries.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    entries.truncate(50);
    entries
}

/// Returns the rolling buffer of resource usage history.
#[tauri::command]
fn get_history(state: State<SysState>) -> Vec<SnapPoint> {
    state.history.lock().unwrap().iter().cloned().collect()
}

/// Returns a lightweight snapshot for the tray popup.
#[tauri::command]
fn get_tray_snapshot(state: State<SysState>) -> TraySnapshot {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_all();
    let cpu_count = sys.cpus().len();
    let cpu_usage = if cpu_count > 0 {
        sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / cpu_count as f32
    } else {
        0.0
    };
    let disks = Disks::new_with_refreshed_list();
    let (total_disk, used_disk) = disks.iter().fold((0u64, 0u64), |(t, u), d| {
        (t + d.total_space(), u + d.total_space().saturating_sub(d.available_space()))
    });
    let disk_used_pct = if total_disk > 0 {
        used_disk as f32 / total_disk as f32 * 100.0
    } else {
        0.0
    };
    TraySnapshot {
        cpu_usage,
        used_memory: sys.used_memory(),
        total_memory: sys.total_memory(),
        battery: read_battery(),
        disk_used_pct,
    }
}

#[tauri::command]
fn get_installed_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();

    #[cfg(target_os = "linux")]
    {
        use std::fs;
        use std::path::Path;
        use walkdir::WalkDir;

        let home_apps = format!("{}/.local/share/applications", std::env::var("HOME").unwrap_or_default());
        let paths = vec![
            "/usr/share/applications",
            &home_apps,
        ];

        for p in paths {
            if !Path::new(p).exists() {
                continue;
            }
            for entry in WalkDir::new(p).max_depth(2).into_iter().filter_map(|e| e.ok()) {
                if entry.path().extension().map(|s| s == "desktop").unwrap_or(false) {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        let mut app = AppInfo {
                            id: entry.file_name().to_string_lossy().to_string(),
                            install_path: entry.path().to_string_lossy().to_string(),
                            ..Default::default()
                        };
                        let mut in_desktop_entry = false;
                        let mut is_no_display = false;

                        for line in content.lines() {
                            let line = line.trim();
                            if line == "[Desktop Entry]" {
                                in_desktop_entry = true;
                                continue;
                            }
                            if line.starts_with('[') {
                                in_desktop_entry = false;
                                continue;
                            }
                            if !in_desktop_entry {
                                continue;
                            }

                            if line.starts_with("Name=") {
                                app.name = line.replace("Name=", "").trim().to_string();
                            } else if line.starts_with("Icon=") {
                                let icon_name = line.replace("Icon=", "").trim().to_string();
                                app.icon_path = resolve_linux_icon(&icon_name);
                            } else if line.starts_with("X-AppImage-Version=") {
                                app.version = line.replace("X-AppImage-Version=", "").trim().to_string();
                            } else if line.starts_with("Version=") {
                                let v = line.replace("Version=", "").trim().to_string();
                                // Desktop spec versions are usually 1.0, 1.1, 1.4, 1.5. 
                                // If it's something different, it's likely the app's own version.
                                if v != "1.0" && v != "1.1" && v != "1.2" && v != "1.4" && v != "1.5" {
                                    app.version = v;
                                }
                            } else if line == "NoDisplay=true" {
                                is_no_display = true;
                            }
                        }
                        
                        if app.version.is_empty() {
                            app.version = "1.0.0".to_string();
                        }

                        if !app.name.is_empty() && !is_no_display {
                            apps.push(app);
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::fs;
        use std::path::Path;
        use plist::Value;

        let home = std::env::var("HOME").unwrap_or_default();
        let paths = vec![
            "/Applications".to_string(),
            "/System/Applications".to_string(),
            format!("{}/Applications", home),
        ];

        for p in paths {
            let base_path = Path::new(&p);
            if !base_path.exists() { continue; }

            if let Ok(entries) = fs::read_dir(base_path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let path = entry.path();
                    if path.extension().map(|s| s == "app").unwrap_or(false) {
                        let info_plist = path.join("Contents/Info.plist");
                        if info_plist.exists() {
                            if let Ok(val) = Value::from_file(&info_plist) {
                                if let Some(dict) = val.as_dictionary() {
                                    let name = dict.get("CFBundleDisplayName")
                                        .or_else(|| dict.get("CFBundleName"))
                                        .and_then(|v| v.as_string())
                                        .map(|s| s.to_string())
                                        .unwrap_or_else(|| entry.file_name().to_string_lossy().replace(".app", ""));

                                    let version = dict.get("CFBundleShortVersionString")
                                        .or_else(|| dict.get("CFBundleVersion"))
                                        .and_then(|v| v.as_string())
                                        .unwrap_or("1.0.0")
                                        .to_string();

                                    let mut icon_path = String::new();
                                    if let Some(icon_file) = dict.get("CFBundleIconFile").and_then(|v| v.as_string()) {
                                        let mut icon_name = icon_file.to_string();
                                        if !icon_name.ends_with(".icns") {
                                            icon_name.push_str(".icns");
                                        }
                                        let p = path.join("Contents/Resources").join(icon_name);
                                        if p.exists() {
                                            icon_path = p.to_string_lossy().to_string();
                                        }
                                    }

                                    apps.push(AppInfo {
                                        id: name.clone(),
                                        name,
                                        version,
                                        install_path: path.to_string_lossy().to_string(),
                                        icon_path,
                                        size_bytes: 0,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let roots = vec![
            (RegKey::predef(HKEY_LOCAL_MACHINE), "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
            (RegKey::predef(HKEY_LOCAL_MACHINE), "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
            (RegKey::predef(HKEY_CURRENT_USER), "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        ];

        for (root, path) in roots {
            if let Ok(key_parent) = root.open_subkey(path) {
                for name in key_parent.enum_keys().filter_map(|x| x.ok()) {
                    if let Ok(sub_key) = key_parent.open_subkey(&name) {
                        let display_name: String = sub_key.get_value("DisplayName").unwrap_or_default();
                        if display_name.is_empty() { continue; }

                        let version: String = sub_key.get_value("DisplayVersion").unwrap_or_else(|_| "1.0.0".to_string());
                        let install_path: String = sub_key.get_value("InstallLocation").unwrap_or_default();
                        let icon_raw: String = sub_key.get_value("DisplayIcon").unwrap_or_default();

                        let icon_path = icon_raw.split(',').next().unwrap_or(&icon_raw)
                            .trim_matches('"').to_string();

                        apps.push(AppInfo {
                            id: name,
                            name: display_name,
                            version,
                            install_path,
                            icon_path,
                            size_bytes: 0,
                        });
                    }
                }
            }
        }
    }

    // Sort by name
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    // Deduplicate by name and path
    apps.dedup_by(|a, b| a.name == b.name && a.install_path == b.install_path);
    
    apps
}

#[tauri::command]
fn uninstall_app(id: String, path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        if path.contains("flatpak") {
            let flatpak_id = id.strip_suffix(".desktop").unwrap_or(&id);
            let status = Command::new("flatpak")
                .args(["uninstall", "-y", flatpak_id])
                .status()
                .map_err(|e| e.to_string())?;
            if status.success() { return Ok(()); }
            return Err("Flatpak uninstallation failed".into());
        } else if path.contains("snap") {
            let snap_name = id.strip_suffix(".desktop").unwrap_or(&id);
            let status = Command::new("pkexec")
                .args(["snap", "remove", snap_name])
                .status()
                .map_err(|e| e.to_string())?;
            if status.success() { return Ok(()); }
            return Err("Snap uninstallation failed".into());
        } else {
            let output = Command::new("dpkg")
                .args(["-S", &path])
                .output()
                .map_err(|e| e.to_string())?;
            
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(pkg) = stdout.split(':').next() {
                    let status = Command::new("pkexec")
                        .args(["apt-get", "remove", "-y", pkg.trim()])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if status.success() { return Ok(()); }
                    return Err("Apt uninstallation failed".into());
                }
            }
            return Err("Could not identify package manager for this app".into());
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let status = Command::new("osascript")
            .args(["-e", &format!("tell application \"Finder\" to delete POSIX file \"{}\"", path)])
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() { return Ok(()); }
        return Err("macOS uninstallation failed".into());
    }

    #[cfg(target_os = "windows")]
    {
        let _ = (id, path);
        Err("Uninstallation not yet implemented for Windows".into())
    }
}

/// Deletes a file or directory permanently.
#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".into());
    }
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

fn get_settings_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")).join("settings.json")
}

fn load_settings(app: &AppHandle) -> AppSettings {
    let path = get_settings_path(app);
    if let Ok(content) = std::fs::read_to_string(path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

fn save_settings_to_disk(app: &AppHandle, settings: &AppSettings) {
    let path = get_settings_path(app);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(settings) {
        let _ = std::fs::write(path, content);
    }
}

#[tauri::command]
fn get_settings(state: State<SysState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<SysState>, settings: AppSettings) {
    *state.settings.lock().unwrap() = settings.clone();
    save_settings_to_disk(&app, &settings);
}

// ─── Background refresh emitter ──────────────────────────────────────────────

async fn start_refresh_loop(app: AppHandle) {
    use tauri_plugin_notification::NotificationExt;
    use std::time::{Instant, Duration as StdDuration};

    let mut last_notification = Instant::now() - StdDuration::from_secs(60);

    loop {
        let (interval, ram_threshold, cpu_threshold) = {
            let state = app.state::<SysState>();
            let settings = state.settings.lock().unwrap();
            (
                settings.refresh_interval_secs,
                settings.ram_alert_threshold,
                settings.cpu_alert_threshold,
            )
        };

        sleep(Duration::from_secs(interval)).await;

        let state = app.state::<SysState>();
        let mut sys = state.sys.lock().unwrap();
        sys.refresh_all();

        // Check CPU usage
        let cpu_count = sys.cpus().len();
        let cpu_usage = if cpu_count > 0 {
            sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / cpu_count as f32
        } else {
            0.0
        };

        // Check RAM usage
        let total_mem = sys.total_memory();
        let used_mem = sys.used_memory();
        let ram_usage = if total_mem > 0 {
            (used_mem as f32 / total_mem as f32) * 100.0
        } else {
            0.0
        };

        // Record history point
        {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let mut hist = state.history.lock().unwrap();
            hist.push_back(SnapPoint {
                ts,
                cpu: cpu_usage,
                ram_used: used_mem,
            });
            if hist.len() > 60 {
                hist.pop_front();
            }
        }

        if last_notification.elapsed() > StdDuration::from_secs(60) {
            let mut triggered = false;
            if cpu_usage > cpu_threshold {
                let _ = app.notification()
                    .builder()
                    .title("High CPU Usage Alert")
                    .body(format!("CPU usage is at {:.1}%", cpu_usage))
                    .show();
                triggered = true;
            } else if ram_usage > ram_threshold {
                let _ = app.notification()
                    .builder()
                    .title("High RAM Usage Alert")
                    .body(format!("RAM usage is at {:.1}%", ram_usage))
                    .show();
                triggered = true;
            }

            if triggered {
                last_notification = Instant::now();
            }
        }

        let _ = app.emit("process-update", ());
    }
}

#[tauri::command]
fn get_app_icon_data_url(path: String) -> Result<String, String> {
    if path.is_empty() { return Ok(String::new()); }
    
    use base64::{Engine as _, engine::general_purpose};
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = general_purpose::STANDARD.encode(bytes);
    
    let path_lc = path.to_lowercase();
    let mime = if path_lc.ends_with(".svg") {
        "image/svg+xml"
    } else if path_lc.ends_with(".png") {
        "image/png"
    } else if path_lc.ends_with(".jpg") || path_lc.ends_with(".jpeg") {
        "image/jpeg"
    } else if path_lc.ends_with(".xpm") {
        "image/x-xpixmap"
    } else if path_lc.ends_with(".ico") {
        "image/x-icon"
    } else if path_lc.ends_with(".icns") {
        "image/x-icns"
    } else {
        "image/png"
    };
    Ok(format!("data:{};base64,{}", mime, b64))
}

// ─── App entry point ─────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            let settings = load_settings(app.handle());
            let start_minimized = settings.start_minimized;
            let args: Vec<String> = std::env::args().collect();
            let is_minimized = args.iter().any(|a| a == "--minimized") || start_minimized;

            app.manage(SysState {
                sys: Mutex::new(System::new_all()),
                settings: Mutex::new(settings),
                history: Mutex::new(VecDeque::with_capacity(60)),
            });

            // Force the window icon for Linux dock
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                    let _ = window.set_icon(icon);
                }
                
                if !is_minimized {
                    let _ = window.show();
                }
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(start_refresh_loop(handle));

            // Tray menu
            let toggle = MenuItem::with_id(app, "toggle", "Toggle window", true, None::<&str>)?;
            let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let sys_info = MenuItem::with_id(app, "sysinfo", "System Info", true, None::<&str>)?;
            let settings =
                MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Sysora", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&toggle, &sep1, &sys_info, &settings, &sep2, &quit],
            )?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Sysora — System Monitor")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "toggle" => {
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                    "sysinfo" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("navigate", "system-info");
                        }
                    }
                    "settings" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = w.emit("navigate", "settings");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_processes,
            kill_process,
            get_system_info,
            get_disks,
            get_battery,
            get_tray_snapshot,
            get_installed_apps,
            uninstall_app,
            get_app_icon_data_url,
            get_settings,
            save_settings,
            scan_directory,
            delete_path,
            get_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running sysora");
}
