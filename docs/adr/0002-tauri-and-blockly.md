# 2. Tauri desktop shell with a Blockly logic editor

## Status
Accepted (2026-09-18)

## Context
The tool is a downloadable community tool for Windows-centric SMW hackers. It needs Scratch-style nested `if` / `else if` / `else` editing, direct file access to a GPS project (block folder, `routines/`, `list.txt`) and the ability to run Asar for validation. Alternatives: Electron (100 MB+ download), PySide6 or .NET (the nested block editor would have to be built by hand).

## Decision
Tauri (native shell using WebView2) for the app; Google Blockly for the per-Slot logic editor, with Blocks defined from Piece manifests.

## Consequences
- Small download; WebView2 ships with Windows 10/11.
- Building requires a Rust toolchain on the developer machine (not installed yet).
- Blockly supplies drag-and-drop, nesting and a code-generator framework; the custom work is the Slot scene, Piece loading and ASM generation.
