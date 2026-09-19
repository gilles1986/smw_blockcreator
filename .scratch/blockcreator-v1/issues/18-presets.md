# Presets and New from preset

Status: done
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

**Notes from 12 (Boost Mario, Push sprite)**
- The "boost block (away)" preset is possible now: Boost Mario with Horizontal push and Vertical push both "Away from the block", one Slot each for Top, Bottom, Left (Right linked to Left works: `$93` decides). Springs and note blocks are the same Piece with an upward push; their strengths are for the emulator (ticket 19).

**Result (2026-09-19)**
- 11 Presets, all in `core/testing/presets.ts` (`npm run presets` writes `library/presets/*.asm`): `muncher`, `death_block`, `muncher_sprite_killer`, `onoff_solid`, `mario_passable`, `sprite_passable`, `one_way`, `boost_away`, `kicked_shell_spawner`, `coin_once`, `water_toggle`. `presets.test.ts` says for each which Pieces sit in which Slot with which values; it also checks that no one-shot Action is left without a Piece that removes the block, and (with the existing checks) that every file re-opens, regenerates byte-identically and has a model. `npm run check:asar` assembles all of them.
- Every Preset has default act as 130 and sets act as itself where it matters, so it does not depend on the `list.txt` value. Right is linked to Left, the Top corner follows Top.
- `one_way` lets Mario jump up through it: the Top Slot is solid only while he really stands on it (`c_really_on_top`). `water_toggle` uses "Up pressed" as the edge, so the flag flips once per press and not every frame; it writes `$85` with Write RAM, because Water / slippery would also reset the slippery flag. `kicked_shell_spawner` and `coin_once` end in Change to tile `$0132`, the used block (the tile the game generates for `$0D` in `TileToGeneratePg1`, bank 00).
- The strengths of `boost_away` (X 48, Y 96) and the shell's speeds (X 32, Y -48) are starting values, not measured ones: ticket 19.
- The summary wording for the Presets ("Summaries match the prototype's wording…") stays with ticket 17, which the Presets themselves did not need.
