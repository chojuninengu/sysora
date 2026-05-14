use clap::{Parser, Subcommand};
use colored::*;
use sysinfo::{System, Components, Disks};
use sysora_lib::*;
use serde_json;

#[derive(Parser)]
#[command(name = "sysora")]
#[command(version = "0.3.0")]
#[command(about = "Sysora CLI — System monitoring from your terminal", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// Output in JSON format
    #[arg(short, long)]
    pub json: bool,

    /// Hidden arg for compatibility with GUI autostart
    #[arg(long, hide = true)]
    pub minimized: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Show a quick system snapshot (default)
    Status,
    /// List top processes by RAM usage
    Processes {
        /// Number of processes to show
        #[arg(short, long, default_value_t = 10)]
        top: usize,
    },
    /// Show detailed disk usage per mount
    Disk,
    /// Show battery health and capacity details
    Battery,
}

pub fn run_cli(cli: Cli) {
    match cli.command.unwrap_or(Commands::Status) {
        Commands::Status => show_status(cli.json),
        Commands::Processes { top } => show_processes(top, cli.json),
        Commands::Disk => show_disk(cli.json),
        Commands::Battery => show_battery(cli.json),
    }
}

fn bar(pct: f32, width: usize) -> String {
    let filled = (pct / 100.0 * width as f32).round() as usize;
    let filled = filled.min(width);
    let mut s = String::new();
    for i in 0..width {
        if i < filled {
            s.push('█');
        } else {
            s.push('░');
        }
    }
    s
}

fn show_status(json: bool) {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let cpu_count = sys.cpus().len();
    let cpu_usage = if cpu_count > 0 {
        sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / cpu_count as f32
    } else { 0.0 };
    
    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let mem_pct = if total_mem > 0 { (used_mem as f32 / total_mem as f32) * 100.0 } else { 0.0 };

    let mut comps = Components::new_with_refreshed_list();
    comps.refresh(true);
    let max_temp = comps.iter().filter_map(|c| c.temperature()).fold(0.0, f32::max);
    
    let mut disks = Disks::new_with_refreshed_list();
    disks.refresh(true);
    let mut disk_used = 0;
    let mut disk_total = 0;
    for d in disks.iter() {
        disk_total += d.total_space();
        disk_used += d.total_space() - d.available_space();
    }
    let disk_pct = if disk_total > 0 { (disk_used as f64 / disk_total as f64) * 100.0 } else { 0.0 };

    let bat = read_battery();

    if json {
        let output = serde_json::json!({
            "os": format!("{} {}", System::name().unwrap_or_default(), System::os_version().unwrap_or_default()),
            "hostname": System::host_name().unwrap_or_default(),
            "cpu": { "usage_pct": cpu_usage, "cores": cpu_count, "brand": sys.cpus().first().map(|c| c.brand()).unwrap_or_default() },
            "memory": { "total_bytes": total_mem, "used_bytes": used_mem, "usage_pct": mem_pct },
            "disk": { "total_bytes": disk_total, "used_bytes": disk_used, "usage_pct": disk_pct },
            "temp": { "max_celsius": max_temp },
            "battery": bat
        });
        println!("{}", serde_json::to_string_pretty(&output).unwrap());
        return;
    }

    println!("{} {} · {} {} · hostname: {}", 
        "Sysora".brand_color(), 
        "v0.3.0".dimmed(),
        System::name().unwrap_or_default().cyan(),
        System::os_version().unwrap_or_default().cyan(),
        System::host_name().unwrap_or_default().yellow()
    );

    // RAM
    let ram_bar = bar(mem_pct, 10);
    let ram_color = if mem_pct > 85.0 { Color::Red } else if mem_pct > 70.0 { Color::Yellow } else { Color::Green };
    println!("{:<8} {} {} / {} ({:.0}%)", 
        "RAM".bold(), 
        ram_bar.color(ram_color), 
        fmt_bytes(used_mem), 
        fmt_bytes(total_mem), 
        mem_pct
    );

    // CPU
    let cpu_bar = bar(cpu_usage, 10);
    let cpu_color = if cpu_usage > 80.0 { Color::Red } else if cpu_usage > 60.0 { Color::Yellow } else { Color::Green };
    println!("{:<8} {} {:.0}% · {} cores · {}", 
        "CPU".bold(), 
        cpu_bar.color(cpu_color), 
        cpu_usage, 
        cpu_count, 
        sys.cpus().first().map(|c| c.brand()).unwrap_or_default().dimmed()
    );

    // Disk
    let d_bar = bar(disk_pct as f32, 10);
    let d_color = if disk_pct > 90.0 { Color::Red } else if disk_pct > 75.0 { Color::Yellow } else { Color::Green };
    let d_warn = if disk_pct > 95.0 { " ⚠".red().bold().to_string() } else { "".to_string() };
    println!("{:<8} {} {} / {} ({:.0}%){}", 
        "Disk".bold(), 
        d_bar.color(d_color), 
        fmt_bytes(disk_used), 
        fmt_bytes(disk_total), 
        disk_pct,
        d_warn
    );

    // Battery
    if bat.present {
        let b_bar = bar(bat.charge_percent as f32, 10);
        let b_color = if bat.charge_percent < 20.0 { Color::Red } else if bat.charge_percent < 40.0 { Color::Yellow } else { Color::Green };
        println!("{:<8} {} {:.0}% · Health {:.0}% · {} cycles", 
            "Battery".bold(), 
            b_bar.color(b_color), 
            bat.charge_percent, 
            bat.health_percent, 
            bat.cycle_count.unwrap_or(0)
        );
    }

    // Temp
    let t_bar = bar((max_temp / 100.0 * 100.0).min(100.0), 10);
    let t_color = if max_temp > 80.0 { Color::Red } else if max_temp > 60.0 { Color::Yellow } else { Color::Green };
    println!("{:<8} {} {:.0}°C · Max recorded {:.0}°C", 
        "Temp".bold(), 
        t_bar.color(t_color), 
        max_temp,
        max_temp // Simplified for one-shot
    );
}

fn show_processes(top_n: usize, json: bool) {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let mut procs: Vec<_> = sys.processes().values().collect();
    procs.sort_by(|a, b| b.memory().cmp(&a.memory()));
    
    if json {
        let output: Vec<_> = procs.iter().take(top_n).map(|p| {
            serde_json::json!({
                "pid": p.pid().as_u32(),
                "name": p.name(),
                "memory_bytes": p.memory(),
                "cpu_usage": p.cpu_usage()
            })
        }).collect();
        println!("{}", serde_json::to_string_pretty(&output).unwrap());
        return;
    }

    println!("{:<8} {:<25} {:<15} {:<10}", "PID".bold(), "NAME".bold(), "MEMORY".bold(), "CPU".bold());
    println!("{}", "─".repeat(60).dimmed());
    for p in procs.iter().take(top_n) {
        println!("{:<8} {:<25} {:<15} {:<10.1}%", 
            p.pid().as_u32(), 
            p.name().to_string_lossy().truncate(24), 
            fmt_bytes(p.memory()), 
            p.cpu_usage()
        );
    }
}

fn show_disk(json: bool) {
    let mut disks = Disks::new_with_refreshed_list();
    disks.refresh(true);
    
    if json {
        println!("{}", serde_json::to_string_pretty(&disks.iter().map(|d| {
            serde_json::json!({
                "name": d.name().to_string_lossy(),
                "mount": d.mount_point().to_string_lossy(),
                "total_bytes": d.total_space(),
                "available_bytes": d.available_space()
            })
        }).collect::<Vec<_>>()).unwrap());
        return;
    }

    println!("{:<15} {:<20} {:<15} {:<10}", "NAME".bold(), "MOUNT".bold(), "USAGE".bold(), "FREE".bold());
    println!("{}", "─".repeat(65).dimmed());
    for d in disks.iter() {
        let used = d.total_space() - d.available_space();
        let pct = if d.total_space() > 0 { (used as f64 / d.total_space() as f64) * 100.0 } else { 0.0 };
        println!("{:<15} {:<20} {:<15} {:<10}", 
            d.name().to_string_lossy().truncate(14),
            d.mount_point().to_string_lossy().truncate(19),
            format!("{} ({:.0}%)", fmt_bytes(used), pct),
            fmt_bytes(d.available_space())
        );
    }
}

fn show_battery(json: bool) {
    let bat = read_battery();
    if json {
        println!("{}", serde_json::to_string_pretty(&bat).unwrap());
        return;
    }

    if !bat.present {
        println!("{}", "No battery detected.".yellow());
        return;
    }

    println!("{}", "Battery Health Details".bold().cyan());
    println!("{:<20} {:.0}%", "Charge:", bat.charge_percent);
    println!("{:<20} {:.0}% ({})", "Health:", bat.health_percent, health_label(bat.health_percent));
    println!("{:<20} {}", "Cycles:", bat.cycle_count.unwrap_or(0));
    println!("{:<20} {}", "Status:", bat.status);
    if let Some(m) = bat.design_capacity_mwh { println!("{:<20} {} mWh", "Design Cap:", m); }
    if let Some(m) = bat.current_capacity_mwh { println!("{:<20} {} mWh", "Current Cap:", m); }
}

trait BrandColor {
    fn brand_color(&self) -> String;
}
impl BrandColor for str {
    fn brand_color(&self) -> String { self.color(Color::TrueColor { r: 99, g: 102, b: 241 }).bold().to_string() }
}

trait StringExt {
    fn truncate(&self, len: usize) -> String;
}
impl StringExt for String {
    fn truncate(&self, len: usize) -> String {
        if self.len() > len { format!("{}…", &self[..len-1]) } else { self.clone() }
    }
}
impl StringExt for &str {
    fn truncate(&self, len: usize) -> String {
        if self.len() > len { format!("{}…", &self[..len-1]) } else { self.to_string() }
    }
}
impl StringExt for std::borrow::Cow<'_, str> {
    fn truncate(&self, len: usize) -> String {
        if self.len() > len { format!("{}…", &self[..len-1]) } else { self.to_string() }
    }
}
