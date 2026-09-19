# Tool routines (`bc_*`) and copying them into the project

Status: done
Blocked by: 10
Spec: ../spec.md

`library/routines/` with `bc_kill_touching_sprite` and `bc_holding_sprite` (plus whatever later Pieces need). Pieces list required routines; the generated header names them. Save to project copies missing ones after asking; never overwrites silently, asks when content differs. Save as... lists files and destination instead.

**Done when**
- Routines use only `?` labels and assemble in the harness.
- The copy prompt appears only for missing or different routines.

**Notes from 23 (extended Pieces)**
- `library/routines/bc_holding_sprite.asm` exists now (carry set and X = slot of the carried sprite) and is used by `c_holding_sprite_id`; `npm run check:asar` assembles every routine file wrapped in a macro like GPS does. `kill_touching_sprite` does its work inline, so `bc_kill_touching_sprite` is not needed so far.

**Result (2026-09-19)**
- `generate()` returns `routines`, the sorted `bc_*` routines the Block calls (the header line "Needs GPS routines" is made from the same list).
- "Save to GPS project…" (`ui/projectSave.ts`, `copyRoutines`): after the Block and the list it looks at `routines/<name>.asm` in the project. Nothing is asked when every routine is there and the same (line breaks do not count). Missing ones are copied after one question that names them; a different one is only replaced after a question of its own; neither is replaced silently. Saying no still saves the Block, and the notice (`ui/routineNotes.ts`) says which routine is missing or was kept, since GPS cannot assemble the Block without it.
- Save and Save as… cannot copy: they say which files the Block needs and where they go (the configured GPS folder's `routines`, or "the routines folder of your GPS project"), and that "Save to GPS project…" copies them.
- Routine files may only use `?` labels (a test); the check assembles each routine wrapped in a macro like GPS does (`npm run check:asar`).
- Not tried by hand in the app yet: the native question dialogs and the notices.
