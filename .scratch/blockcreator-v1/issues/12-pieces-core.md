# Library: Physics, Damage, Effects, Sound Pieces + `once` warnings

Status: open
Blocked by: 05, 08
Spec: ../spec.md

Pieces: act as (all options + custom value), boost Mario (8 directions / away from block, X/Y, set/add, presets), hurt Mario (muncher-correct side check), kill Mario, smoke, glitter, shatter, erase block, change to tile, shake screen, play sound (named list per port), change music. Editor warning for `once` Pieces not followed by a `removesBlock` Piece in the same branch.

**Done when**
- Each Piece assembles with defaults in every allowed Slot (Asar script from 09).
- Boost "away from block" produces the right sign per Slot (tests).

**Notes from 09 (Asar validation)**
- `npm run check:asar` (needs `../GPS` next to the repo, or `BLOCKCREATOR_GPS`) assembles every Library Piece with its defaults in `marioTop` and `spriteTop` and lists failures per Piece; use it rather than a new script. It skips silently without a GPS folder. A Piece whose code differs per Slot (fireball, wall-run) needs an extra case.
- Asar errors use Blockly warning id `asar` (`ui/blockly/BlocklyEditor.tsx`); give the `once` warning its own id so the two do not overwrite each other.

**Progress (2026-09-19)**
- The muncher-correct side check is in: `hurt_mario` and `kill_mario` (version 2) have a `side_hitbox` option (default off). On, a contact that only touches the edge pixel does not hit: `LDA $94 : AND #$0F`, compared with `$02` (Mario left of the block, `$93` = 0) or `$0D` (right), the test of GPS's `hurt_death.asm` (`SidePixelTable`) and of the archive's VanillaMuncher. It belongs in the Left, Right, Inside and Top corner Slots; `$93` means nothing for Top and Bottom. The top edge of a real muncher (only hurts while falling, not with Yoshi) is `c_really_on_top` in ticket 23.

- **`once` warning (2026-09-19):** a one-shot Piece (`once`) gets a warning icon on its block when its branch (the top of a Slot, or one body of an `if` / `else if` / `else`) has no `removesBlock` Piece, anywhere in it: once the block is removed or changed the Action cannot run again, wherever it stands in the list. `ui/onceWarnings.ts`, tests in `ui/onceWarnings.test.ts`; the warning is merged with Asar's in `App.tsx`. `change_to_tile` is now `removesBlock` (it replaces this block). The other neighbour-changing Pieces are not: they change another block.
- **Still open in this ticket:** Boost Mario has only set / add for X and Y. The 8 directions, "away from block" and the presets (spring, note block, …) are missing. "Away" depends on the Slot (Top pushes up, Bottom down, Left / Right by `$93`), which a template cannot see yet: the generator would have to hand the Slot to the template (a reserved `slot` value).
