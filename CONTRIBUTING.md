# Contributing to Sysora

First off, thank you for considering contributing to Sysora! It's people like you that make Sysora such a great tool for everyone.

## Code of Conduct

By participating in this project, you agree to abide by our terms. We expect all contributors to be respectful and collaborative.

## How Can I Contribute?

### Reporting Bugs
* Check the existing issues to see if the bug has already been reported.
* If not, open a new issue. Include a clear title, a description of the problem, and steps to reproduce the issue.
* Attach screenshots or logs if possible.

### Suggesting Enhancements
* Open a new issue with the tag `enhancement`.
* Explain why the feature would be useful and how it should work.

### Your First Code Contribution
1. **Fork the repo**: Click the "Fork" button at the top right of this page.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sysora.git
   cd sysora
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
5. **Make your changes**: Ensure your code follows the existing style.
6. **Test your changes**: Run `npm run tauri dev` to verify.
7. **Commit your changes**:
   ```bash
   git commit -m "feat: add some cool feature"
   ```
8. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```
9. **Open a Pull Request**: Submit your PR against the `main` branch of the original repo.

## Tech Stack Knowledge
To contribute effectively, you should be familiar with:
* **Rust**: Used for the backend logic and OS integrations.
* **Tauri v2**: The bridge between Rust and the web frontend.
* **React**: Used for building the dashboard UI.
* **Tailwind CSS**: Used for all styling and the dark/light theme system.
* **SQLite (rusqlite)**: Used for historical data persistence.

## Development Commands

```bash
# Run in dev mode (with HMR)
npm run tauri dev

# Build production bundles
npm run tauri build
```

---

*Happy hacking!* 🚀
