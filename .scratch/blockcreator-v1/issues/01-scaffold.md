# Scaffold Tauri + Vite + React + TypeScript app with `core/` package

Status: done
Blocked by: -
Spec: ../spec.md

Create the app skeleton: Tauri 2 shell, Vite + React + TypeScript front-end, a framework-free `core/` folder with Vitest, lint/format config, `.gitignore`. The window shows the empty variant-C layout (sidebar + editor + ASM pane placeholders). One command starts the Tauri dev app; `npm test` runs core tests.

Prerequisite: Rust toolchain installed (`cargo --version` works).

**Done when**
- `npm run tauri dev` opens the app window with the three empty panes.
- `npm test` runs a trivial `core` test green.
- README section "Develop" lists the commands.
