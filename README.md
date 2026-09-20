# BlockCreator

A visual editor for Super Mario World custom blocks (GPS). Compose a block's behaviour from reusable Pieces per Slot, get SA-1-compatible GPS `.asm`, and re-open anything the tool generated. See [CONTEXT.md](CONTEXT.md) for the vocabulary and [docs/adr](docs/adr) for the decisions. To write your own Pieces (the building blocks of the editor), read [docs/piece-authoring.md](docs/piece-authoring.md). To have an AI write them, give it [docs/piece-authoring-for-ai.md](docs/piece-authoring-for-ai.md) too.

## Layout

- `core/` — framework-free TypeScript (template, library, model, generator, header, …). No React, Tauri, Blockly or DOM imports; tested with Vitest.
- `ui/` — React front-end (Vite).
- `src-tauri/` — Tauri 2 shell (file dialogs, file system, Asar checks with the GPS project's `asar.dll`).

## Develop

Prerequisites: Node.js 22+, Rust toolchain (`cargo --version` works), Visual Studio C++ build tools, WebView2 (ships with Windows 10/11).

```bash
npm install          # install dependencies
npm run tauri dev    # start the desktop app with hot reload
npm run dev          # front-end only, in the browser at http://localhost:5173
npm test             # run core tests once
npm run test:watch   # run core tests in watch mode
npm run typecheck    # type-check core, ui and config files
npm run lint         # ESLint
npm run format       # Prettier (format:check to verify only)
npm run tauri build  # build the release .exe / installer
```

`build.bat` makes the release: it builds the `.exe` and packs `BlockCreator.zip` (`release/package.ps1`) with the program, [release/README.txt](release/README.txt) for the user, [release/AGENTS.md](release/AGENTS.md) for an AI tool opened in the unpacked folder, and the guides, the schema and the built-in Library that AGENTS.md points to.
