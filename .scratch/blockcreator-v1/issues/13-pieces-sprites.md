# Library: sprite Pieces (spawn sprite, touching-sprite Actions)

Status: open
Blocked by: 12, 11
Spec: ../spec.md

Spawn sprite (vanilla/custom from the list, extra bit, extra bytes 1-4 shown only for custom, position in/above/below/left/right/offset, state normal/carryable/kicked/carried, X/Y speed, facing). Touching sprite: push sprite (like boost), set sprite state, turn around, kill (fall/puff via `bc_kill_touching_sprite`). Recommended states hinted for vanilla sprites.

**Done when**
- All sprite Pieces assemble in every allowed Slot.
- The "kicked shell flying up-right" preset is on the emulator checklist of ticket 19.
