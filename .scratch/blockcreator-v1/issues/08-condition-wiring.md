# Condition logic: AND / OR / NOT, long branches, register saves

Status: open
Blocked by: 04
Spec: ../spec.md

Generator: label rewiring for AND/OR/NOT and nested ifs; branch-range handling (inverted branch + `JMP` when the target is out of range); save/restore per `clobbers` (Y always, X in sprite/fireball Slots); unique labels across Pieces.

**Done when**
- Golden tests for OR, NOT, nested if with else-if, and a branch body over 128 bytes.
- Every test output assembles with Asar once ticket 09 lands.

**Notes from 07 (all Slots)**
- Side / sprite splits (`Emitter.split` in `core/generator/generate.ts`) emit a plain `BNE` / `BMI` to the second half; include them in the long-branch handling (first half > 127 bytes).
- Sprite Slots are live now: X is the sprite index there (and the extended-sprite index in Fireball), so the register saves per `clobbers` matter. `%sprite_block_position()` only uses A.
