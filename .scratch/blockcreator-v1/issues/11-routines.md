# Tool routines (`bc_*`) and copying them into the project

Status: open
Blocked by: 10
Spec: ../spec.md

`library/routines/` with `bc_kill_touching_sprite` and `bc_holding_sprite` (plus whatever later Pieces need). Pieces list required routines; the generated header names them. Save to project copies missing ones after asking; never overwrites silently, asks when content differs. Save as... lists files and destination instead.

**Done when**
- Routines use only `?` labels and assemble in the harness.
- The copy prompt appears only for missing or different routines.
