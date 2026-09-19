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

**Notes from 13 (sprite Pieces)**
- The "kicked shell flying up-right" case: Spawn sprite with a shell (04-07 or DA-DD), state Kicked ($0A), a positive X speed and a negative Y speed, facing right, from a block Mario hits from below. Check the shell's direction and speed, that the state 'Stunned' leaves it lying, and that a custom sprite gets its extra bit and bytes (and none left over from another sprite).
- Spawn positions left / right / offset next to and away from the block, in a Mario Slot and in a sprite Slot.

**Notes from 14 (level Pieces)**
- Pieces that changed after checking their addresses, to try in the emulator: **Disable buttons** (B and A: Mario cannot start a jump while he touches the block, and holding a direction still walks; controller 2 with `$0DA0` set), **Scroll lock** (locked: the screen stops following Mario, unlocked: it scrolls again), **Water / slippery** (`$80` is fully slippery; try one half slippery value with Write RAM), **Lives check** against the status bar with 1, 2 and 5 lives, **Touching sprite is** with a custom sprite that acts like a shell (a vanilla shell test must not match it), **Controller button** for B with A held (must not count), and for Y with X held.
- Write RAM / RAM check on an SA-1 ROM (the archive's `$0DAA` blocks use `|!addr`): a direct page address (`$85`), one from `$0100` on (`$0F44`), and a `$7E` address typed from a RAM map.
- Not done, may be worth a Piece: the star, P-switch and level end music (see ticket 14). Check what the level music does when a star or P-switch from these Pieces runs out.
