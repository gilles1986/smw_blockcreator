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
