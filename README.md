# Sysora — System Monitor & Manager

> Cross-platform desktop app to monitor memory, kill hungry processes, inspect system specs, scan disk usage, track fans, and view historical usage trends — all from a modern dark/light dashboard or your terminal.

Built with **Rust + Tauri v2** on the backend and **React 19 + Vite + Tailwind CSS** on the frontend. Runs natively on **Ubuntu**, **macOS**, and **Windows**.

---

## 📥 Download Latest Release

Get the latest stable version (Phase 3) for your operating system:

| Platform | Installer | Portability |
|---|---|---|
| **Linux (Ubuntu/Debian)** | [`.deb`](https://github.com/The-SudoStart/sysora/releases/latest) | [`.AppImage`](https://github.com/The-SudoStart/sysora/releases/latest) |
| **macOS** | [`.dmg`](https://github.com/The-SudoStart/sysora/releases/latest) | Native (Universal) |
| **Windows** | [`.msi`](https://github.com/The-SudoStart/sysora/releases/latest) | [`.exe`](https://github.com/The-SudoStart/sysora/releases/latest) |

### 🐧 Linux One-Liner Install (Ubuntu/Debian)

You can quickly download and install the latest `.deb` version directly from your terminal:

```bash
URL=$(curl -s https://api.github.com/repos/The-SudoStart/sysora/releases/latest | grep -o '"browser_download_url": "[^"]*amd64\.deb"' | cut -d '"' -f 4) && curl -sL "$URL" -o sysora.deb && sudo dpkg -i sysora.deb && rm sysora.deb
```

---

## 🚀 Features (Phase 3 Stable)

### 📊 Real-time Monitoring
- **Resource Pulse**: Live CPU and RAM usage history sparklines (last 60s).
- **Process Manager**: Kill hungry processes with one click, search by name, and sort by memory usage.
- **Stat Cards**: Instant glance at RAM, CPU, Disk, and Battery health/status.
- **Fan Monitoring**: Track fan speeds (RPM) and system temperatures in real-time (Linux).

### 📈 Observability & History
- **SQLite History**: Periodic system snapshots stored in a local database.
- **Trend Charts**: Visualize CPU, RAM, and Disk usage over the last 1h, 6h, 24h, or 7 days.
- **Usage Peaks**: Automatically calculate average and peak resource usage for any time range.

### 💾 Storage & Files
- **Disk usage**: Monitor all mounted partitions and removable drives.
- **Deep Scanner**: Find what's eating your space! Scan any directory to find the largest files and folders.
- **Safe Purge**: Delete heavy files/folders directly from the scanner with confirmation.

### ⌨️ CLI Interface
- **Headless Mode**: Run `sysora status` for a quick system snapshot in your terminal.
- **Tooling**: Export JSON data for scripts or check specific sensors with `sysora fans`.

### ⚙️ App Management & Settings
- **Theme Toggles**: Seamlessly switch between **Dark**, **Light**, and **System** themes.
- **Installed Apps**: List and manage installed applications.
- **Tray Power**: Complete control from the system tray: quick specs, settings, and history access.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                React 19 + Vite frontend               │
│  Memory │ Processes │ Network │ History │ Sys Info    │
└──────────────────┬───────────────────────────────────┘
                   │ invoke() / emit()  (Tauri IPC)
┌──────────────────▼───────────────────────────────────┐
│              Tauri v2 bridge                          │
│   Commands: get_history · get_fans · save_settings    │
│   Events:   scan-progress · process-update            │
│   Tray:     toggle · status · settings · quit         │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│              Rust backend                             │
│  SQLite (rusqlite)  │  sysinfo crate  │  hwmon reader │
│  Background Task    │  Battery reader │  CLI (clap)   │
└───────────────────────────────────────────────────────┘
        Runs on Ubuntu · macOS · Windows
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Rust, Tauri v2 |
| **Database** | SQLite (rusqlite) |
| **CLI** | Clap v4 |
| **Frontend** | React 19, Vite, Tailwind CSS |
| **State** | Zustand, TanStack Query |
| **Charts** | Recharts |
| **Icons** | Lucide React |

---

## Project Structure

```
sysora/
├── src/                        # React frontend
│   ├── components/
│   │   ├── charts/             # History & Network graphs
│   │   ├── tabs/               # Memory, History, Disk, Settings
│   │   └── layout/             # Shell, Sidebar, TopBar
├── src-tauri/                  # Rust backend
│   ├── src/lib.rs              # Core logic & Commands
│   ├── src/db.rs               # SQLite persistence
│   ├── src/cli.rs              # CLI command handling
│   └── capabilities/           # Security & Permissions
├── images/                     # Project assets (Logo, Icons)
└── .github/workflows/          # CI/CD Release pipeline
```

---

## Getting Started (Dev)

### Prerequisites
- **Node.js** ≥ 20
- **Rust** (stable)
- **Tauri v2 CLI** (`npm install -g @tauri-apps/cli`)
- **Linux dependencies**: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, etc.

### Run in development

```bash
# 1. Clone the repo
git clone https://github.com/The-SudoStart/sysora.git
cd sysora

# 2. Install dependencies
npm install

# 3. Start dev server
npm run tauri dev
```

---

## Feature Roadmap

### ✅ Phase 1 — Foundation
- [x] Live process list + Kill button
- [x] System specs + Battery health

### ✅ Phase 2 — Management
- [x] **App Manager**: List installed applications.
- [x] **Settings**: Refresh rate, startup behavior.
- [x] **Disk Scanner**: Find largest files/folders.

### ✅ Phase 3 — Polish & Observability (Current)
- [x] **Dark/Light Themes**: Full Tailwind support.
- [x] **CLI Snapshot**: `sysora status` command.
- [x] **SQLite Tracking**: 30-day historical trends.
- [x] **Cooling & Fans**: Real-time RPM tracking.

### 🔲 Phase 4 — Enterprise
- [ ] Export system report as PDF.
- [ ] Network traffic breakdown per process.
- [ ] Custom alert rules (Email/Slack notifications).

---



## Contributing

We love contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

---

## License

[MIT](LICENSE) © 2024 [The SudoStart](https://github.com/The-SudoStart)
