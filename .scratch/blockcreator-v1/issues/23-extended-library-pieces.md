# Extended Library: High-Value Actions & Conditions (Pieces)

Status: in progress
Blocked by: 12, 13, 14
Spec: ../spec.md

Research & specification for expanding the BlockCreator built-in Library with new Actions and Conditions to unlock advanced SMW / Kaizo block mechanics, puzzle interactions, player manipulation, and level transitions.

---

## 1. Overview & Categories

The built-in library currently has 33 Actions and 23 Conditions (56 Pieces).
This expansion adds ~30 high-impact Pieces grouped into distinct functional domains:

| Category | Type | Proposed New Pieces |
|---|---|---|
| **Warps & Transitions** | Actions | `teleport`, `show_message`, `trigger_keyhole` |
| **Inventory & Collectables** | Actions | `set_item_box`, `drop_item_box`, `save_block_collected`, `give_lives`, `give_score_points` |
| **Player Physics & Control** | Actions | `set_mario_speed`, `set_mario_facing`, `set_spinjump`, `force_drop_item`, `dismount_yoshi` |
| **Sprite & Block Effects** | Actions | `quake_sprites_on_top`, `bounce_block`, `freeze_all_sprites`, `spawn_item_rise` |
| **Adjacent Block Control** | Actions | `change_adjacent_block`, `erase_adjacent_block` |
| **Adjacent Block Check** | Conditions | `c_adjacent_tile` |
| **Movement & Precision** | Conditions | `c_really_on_top`, `c_mario_speed`, `c_p_meter` |
| **Inventory & Character** | Conditions | `c_holding_sprite_id`, `c_invulnerable`, `c_player_character` |
| **Yoshi State** | Conditions | `c_yoshi_color`, `c_yoshi_mouth` |
| **Sprite Interaction** | Conditions | `c_sprite_facing`, `c_sprite_in_air`, `c_sprite_speed` |
| **Progress & Environment** | Conditions | `c_dragon_coins`, `c_sublevel`, `c_bonus_stars` |

---

## 2. New Actions — Technical Specification

### 2.1 Warps & Transitions
1. **`teleport`** (Category: `level`, Slots: `mario`, `once: true`)
   - **Description:** Warps Mario to the current screen's exit or a specific sublevel ID.
   - **Mechanic:**
     - Mode 0 (Current Screen Exit): calls `%teleport_direct()` with `X=0` (`$71=$0D`, `$0100=$0F`).
     - Mode 1 (Specific Sublevel): `REP #$20 : LDA #sublevel : %teleport()`.
   - **Params:** `mode` (enum: Screen Exit / Specific Sublevel), `destination` (number hex 0x000-0x1FF), `instant` (bool).
   - **Clobbers:** `["A", "X"]`

2. **`show_message`** (Category: `level`, Slots: `mario`, `once: true`)
   - **Description:** Displays Yoshi message box 1 or 2 in the current level.
   - **Mechanic:** Sets `$1426|!addr` to 1 or 2, triggers message box sound `$22` on `$1DFC`.
   - **Params:** `message` (enum: Message 1, Message 2).
   - **Clobbers:** `["A"]`

3. **`trigger_keyhole`** (Category: `level`, Slots: `mario`, `once: true`)
   - **Description:** Triggers the circular keyhole iris out and clears the level with secret exit.
   - **Mechanic:** Sets `$1434|!addr` to `$01` (iris shrink) or `$02` (iris expand).
   - **Params:** `style` (enum: Shrinking circle, Expanding circle).
   - **Clobbers:** `["A"]`

### 2.2 Inventory & Collectables
4. **`set_item_box`** (Category: `level`, Slots: `mario`)
   - **Description:** Sets or clears Mario's top reserve item box.
   - **Mechanic:** Writes to `$0DC2|!addr` (0 = None, 1 = Mushroom, 2 = Fire Flower, 3 = Star, 4 = Feather).
   - **Params:** `item` (enum: Empty, Mushroom, Fire Flower, Star, Feather).
   - **Clobbers:** `["A"]`

5. **`drop_item_box`** (Category: `level`, Slots: `mario`, `once: true`)
   - **Description:** Drops the item in the reserve box immediately as if Select was pressed.
   - **Mechanic:** Checks if `$0DC2 != 0`; if so, spawns the falling reserve item / triggers reserve drop timer.
   - **Params:** none.
   - **Clobbers:** `["A"]`

6. **`save_block_collected`** (Category: `level`, Slots: `any`)
   - **Description:** Marks this block as permanently collected in the level's Item Memory table ($19F8). Prevents respawning on re-entry.
   - **Mechanic:** Calls GPS built-in `%set_item_memory()`.
   - **Params:** none.
   - **Clobbers:** `["A"]`

7. **`give_lives`** (Category: `level`, Slots: `mario`)
   - **Description:** Grants or removes 1-Ups. Plays the 1-Up sound when positive.
   - **Mechanic:** Adds/subtracts from `$0DBE|!addr`. Plays sound `$0D` on `$1DFC`.
   - **Params:** `amount` (number: -5..+5, default 1).
   - **Clobbers:** `["A"]`

8. **`give_score_points`** (Category: `level`, Slots: `any`, `once: true`)
   - **Description:** Awards score points with floating score digits and sound.
   - **Mechanic:** Uses score sprites `$16E1` (values 10, 100, 200, 400, 800, 1000, 2000, 4000, 8000, 1-Up) or GPS `%hundred_points()`.
   - **Params:** `points` (enum: 100, 200, 400, 800, 1000, 2000, 4000, 8000, 1-Up).
   - **Clobbers:** `["A", "X"]`

### 2.3 Player Physics & Control
9. **`set_mario_speed`** (Category: `physics`, Slots: `mario`)
   - **Description:** Directly sets Mario's absolute X/Y speed components (freeze, cancel momentum, reverse).
   - **Mechanic:** Writes to `$7B` (X speed, signed) and/or `$7D` (Y speed, signed).
   - **Params:** `set_x` (bool), `x_speed` (signed -128..127), `set_y` (bool), `y_speed` (signed -128..127).
   - **Clobbers:** `["A"]`

10. **`set_mario_facing`** (Category: `physics`, Slots: `mario`)
    - **Description:** Forces Mario to face Left or Right.
    - **Mechanic:** Writes to `$76` (0 = Left, 1 = Right).
    - **Params:** `facing` (enum: Left, Right).
    - **Clobbers:** `["A"]`

11. **`set_spinjump`** (Category: `physics`, Slots: `mario`)
    - **Description:** Forces Mario into a spin jump state or cancels spin jump.
    - **Mechanic:** Sets `$140D|!addr` to 1 (spin) or 0 (normal).
    - **Params:** `spinning` (bool).
    - **Clobbers:** `["A"]`

12. **`force_drop_item`** (Category: `physics`, Slots: `mario`)
    - **Description:** Forces Mario to drop any held item or carried sprite.
    - **Mechanic:** Clears `$1470|!addr` and `$148F|!addr`. If a sprite is in status `$0B` (carried), resets its status to `$09` (stationary) or `$0A` (kicked).
    - **Params:** `kick` (bool: kick item forward vs drop stationary).
    - **Clobbers:** `["A", "X"]`

13. **`dismount_yoshi`** (Category: `physics`, Slots: `mario`)
    - **Description:** Forces Mario to dismount Yoshi immediately (No Yoshi zones).
    - **Mechanic:** If `$187A|!addr != 0`, clears `$187A`, sets Yoshi sprite to frightened state, plays dismount sound.
    - **Params:** none.
    - **Clobbers:** `["A", "X"]`

### 2.4 Sprite & Block Effects
14. **`quake_sprites_on_top`** (Category: `sprites`, Slots: `any`)
    - **Description:** Hits and flips or kills sprites standing on top of the block, identical to hitting a block from below.
    - **Mechanic:** Calls GPS built-in `%kill_sprite()`, which spawns Quake sprite `$16CD=1`.
    - **Params:** none.
    - **Clobbers:** `["X"]`

15. **`bounce_block`** (Category: `effects`, Slots: `any`)
    - **Description:** Spawns a bouncing block animation sprite (Question block / Turn block bump).
    - **Mechanic:** Calls GPS `%spawn_bounce_sprite()` with direction and tile.
    - **Params:** `direction` (enum: Up, Down).
    - **Clobbers:** `["A", "X", "Y"]`

16. **`freeze_all_sprites`** (Category: `level`, Slots: `any`)
    - **Description:** Freezes all sprites in place for a set duration (stopwatch / pause effect).
    - **Mechanic:** Sets `$9D` to the given frame count.
    - **Params:** `frames` (number 1..255).
    - **Clobbers:** `["A"]`

17. **`spawn_item_rise`** (Category: `sprites`, Slots: `any`, `once: true`)
    - **Description:** Spawns a standard powerup (Mushroom, Flower, Feather, Star) that emerges upwards from the block.
    - **Mechanic:** Calls `JSL $02887D` (`spawn_item_sprite`).
    - **Params:** `item` (enum: Mushroom, Fire Flower, Star, Feather, 1-Up Mushroom).
    - **Clobbers:** `["A", "X", "Y"]`

### 2.5 Adjacent Block Control
18. **`change_adjacent_block`** (Category: `effects`, Slots: `any`, `once: true`)
    - **Description:** Changes the tile of a neighbor block (above, below, left, or right) to a chosen Map16 tile.
    - **Mechanic:** Temporarily shifts `$98` (Y) or `$9A` (X) by 16 px (or 16 * distance), calls `%change_map16()`, and restores the original coordinate using PHA/PLA.
    - **Params:**
      - `direction` (enum: Above, Below, Left, Right)
      - `distance` (enum: 1 block [16px], 2 blocks [32px], 3 blocks [48px], 4 blocks [64px])
      - `tile` (map16, default $0025)
    - **Clobbers:** `["A", "X"]`

19. **`erase_adjacent_block`** (Category: `effects`, Slots: `any`, `once: true`)
    - **Description:** Erases a neighbor block (above, below, left, or right), turning it into air ($025).
    - **Mechanic:** Shifts `$98` / `$9A`, calls `%erase_block()`, and restores coordinates using PHA/PLA.
    - **Params:**
      - `direction` (enum: Above, Below, Left, Right)
      - `distance` (enum: 1 block [16px], 2 blocks [32px], 3 blocks [48px], 4 blocks [64px])
    - **Clobbers:** `["A", "X"]`

---

## 3. New Conditions — Technical Specification

### 3.1 Movement & Precision
18. **`c_really_on_top`** (Category: `conditions`, Slots: `mario`)
    - **Description:** True only when Mario is truly standing on top of the block (filters out grazing edges and falling past).
    - **Mechanic:** Checks `$7D >= 0` (falling/landing) and `($98 & $FFF0) - $1C >= $96` (vertical tolerance within top 4px).
    - **Params:** none.
    - **Clobbers:** `["A"]`

19. **`c_mario_speed`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Tests Mario's speed or movement direction.
    - **Mechanic:** Evaluates `$7B` (horizontal) or `$7D` (vertical).
    - **Params:** `axis` (enum: Horizontal, Vertical), `check` (enum: Falling [Y>=0], Rising [Y<0], Moving Left [X<0], Moving Right [X>0], Fast [abs >= val]), `threshold` (number 0..127).
    - **Clobbers:** `["A"]`

20. **`c_p_meter`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Tests if Mario is at full run speed (P-meter full, $13E4 == $70) or running.
    - **Mechanic:** Compares `$13E4|!addr` against threshold (default 112 / $70).
    - **Params:** `mode` (enum: Full P-Speed, Greater or equal threshold), `value` (number 0..112).
    - **Clobbers:** `["A"]`

### 3.2 Inventory & Character
21. **`c_holding_sprite_id`** (Category: `conditions`, Slots: `mario`)
    - **Description:** True if Mario is currently carrying a SPECIFIC sprite (vanilla or custom) such as a Key, P-Switch, or Shell.
    - **Mechanic:** Checks `$1470`/`$148F`, inspects carried sprite slot (`!14C8,x == $0B`), compares `!9E,x` or `!7FAB9E,x`. (Uses tool routine `bc_holding_sprite`).
    - **Params:** `sprite_number` (sprite), `custom` (bool).
    - **Clobbers:** `["A", "X"]`
    - **Routines:** `["bc_holding_sprite"]`

22. **`c_invulnerable`** (Category: `conditions`, Slots: `mario`)
    - **Description:** True if Mario is flashing with damage invulnerability frames ($1497 != 0).
    - **Mechanic:** Tests `$1497|!addr`.
    - **Params:** `is_flashing` (bool, default true).
    - **Clobbers:** `["A"]`

23. **`c_player_character`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Tests whether the active player is Mario or Luigi ($0DB3).
    - **Mechanic:** Compares `$0DB3|!addr` (0 = Mario, 1 = Luigi).
    - **Params:** `character` (enum: Mario, Luigi).
    - **Clobbers:** `["A"]`

### 3.3 Yoshi State
24. **`c_yoshi_color`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Tests Yoshi's color while Mario is riding Yoshi.
    - **Mechanic:** Verifies `$187A != 0` and compares `$13C7|!addr` (0=Green, 1=Yellow, 2=Blue, 3=Red).
    - **Params:** `color` (enum: Green, Yellow, Blue, Red).
    - **Clobbers:** `["A"]`

25. **`c_yoshi_mouth`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Tests if Yoshi currently has an item or sprite in his mouth ($18AC != 0).
    - **Mechanic:** Checks `$187A != 0` and `$18AC|!addr != 0`.
    - **Params:** `has_item` (bool, default true).
    - **Clobbers:** `["A"]`

### 3.4 Sprite Slot Conditions
26. **`c_sprite_facing`** (Category: `conditions`, Slots: `sprite`)
    - **Description:** Tests which way the touching sprite is facing (!157C,x).
    - **Mechanic:** Compares `!157C,x` (0 = Right, 1 = Left).
    - **Params:** `facing` (enum: Right, Left).
    - **Clobbers:** `["A"]`

27. **`c_sprite_in_air`** (Category: `conditions`, Slots: `sprite`)
    - **Description:** Tests if touching sprite is on the ground or in mid-air (!1588,x bit 2).
    - **Mechanic:** `LDA !1588,x : AND #$04`.
    - **Params:** `airborne` (bool).
    - **Clobbers:** `["A"]`

28. **`c_sprite_speed`** (Category: `conditions`, Slots: `sprite`)
    - **Description:** Tests touching sprite's speed components (!B6,x / !AA,x).
    - **Mechanic:** Tests `!B6,x` or `!AA,x`.
    - **Params:** `axis` (enum: X, Y), `check` (enum: Positive, Negative, Moving).
    - **Clobbers:** `["A"]`

### 3.5 Progress & Environment
29. **`c_dragon_coins`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Compares collected Dragon Coins in the current level ($1420).
    - **Mechanic:** Compares `$1420|!addr` against threshold (0..5).
    - **Params:** `comparison` (enum: Equal, Greater or equal, Less than), `amount` (number 0..5).
    - **Clobbers:** `["A"]`

30. **`c_sublevel`** (Category: `conditions`, Slots: `any`)
    - **Description:** Checks current sublevel number ($010B).
    - **Mechanic:** 16-bit compare `REP #$20 : LDA $010B|!addr : CMP #sublevel`.
    - **Params:** `sublevel` (number hex 0x000-0x1FF).
    - **Clobbers:** `["A"]`

31. **`c_bonus_stars`** (Category: `conditions`, Slots: `mario`)
    - **Description:** Compares goal bonus star counter ($0F48).
    - **Mechanic:** Compares `$0F48|!addr` (0..100).
    - **Params:** `comparison` (enum: Equal, Greater or equal, Less than), `amount` (number 0..100).
    - **Clobbers:** `["A"]`

32. **`c_adjacent_tile`** (Category: `conditions`, Slots: `any`)
    - **Description:** Checks the Map16 tile of a neighbor block (above, below, left, right).
    - **Mechanic:** Temporarily shifts `$98` / `$9A`, calls `%get_map16()` to inspect 16-bit tile, restores original coordinates with PHA/PLA, and jumps to `{{false}}` if comparison fails.
    - **Params:**
      - `direction` (enum: Above, Below, Left, Right)
      - `distance` (enum: 1 block [16px], 2 blocks [32px])
      - `comparison` (enum: Equal, Not Equal)
      - `tile` (map16, default $0025)
    - **Clobbers:** `["A", "X", "Y"]`

---

## 4. Implementation Plan & Milestones

### Phase 1: High-Impact Essentials & Adjacent Blocks (Top Priority)
- **`change_adjacent_block`** (Change neighbor tile above/below/left/right)
- **`erase_adjacent_block`** (Erase neighbor block to air)
- **`c_adjacent_tile`** (Check neighbor tile)
- **`teleport`** (Warp to screen exit / sublevel)
- **`set_item_box`** / **`drop_item_box`**
- **`c_really_on_top`** (Strict top check from spec)
- **`c_p_meter`** (P-Speed check)
- **`c_holding_sprite_id`** (Specific sprite check with `bc_holding_sprite`)
- **`save_block_collected`** (Item Memory persistence)

### Phase 2: Player Control & Physics
- **`set_mario_speed`** (Direct speed / momentum halt)
- **`set_mario_facing`** / **`set_spinjump`** / **`force_drop_item`**
- **`c_mario_speed`** (Speed & trajectory checks)
- **`c_invulnerable`** (I-frame check)
- **`c_player_character`** (Mario vs Luigi)

### Phase 3: Yoshi & Sprite Domain
- **`dismount_yoshi`** / **`c_yoshi_color`** / **`c_yoshi_mouth`**
- **`quake_sprites_on_top`** / **`bounce_block`**
- **`c_sprite_facing`** / **`c_sprite_in_air`** / **`c_sprite_speed`**

### Phase 4: Progression & Polish
- **`show_message`** / **`trigger_keyhole`** / **`give_lives`** / **`give_score_points`**
- **`c_dragon_coins`** / **`c_sublevel`** / **`c_bonus_stars`**

---

## 5. Acceptance Criteria ("Done when")
- Each new Piece directory contains valid `piece.json` matching `piece.schema.json` and a correct `code.asm` template.
- Any new routine (`bc_holding_sprite.asm`) is created in `library/routines/` and tested.
- `core/library/seed.test.ts` lists all new pieces in its test array and passes.
- `npm test` runs with 100% pass rate.
- `npm run check:asar` successfully assembles every new piece in all allowed slots with its default parameters.
- All pieces are searchable and categorized properly in the Blockly toolbox.

---

## 6. Notes
- **Muncher (from `hurt_death.asm` and the author's `kill.asm`)**: the side edge test is done, as the `side_hitbox` option of Hurt / Kill Mario (ticket 12). What is left for a full muncher is the top edge, which only hurts while Mario falls onto it (`LDA $7D : BPL`), optionally not while riding Yoshi (`c_really_on_top`, `c_yoshi`), and the wall-run offsets (`marioWallFeet` / `marioWallBody`).

## 7. Progress

**Phase 1 is in (2026-09-19)**, with `c_mario_speed` from Phase 2 (a muncher on the ceiling needs "Mario moves up"): `change_adjacent_block`, `erase_adjacent_block`, `c_adjacent_tile`, `teleport`, `set_item_box`, `drop_item_box`, `c_really_on_top`, `c_mario_speed`, `c_p_meter`, `c_holding_sprite_id` (with the routine `library/routines/bc_holding_sprite.asm`), `save_block_collected`. Every option of every choice is assembled with the GPS project's Asar (`npm run check:asar`), and the routine is assembled the way GPS wraps it into a macro.

How they differ from the spec above, after checking the addresses against the RAM map, the disassembly and the GPS routines:
- The neighbour Pieces offer 1 to 4 blocks in all three. They save `$98` and `$9A` as 16 bits and restore both (`%change_map16()` swaps their high bytes in vertical levels). `c_adjacent_tile` compares in 16-bit A, as `%get_map16()` returns the tile there, and restores the position before the branch, keeping the flags with PHP / PLP.
- `teleport`: "Exit of this screen" is `%teleport_direct()` with X = 0 (the vanilla exit table of the screen Mario is on), not `$71 = $0D` by hand. A sublevel is `%teleport_direct()` with X < 0 and the level number in A (instant) or `%teleport()` (the vertical pipe animation).
- `drop_item_box` calls the game's own release, `JSL $028008` (SMWDisX `CODE_028008`, the routine Select and power-down use) with data bank 02 as they do; it plays the sound, spawns the falling item and does nothing on an empty box.
- `set_item_box` and `c_item_box` use the RAM map values: 1 Mushroom, 2 Fire Flower, **3 Star, 4 Feather**. `c_item_box` had 3 and 4 swapped and is fixed.
- `c_really_on_top` is the test of `donut_lift.asm`: Y speed not upward and `($98 & $FFF0) - $1C >= $96`. `$96` is Mario's Y, 32 pixels above his feet.

Open: the routine `bc_holding_sprite` has to be in the GPS project's `routines` folder; until ticket 11 copies it on "Save to GPS project…" it is copied by hand. Phase 2 without `c_mario_speed`, Phase 3 and Phase 4 are not started.
