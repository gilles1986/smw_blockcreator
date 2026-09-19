# Name lists: vanilla sprites and sounds, PIXI custom sprites

Status: done
Blocked by: 10
Spec: ../spec.md

Ship vanilla sprite names (00-C8) and sound names per port (verified IDs). With a project open, read PIXI `list.txt` and offer custom sprites by file name (custom flag set automatically).

**Done when**
- Sprite / sound parameter dropdowns show names; custom sprites appear after opening the Rooms-For-A-Friend project.

**Idea from the author (2026-09-19)**
- A settings icon in the sidebar's bottom bar (next to the info icon) opens a dialog where the Lunar Magic / PIXI project folder is set (a home for the GPS folder as well, see ticket 10). The sprites are read from there, and a sprite parameter shows the sprite's name so it is clear which sprite it is.
- Started with ticket 10: the Settings dialog exists and holds the GPS and the PIXI folder (`getFolder('pixiFolder')` in `ui/settings.ts`; `pixi_folder_ok` checks for `pixi.exe` and `list.txt`).

**Result (2026-09-19)**
- Data: `core/names` has the vanilla sprite names 00–C8 (read from the sprite initialisation table comments of the disassembly, `bank_01.asm`; the numbers run without a gap) and the sound names of `$1DF9`, `$1DFA` and `$1DFC` (from the SMWCentral RAM map's value lists; the special values `80+`, `35+`, `FF` are left out). Music (`$1DFB`) has no list yet; the "Change music" Piece is ticket 12.
- PIXI: `core/pixi` reads the `SPRITE:` section of a `list.txt` (the lines before the first section count too) and names each sprite after its file; other sections and per-level lines (`<level>:<number> <file>`) are ignored. Tests use a copy of the real list. The desktop app reads the file through `pixi_read_list` and hands the sprites to `ui/names.ts` at the start and after the Settings dialog closes; open blocks show the new names at once.
- Manifests: a `sprite` or `sound` parameter may name a `listParam`, the other parameter of the Piece that decides which names apply: a `bool` for a sprite (custom on = the PIXI list), an `enum` for a sound (the port). The loader checks it. `change_sprite`, `c_sprite_id`, `spawn_sprite` (its sprite number was a plain hex `number` before) and `play_sound` use it.
- Editor: `ui/blockly/nameField.ts` is a dropdown that offers every number 00–FF, the named ones first ("04 · Green Koopa"), so any number a Block holds still loads and numbers without a name can still be picked. The stored value is the same two hex digits as before.
- Follow-up: the name field opens a search dropdown (`ui/blockly/namePicker.ts`) instead of Blockly's plain menu: type a name to filter, or a number (`DA`, `$DA`, `0xDA`, `4` = 04) and press Enter; arrow keys, click and Escape work too. `core/names` `filterChoices` / `typedNumber` do the matching. The Koopa shells DA–DD (Lunar Magic's level sprite numbers; the game loads `n` as sprite `n−DA+4` in status 09, bank_02.asm) are named "Green/Red/Blue/Yellow Koopa shell" in the vanilla list (`LEVEL_SHELLS`). `DF` ("Green shell, won't use special world graphic", named as Lunar Magic shows it) is sprite `09` in status 09, a shell that takes two bounces before it is stunned and that the Special World colour swap leaves alone; the Pieces used to map it to `04` and now map it to `09` (`spawn_sprite`, `change_sprite`, `c_sprite_id`), with a test that keeps names and templates in step. The other level numbers above C8 (shooters C9–CA, generators CB–D9, `DE` = 5 Eeries, `E0` = 3 platforms on a chain, scroll sprites from E7) are not named: the Pieces cannot spawn them.
- Differs from the plan: the custom flag is not set automatically. The list switches with the existing "Custom (PIXI) sprite" checkbox instead (one list per kind of sprite, since a vanilla and a custom sprite can share a number). Not tried by hand in the app yet: how wide long names make a block, and the separator in the dropdown.
