# BlockCreator

A modern visual editor for **Super Mario World** custom blocks ([GPS](https://www.smwcentral.net/?p=section&a=details&id=31515)).

Compose custom block logic visually using reusable **Pieces** (Actions & Conditions) per contact Slot, generate clean, SA-1-compatible GPS `.asm` code, and easily re-open and modify existing blocks at any time.

[![BlockCreator Preview](https://saphros.de/resource-files/images/block_creator.png)](https://saphros.de/block-creator)

---

### 🌐 Links & Download

- **Live Web App & Download:** [saphros.de/block-creator](https://saphros.de/block-creator)
- **Direct Web App:** [saphros.de/blockcreator/web/](https://saphros.de/blockcreator/web/)
- Available as a **Windows Desktop App** (`.exe` via Tauri) and directly in the browser as a **Web App**.

---

## ✨ Features

- **Visual Logic with Blockly:** Build nested `if` / `else if` / `else` stacks with drag-and-drop ease. No need to memorize 65816 assembly or GPS routine offsets.
- **Side-Based Slots:** Logic is organized by physical block interaction sides (Mario Top, Bottom, Sides, Inside, and Sprite contacts) instead of raw memory offsets.
- **Clean GPS `.asm` Generation:** Outputs clean, performant, SA-1-compatible assembly code with automatic register protection (`X`/`Y` clobber handling) and label resolution.
- **Full Two-Way Editing (Roundtrip):** Generated `.asm` files contain an embedded JSON header and integrity checksum, allowing any generated block to be opened, modified, and re-saved without losing visual block layout.
- **Extensive Piece Library:**
  - **Actions:** Play sound effects, change Mario's speed / boost, give/take powerups, give coins/lives, spawn vanilla & custom PIXI sprites, trigger screen shake, toggle ON/OFF states, set level flags (water, slippery), run custom ASM snippets, and more.
  - **Conditions:** Check Mario's powerup, direction, ON/OFF switch, P-Switch, Yoshi state, carrying status, sprite states, or custom RAM addresses.
- **Ready-to-Use Presets:** Includes classic templates like Question Blocks (coin/powerup), Brick Blocks, Note Blocks, Yoshi Coin Gates, One-Way Walls, and Toggle Blocks.
- **Live ASM Preview & Asar Validation:** View real-time assembly generation side-by-side with your Blockly workspace, with built-in Asar syntax validation.
- **Extensible:** Add your own custom Pieces (Actions/Conditions) using simple ASM templates and JSON manifests, or leverage the Custom ASM escape hatch.

---

## 🚀 How It Works

1. **Configure Block Properties:** Name your block, set author and description (shown as tooltips in Lunar Magic), and specify the default *Act As* tile number.
2. **Select an Interaction Slot:** Choose how the block responds (e.g. Mario hitting from below, standing on top, or a sprite touching the side).
3. **Assemble Logic:** Drag Actions and Conditions into the Blockly workspace.
4. **Export / Save:** Save directly into your GPS blocks directory or copy the generated `.asm` code.

---

## 📚 Documentation

- [CONTEXT.md](CONTEXT.md) — Architecture overview, core concepts, and terminology.
- [docs/piece-authoring.md](docs/piece-authoring.md) — Complete guide for creating your own Actions and Conditions.
- [docs/piece-authoring-for-ai.md](docs/piece-authoring-for-ai.md) — Guidelines for using AI models to write new Pieces.
- [docs/adr/](docs/adr/) — Architectural Decision Records.

---

## 🛠️ Project Structure

- `core/` — Framework-agnostic TypeScript logic (block model, generator, parser, library loader, Asar validation). No React/DOM dependencies, tested with Vitest.
- `ui/` — React frontend built with Vite and Google Blockly.
- `library/` — Built-in Library of Actions, Conditions, Routines, and Presets.
- `src-tauri/` — Tauri 2 shell providing native desktop integration (file system, dialogs, Asar verification).

---

## 💻 Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://www.rust-lang.org/) toolchain (`cargo --version`)
- Visual Studio C++ Build Tools (Windows)
- WebView2 (pre-installed on Windows 10/11)

### Getting Started

```bash
# Install dependencies
npm install

# Run desktop app with hot reload
npm run tauri dev

# Run web app in browser (http://localhost:5173)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Typecheck (core, ui, configs)
npm run typecheck

# Lint and format
npm run lint
npm run format:check

# Build release desktop executable
npm run tauri build
```

---

## 📦 Release & Packaging

- `build.bat` compiles the release executable and packages `BlockCreator.zip` (via `release/package.ps1`) with user documentation, schemas, and the built-in Library.
- `release.bat` automates version bumping across project configuration files, builds the desktop application and `BlockCreator.zip`, and runs automated verification.
  - `release.bat --dry-run` — Preview release steps without modifying files.
  - `release.bat --no-upload` — Build and package locally without remote upload.
  - Optional remote deployment can be configured via `deploy.config.json` (see `deploy.config.example.json`).
