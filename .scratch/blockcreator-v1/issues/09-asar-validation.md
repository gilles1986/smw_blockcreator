# Asar validation with error mapping to Slot and Piece

Status: open
Blocked by: 04
Spec: ../spec.md

Decide Asar distribution (bundle `asar.exe` vs. the project's `asar.dll`; check the licence) and record it as an ADR. Harness file with GPS `defines.asm` and routine stubs; a Tauri command runs Asar; errors are mapped back via `lineMap`. "Check" button + automatic check before every save; saving is blocked on errors.

**Done when**
- A Custom ASM Piece with a typo shows the error on that Slot/Block in the editor.
- A script assembles all golden files; later tickets use it.
