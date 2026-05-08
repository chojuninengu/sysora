# Sysora — System Monitor & Manager

> Cross-platform desktop app to monitor memory, kill hungry processes, inspect system specs, scan disk usage, and check battery health — all from a modern dark dashboard with a tray icon.

Built with **Rust + Tauri v2** on the backend and **React 19 + Vite + Tailwind CSS** on the frontend. Runs natively on **Ubuntu**, **macOS**, and **Windows**.

---

## Screenshots

### Dashboard — Memory Monitor
The main view shows live processes sorted by RAM usage, with a Kill button per process and stat cards for RAM, CPU, Disk, and Battery at the top.

![Memory Monitor](docs/screenshots/memory-monitor.png)

### Tray Popup
Click the tray icon to see a quick CPU/RAM/Disk/Battery health snapshot — without opening the full window.

![Tray Popup](docs/screenshots/tray-popup.png)

---

## Architecture

### System overview

```
┌──────────────────────────────────────────────────────┐
│                React 19 + Vite frontend               │
│  Memory  │  Processes  │  Apps  │  Disk  │  Sys Info  │
└──────────────────┬───────────────────────────────────┘
                   │ invoke() / emit()  (Tauri IPC)
┌──────────────────▼───────────────────────────────────┐
│              Tauri v2 bridge                          │
│   Commands: get_processes · kill_process · get_sys    │
│   Events:   process-update (emitted every 3s)         │
│   Tray:     toggle · system-info · settings · quit    │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│              Rust backend                             │
│   sysinfo crate  │  Process killer  │  Battery reader │
│   /proc · WMI · sysctl (cross-platform OS APIs)       │
└───────────────────────────────────────────────────────┘
        Runs on Ubuntu · macOS · Windows
```

### Data flow

```
OS kernel ──► sysinfo crate ──► Tokio loop (3s) ──► serde_json ──► Tauri IPC ──► React UI
                                                                                     │
                                              kill_process(pid) ◄────────────────────┘
                                              (user clicks Kill)
```

### CI/CD pipeline

```
git push --tags
        │
        ▼
GitHub Actions: release.yml
        │
   ┌────┴─────────────────────┐
   │           │              │
   ▼           ▼              ▼
ubuntu-22.04  macos-latest  windows-latest
.deb          .dmg           .msi
.AppImage    (universal)     .exe
   │           │              │
   └────┬──────┘──────────────┘
        ▼
  GitHub Releases (draft)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | **Rust** | Native system access, memory safety, speed |
| Desktop framework | **Tauri v2** | Cross-platform shell, tray icon, IPC bridge |
| System info | **`sysinfo` crate** | Processes, RAM, CPU, disk, battery |
| Async | **Tokio** | Background 3-second refresh loop |
| Serialization | **`serde` + `serde_json`** | Rust ↔ TypeScript data bridge |
| Frontend | **React 19 + Vite** | Fast HMR dev, component tree |
| Styling | **Tailwind CSS** | Utility-first dark theme |
| State | **Zustand** | Global tab and search state |
| Data fetching | **TanStack Query** | Poll backend, cache, refetch on event |
| CI/CD | **GitHub Actions** | 3-platform release builds |

---

## Project Structure

```
sysora/
├── src/                        # React frontend
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Shell.tsx       # Root layout
│   │   │   ├── Sidebar.tsx     # Nav sidebar
│   │   │   ├── TopBar.tsx      # Search + live indicator
│   │   │   └── StatCard.tsx    # RAM/CPU/Disk/Battery cards
│   │   └── tabs/
│   │       ├── MemoryTab.tsx   # ✅ Phase 1 — live processes + kill
│   │       ├── ProcessesTab.tsx # ✅ Phase 1 — sortable full list
│   │       ├── DiskTab.tsx     # ✅ Phase 1 — disk usage
│   │       ├── SystemInfoTab.tsx # ✅ Phase 1 — specs + battery health
│   │       ├── AppsTab.tsx     # 🔲 Phase 2
│   │       └── SettingsTab.tsx # 🔲 Phase 2
│   ├── lib/
│   │   ├── api.ts              # All Tauri invoke() calls
│   │   └── utils.ts            # fmtBytes, fmtUptime, color helpers
│   ├── store/
│   │   └── app.ts              # Zustand store
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # Entrypoint
│   │   └── lib.rs              # All Tauri commands + tray setup
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       └── release.yml         # CI/CD — Ubuntu + macOS + Windows
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── LICENSE
```

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Tauri CLI | v2 | `npm install --save-dev @tauri-apps/cli@^2` |

**Ubuntu only — system libraries required:**
```bash
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libssl-dev pkg-config
```

**macOS only:**
```bash
xcode-select --install
```

---

### Run in development

```bash
# 1. Clone the repo
git clone https://github.com/chojuninengu/sysora.git
cd sysora

# 2. Install frontend dependencies
npm install

# 3. Add a placeholder tray icon (required for Tauri to start)
mkdir -p src-tauri/icons
# Copy any 32x32 PNG as icon.png — replace with real icon later
cp /path/to/any-icon.png src-tauri/icons/icon.png

# 4. Start dev server (hot-reloads both React and Rust)
npm run tauri dev
```

The app window opens automatically. The tray icon appears in your system tray.

---

### Build for production

```bash
npm run tauri build
```

Output artifacts are in `src-tauri/target/release/bundle/`:
- **Ubuntu:** `deb/sysora_*.deb` and `appimage/sysora_*.AppImage`
- **macOS:** `dmg/Sysora_*.dmg`
- **Windows:** `msi/Sysora_*.msi` and `nsis/Sysora_*.exe`

---

### Release a new version

```bash
# Bump version in package.json and src-tauri/tauri.conf.json + Cargo.toml, then:
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions picks up the tag and starts three parallel build jobs. Once complete, artifacts appear as a draft release on GitHub — review and publish.

---

## Feature Roadmap

### ✅ Phase 1 — Foundation (current)
- [x] Tauri 2 + React 19 + Vite + Tailwind scaffold
- [x] Tray icon with toggle window / system info / quit
- [x] Memory Monitor — live process list sorted by RAM, Kill button per process
- [x] Process Manager — full sortable process list with search
- [x] Disk Scanner — all mounted disks with usage bars
- [x] System Info — OS, CPU, RAM, uptime, battery health (design capacity vs current)
- [x] Quick Spec Summary panel — copy/share machine specs
- [x] GitHub Actions CI — Ubuntu + macOS + Windows release builds

### 🔲 Phase 2 — Management
- [ ] App Manager — list installed applications, uninstall from UI
- [ ] Settings — refresh rate, startup on login, notification thresholds
- [ ] Battery: macOS and Windows native battery API support
- [ ] Disk file scanner — show largest files and folders (home / root)
- [ ] CPU history graph (last 60s sparkline)

### 🔲 Phase 3 — Polish
- [ ] Notifications — alert when RAM or CPU crosses threshold
- [ ] Auto-launch on login (all platforms)
- [ ] Sysora branded icon + splash screen
- [ ] Export system report as PDF
- [ ] Dark/light theme toggle

---

## Battery Health — How It Works

Sysora distinguishes between two different battery numbers that most tools confuse:

| Metric | What it means |
|---|---|
| **Current charge** | How full the battery is right now (0–100%) |
| **Battery health** | Current max capacity vs the original design capacity |

A battery with **60% health** that is fully charged will only last 60% as long as it did when it was new — even though it shows "100% charge".

This is read from `/sys/class/power_supply/BAT0/` on Linux (`energy_full` vs `energy_full_design`). macOS and Windows native APIs are planned for Phase 2.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a PR against `main`

---

## License

[MIT](LICENSE) © 2024 chojuninengu
