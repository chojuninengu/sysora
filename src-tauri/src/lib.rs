use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Disks, System};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};
use tokio::time::{sleep, Duration};

// ─── Shared system state ────────────────────────────────────────────────────
pub struct SysState(pub Mutex<System>);

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

#[derive(Debug, Serialize, Clone)]
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
    // Platform-specific battery reading via sysinfo components
    // Full implementation uses platform APIs; this is a safe cross-platform stub
    // that reads what sysinfo exposes, then falls back to N/A gracefully.
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        let base = "/sys/class/power_supply/BAT0";
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
        let present = std::path::Path::new(base).exists();
        BatteryInfo {
            present,
            charge_percent: charge_pct,
            health_percent: health_pct,
            design_capacity_mwh: charge_full_design.map(|v| v / 1000),
            current_capacity_mwh: charge_full.map(|v| v / 1000),
            cycle_count,
            status: if status_str.is_empty() {
                "Unknown".to_string()
            } else {
                status_str
            },
            time_to_empty_mins: None,
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        // macOS / Windows: return a stub; Phase 2 adds native battery APIs
        BatteryInfo {
            present: false,
            charge_percent: 0.0,
            health_percent: 0.0,
            design_capacity_mwh: None,
            current_capacity_mwh: None,
            cycle_count: None,
            status: "N/A".to_string(),
            time_to_empty_mins: None,
        }
    }
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

/// Returns the top 60 processes sorted by memory usage descending.
#[tauri::command]
fn get_processes(state: State<SysState>) -> Vec<ProcessInfo> {
    use std::collections::HashMap;

    let mut sys = state.0.lock().unwrap();
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

/// Kills a process by PID. Returns true on success.
#[tauri::command]
fn kill_process(pid: u32, state: State<SysState>) -> bool {
    let sys = state.0.lock().unwrap();
    if let Some(p) = sys.process(sysinfo::Pid::from_u32(pid)) {
        p.kill()
    } else {
        false
    }
}

/// Returns a full system snapshot (RAM, CPU, OS info, uptime).
#[tauri::command]
fn get_system_info(state: State<SysState>) -> SystemSnapshot {
    let mut sys = state.0.lock().unwrap();
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

/// Returns a lightweight snapshot for the tray popup.
#[tauri::command]
fn get_tray_snapshot(state: State<SysState>) -> TraySnapshot {
    let mut sys = state.0.lock().unwrap();
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
                                app.icon_path = line.replace("Icon=", "").trim().to_string();
                            } else if line.starts_with("Version=") {
                                app.version = line.replace("Version=", "").trim().to_string();
                            } else if line == "NoDisplay=true" {
                                is_no_display = true;
                            }
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

        let paths = vec!["/Applications", "/System/Applications"];
        for p in paths {
            if let Ok(entries) = fs::read_dir(p) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let path = entry.path();
                    if path.extension().map(|s| s == "app").unwrap_or(false) {
                        let name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                        apps.push(AppInfo {
                            id: name.clone(),
                            name,
                            install_path: path.to_string_lossy().to_string(),
                            ..Default::default()
                        });
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // For Windows, we'd ideally use winreg. This is a placeholder for now
        // to show "something up and working".
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

// ─── Background refresh emitter ──────────────────────────────────────────────

async fn start_refresh_loop(app: AppHandle) {
    loop {
        sleep(Duration::from_secs(3)).await;
        let _ = app.emit("process-update", ());
    }
}

// ─── App entry point ─────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SysState(Mutex::new(System::new_all())))
        .setup(|app| {
            // Force the window icon for Linux dock
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                    let _ = window.set_icon(icon);
                }
            }

            let handle = app.handle().clone();

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
                            let _ = app.emit("navigate", "system-info");
                        }
                    }
                    "settings" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = app.emit("navigate", "settings");
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

            // Start background 3-second refresh loop
            tauri::async_runtime::spawn(start_refresh_loop(handle));

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running sysora");
}
