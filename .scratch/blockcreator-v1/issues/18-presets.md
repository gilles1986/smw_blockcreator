# Presets and New from preset

Status: open
Blocked by: 13, 14, 17
Spec: ../spec.md

8-10 presets as generated Blocks in `library/presets/`: ON/OFF solid block, Mario-only passable, sprite-only passable, muncher that kills sprites, one-way (solid from one side), boost block (away), kicked-shell spawner, water toggle, coin-once block. "New from preset..." opens a copy. Presets double as golden tests.

**Done when**
- Every preset re-opens, regenerates byte-identically and assembles.

**Notes from 12 (muncher)**
- The muncher preset uses Kill / Hurt Mario with `side_hitbox` on in Left, Right and Inside, and the top edge guarded by a falling check (see ticket 23, `c_really_on_top`).
