# Tool routines (`bc_*`) and copying them into the project

Status: open
Blocked by: 10
Spec: ../spec.md

`library/routines/` with `bc_kill_touching_sprite` and `bc_holding_sprite` (plus whatever later Pieces need). Pieces list required routines; the generated header names them. Save to project copies missing ones after asking; never overwrites silently, asks when content differs. Save as... lists files and destination instead.

**Done when**
- Routines use only `?` labels and assemble in the harness.
- The copy prompt appears only for missing or different routines.

**Notes from 23 (extended Pieces)**
- `library/routines/bc_holding_sprite.asm` exists now (carry set and X = slot of the carried sprite) and is used by `c_holding_sprite_id`; `npm run check:asar` assembles every routine file wrapped in a macro like GPS does. `kill_touching_sprite` does its work inline, so `bc_kill_touching_sprite` is not needed so far. Copying the routines into the GPS project on "Save to GPS project…" is still to do; until then the file is copied by hand.
