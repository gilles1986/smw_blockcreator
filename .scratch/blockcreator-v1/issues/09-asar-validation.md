# Asar validation with error mapping to Slot and Piece

Status: done
Blocked by: 04
Spec: ../spec.md

Decide Asar distribution (bundle `asar.exe` vs. the project's `asar.dll`; check the licence) and record it as an ADR. Harness file with GPS `defines.asm` and routine stubs; a Tauri command runs Asar; errors are mapped back via `lineMap`. "Check" button + automatic check before every save; saving is blocked on errors.

**Done when**
- A Custom ASM Piece with a typo shows the error on that Slot/Block in the editor.
- A script assembles all golden files; later tickets use it.

**Notes from 04 (generator tracer)**
- Check whether Asar expands `!defines` inside `print "…"` strings; a description containing `!` may then fail to assemble. If so, escape or replace `!` in `tooltip()` (`core/generator/generate.ts`).
- `lineMap` gives `{ slot, path }` (e.g. `/0/branches/1/condition`); add a small helper that resolves a path to its statement/PieceRef when mapping Asar errors.

**Notes from 08 (condition logic)**
- Assemble every golden in `core/generator/golden/` (incl. `or_switch`, `not_switch`, `nested_if`, `long_body`) — ticket 08's "every test output assembles with Asar" lands here.
- `core/generator/branches.ts` only bounds line sizes from above (`maxBytes`); Asar is the real check. If Asar reports "relative branch out of bounds", the estimate is wrong somewhere — fix `maxBytes` rather than patching the output.
