# All Slots: side splits, sprite Slots, advanced Slots, corner link, `db $37`

Status: done
Blocked by: 04, 05
Spec: ../spec.md

Generator + UI for Mario Left/Right (`$93`), Sprite Top/Bottom (`!AA,x`) and Left/Right (`!B6,x`) incl. `%sprite_block_position()`, advanced Slots (corner, head/body inside, cape, fireball, wall-run) behind the toggle, "Top corner = Top" link (`JMP MarioAbove`), automatic `db $37` when a wall-run Slot is filled. Toolbox filters Mario-only / Sprite-only Pieces.

**Done when**
- Golden tests for a side-split Mario block, a sprite-only block, and a wall-run block.
- The sprite Slot toolbox hides Mario-only Pieces and vice versa.

**Notes from 04 (generator tracer)**
- The golden `core/generator/golden/onoff_cement.asm` has TopCorner as a bare `RTL`; it changes when the "Top corner = Top" link (`JMP MarioAbove`) lands. Regenerate its checksum independently (FNV-1a 32 over the UTF-8 text below line 3), not with the code under test.
