# Presets and New from preset

Status: open
Blocked by: 13, 14, 17
Spec: ../spec.md

8-10 presets as generated Blocks in `library/presets/`: ON/OFF solid block, Mario-only passable, sprite-only passable, muncher that kills sprites, one-way (solid from one side), boost block (away), kicked-shell spawner, water toggle, coin-once block. "New from preset..." opens a copy. Presets double as golden tests.

**Done when**
- Every preset re-opens, regenerates byte-identically and assembles.

**Progress (2026-09-19)**
- The Preset mechanism is in, with one Preset, `muncher`: `core/testing/presets.ts` holds the models the files are generated from, `npm run presets` (vitest `-u`) rewrites `library/presets/*.asm`, and `core/library/presets.test.ts` checks every file (re-opens unedited, regenerates byte-identically, every model has its file); `npm run check:asar` assembles each. "New from preset…" (icon next to New, `ui/PresetDialog.tsx`, list from `ui/presets.ts`) opens a copy with no file yet, after the usual question about unsaved changes.
- `muncher`: Left = Hurt Mario with the muncher hitbox; Right, Top corner and Inside are linked to Left; Top and Bottom are plain Hurt Mario; act as 130. It is built like GPS's `hurt_death.asm`. Not tried in the emulator yet (ticket 19).
- Still to do: the other presets of the list (they wait for tickets 13, 14, 17), and the muncher "that kills sprites" variant.

**Notes from 12 (muncher)**
- The muncher preset uses Kill / Hurt Mario with `side_hitbox` on in Left, Right and Inside, and the top edge guarded by a falling check (see ticket 23, `c_really_on_top`).
