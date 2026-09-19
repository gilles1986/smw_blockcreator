# Library: sprite Pieces (spawn sprite, touching-sprite Actions)

Status: done
Blocked by: 12, 11
Spec: ../spec.md

Spawn sprite (vanilla/custom from the list, extra bit, extra bytes 1-4 shown only for custom, position in/above/below/left/right/offset, state normal/carryable/kicked/carried, X/Y speed, facing). Touching sprite: push sprite (like boost), set sprite state, turn around, kill (fall/puff via `bc_kill_touching_sprite`). Recommended states hinted for vanilla sprites.

**Done when**
- All sprite Pieces assemble in every allowed Slot.
- The "kicked shell flying up-right" preset is on the emulator checklist of ticket 19.

**Result (2026-09-19)**
- `spawn_sprite` is version 2 and has what the ticket lists: position inside / above / below / left / right / offset (`%move_spawn_relative()` with a signed pixel offset), facing (leave, right, left, like Mario, away from Mario), and for a custom sprite the extra bit and extra bytes 1–4. A Block made with version 1 generates exactly the code it did (a test). A sprite spawned by a routine does not read its extra bytes from the level, so a custom sprite always gets all four written, none is left over from the sprite that had the slot before.
- Parameters can now be hidden while they do not apply: a manifest sets `showWhen: { param, equals }` and the editor hides that row (`ui/blockly/visibility.ts`; the value stays and is still used). The extra bit and bytes show only for a custom sprite, the offset only for the position "Offset from block".
- Recommended states are hinted in the Piece's description, not enforced. The other sprite Pieces (Change touching sprite, Push sprite, Set sprite state, Turn sprite around, Kill touching sprite) were already there; `npm run check:asar` assembles every option of each in a Mario and in a sprite Slot, and Spawn sprite with all positions and facings together.
- `kill_touching_sprite` still works inline instead of through `bc_kill_touching_sprite` (see ticket 11). Push sprite only sets or adds, like Boost Mario; the 8 directions and "away from block" for both wait in ticket 12.
