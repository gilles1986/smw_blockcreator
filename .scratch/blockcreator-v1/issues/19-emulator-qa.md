# HITL: verify generated Blocks in an emulator

Status: open
Blocked by: 18
Spec: ../spec.md

Human in the loop: insert all presets into a test project via GPS and check them in an emulator. Resolve the research's open points: WallFeet vs. WallBody, X in MarioCape, sound IDs, `1F0` behaviour, spawned custom sprites with extra bytes. Record findings in `docs/research/` and fix Pieces / generator.

**Done when**
- The user signs off a checklist per preset; research open points are closed or re-scoped.

**Notes from 07 (all Slots)**
- Confirm `$93`: 0 = Mario touches the block from its left (corrected from the research doc via disassembly `CODE_00EB77`). Test with `core/generator/golden/side_split.asm` (solid from the left, air from the right).
- WallFeet vs WallBody mapping is still unverified (research doc, open question 1).

**Notes from 15 (name lists)**
- Try the Lunar Magic shell numbers in the emulator: DA–DD (sprite 04–07 in status 09, a shell lying there) and DF (sprite 09 in status 09, two bounces before it is stunned). Spawn sprite and Change touching sprite keep the chosen initial state, so a lying shell needs 'Stunned / carryable ($09)'.

**Notes from 23 (extended Pieces)**
- Try in the emulator: the neighbour Pieces in a vertical level (the block position must be back after the change), `teleport` (screen exit, sublevel instant, sublevel with the pipe animation), `drop_item_box` with and without an item in the box (the data bank around the call), `c_holding_sprite_id` with a key, a shell and a custom sprite, and a muncher built from Kill Mario with the muncher hitbox and `c_really_on_top` / `c_mario_speed`.
