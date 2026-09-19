# 4. Asar checks use the GPS project's own `asar.dll`

## Status
Accepted (2026-09-19)

## Context
The tool checks every generated Block by assembling it (ticket 09), so errors show up in the editor instead of in GPS. It needs an Asar: either ship one with BlockCreator, or use one the user already has.

Asar is published under GPL-3.0, LGPL-3.0 and WTFPL (as listed on its repository page, checked 2026-09-19); its README does not say how to redistribute the DLL or `asar.exe` with another tool, so shipping one would need the licence terms read closely before the first release.

Every GPS folder already contains an `asar.dll` (the one GPS assembles blocks with) and a `defines.asm` (the defines every Block is assembled against).

The v1 spec planned to run `asar.exe` through the Tauri shell plugin. Loading the DLL in-process needs one custom Rust command instead, but no bundled binary, no process spawning and no path to `asar.exe` to find.

## Decision
BlockCreator does **not** ship Asar. A check loads the `asar.dll` of the GPS project the user works in, from Rust (`libloading`, `src-tauri/src/asar.rs`), and assembles the Block next to a copy of that project's `defines.asm`. Routines are stubbed as macros named after the project's `routines/*.asm` and the built-in `bc_*` routines: a check needs their names, not their code.

- The DLL is loaded per check and closed afterwards. Asar keeps global state, so checks run one at a time.
- Files go into a temporary folder and are removed afterwards; only plain file names are accepted.
- Messages are placed on Slots and Pieces with the generator's `lineMap`. Errors in the harness or `defines.asm` are shown without a Slot.
- Until projects exist (ticket 10) the GPS folder is asked for once and remembered in the WebView's local storage. Without one, the Block can still be saved, with a note that it was not checked.
- Tests use the same DLL from Node (`koffi`) and are skipped without a GPS folder: `../GPS` next to this repository, or `BLOCKCREATOR_GPS`. `npm run check:asar` runs them, including every golden file and every Library Piece in each kind of Slot it allows.

## Consequences
- No redistribution question and no version drift: the check uses the assembler that will assemble the Block for real.
- The DLL's architecture has to match the app (64-bit; today's GPS `asar.dll` is). A 32-bit or unexpected DLL fails to load and the error is shown.
- The Rust code relies on the layout of `asardll.h` (Asar 1.91: `asar_patch`, `asar_geterrors`, `asar_getwarnings`, `asar_maxromsize`, `asar_close`); a GPS shipping a much newer or older Asar must be tried out.
- A user without a GPS folder gets no check, which is acceptable: the tool is for people who insert Blocks with GPS.
- If bundling Asar is wanted later, this ADR is superseded; the `AsarRunner` seam in `core/assemble` does not change.
