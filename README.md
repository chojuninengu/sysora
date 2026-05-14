# Sysora — System Monitor & Manager

> Cross-platform desktop app to monitor memory, kill hungry processes, inspect system specs, scan disk usage, and check battery health — all from a modern dark dashboard with a tray icon.

Built with **Rust + Tauri v2** on the backend and **React 19 + Vite + Tailwind CSS** on the frontend. Runs natively on **Ubuntu**, **macOS**, and **Windows**.

---

## 📥 Download Latest Release

Get the latest stable version (Phase 2) for your operating system:

| Platform | Installer | Portability |
|---|---|---|
| **Linux (Ubuntu/Debian)** | [`.deb`](https://github.com/The-SudoStart/sysora/releases/latest) | [`.AppImage`](https://github.com/The-SudoStart/sysora/releases/latest) |
| **macOS** | [`.dmg`](https://github.com/The-SudoStart/sysora/releases/latest) | Native (Universal) |
| **Windows** | [`.msi`](https://github.com/The-SudoStart/sysora/releases/latest) | [`.exe`](https://github.com/The-SudoStart/sysora/releases/latest) |

---

## 🚀 Features (Phase 2 Stable)

### 📊 Real-time Monitoring
- **Resource Pulse**: Live CPU and RAM usage history sparklines (last 60s).
- **Process Manager**: Kill hungry processes with one click, search by name, and sort by memory usage.
- **Stat Cards**: Instant glance at RAM, CPU, Disk, and Battery health/status.

### 💾 Storage & Files
- **Disk usage**: Monitor all mounted partitions and removable drives.
- **Deep Scanner**: Find what's eating your space! Scan any directory to find the largest files and folders.
- **Safe Purge**: Delete heavy files/folders directly from the scanner with confirmation.

### ⚙️ App Management & Settings
- **Installed Apps**: List and manage installed applications.
- **Persistence**: Save your preferences for refresh rates and alert thresholds.
- **Tray Power**: Complete control from the system tray: quick specs, settings, and one-click toggle.
- **Native Experience**: "Close to Tray" and "Start minimized" support.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                React 19 + Vite frontend               │
│  Memory  │  Processes  │  Apps  │  Disk  │  Sys Info  │
└──────────────────┬───────────────────────────────────┘
                   │ invoke() / emit()  (Tauri IPC)
┌──────────────────▼───────────────────────────────────┐
│              Tauri v2 bridge                          │
│   Commands: scan_directory · kill_process · settings  │
│   Events:   scan-progress · process-update            │
│   Tray:     toggle · system-info · settings · quit    │
└──────────────────┬───────────────────────────────────┐
                   │
┌──────────────────▼───────────────────────────────────┐
│              Rust backend                             │
│   sysinfo crate  │  WalkDir scanner  │  Battery reader│
│   /proc · WMI · sysctl (cross-platform OS APIs)       │
└───────────────────────────────────────────────────────┘
        Runs on Ubuntu · macOS · Windows
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Rust, Tauri v2 |
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
│   │   ├── charts/             # History graphs
│   │   ├── tabs/               # Memory, Apps, Disk, Settings
│   │   └── layout/             # Shell, Sidebar, StatCards
├── src-tauri/                  # Rust backend
│   ├── src/lib.rs              # Core logic & Commands
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
- **Linux (Ubuntu/Debian) dependencies**:
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

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
- [x] Disk usage bars
- [x] System specs + Battery health
- [x] Tray popup snapshot

### ✅ Phase 2 — Management (Current)
- [x] **App Manager**: List installed applications.
- [x] **Settings**: Refresh rate, startup behavior, and persistence.
- [x] **Disk Scanner**: Find largest files/folders with deletion support.
- [x] **Resource History**: 60s CPU/RAM chart in Memory tab.
- [x] **Persistence**: Save user settings to JSON.

### 🔲 Phase 3 — Polish
- [ ] Notifications: Alert when RAM/CPU crosses threshold.
- [ ] Branded icon + Splash screen.
- [ ] Export system report as PDF.
- [ ] Full Windows uninstallation logic.

---

## Battery Health — How It Works

Sysora distinguishes between two different battery numbers that most tools confuse:

| Metric | What it means |
|---|---|
| **Current charge** | How full the battery is right now (0–100%) |
| **Battery health** | Current max capacity vs the original design capacity |

A battery with **60% health** that is fully charged will only last 60% as long as it did when it was new — even though it shows "100% charge".

This is read from `/sys/class/power_supply/BAT*/` on Linux (`energy_full` vs `energy_full_design`). macOS and Windows native APIs are supported via the `battery` crate.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m "feat: add feature"`
4. Open a PR against `main`

---

## License

[MIT](LICENSE) © 2024 [The SudoStart](https://github.com/The-SudoStart)
