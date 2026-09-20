# BlockCreator — Context

A visual editor for Super Mario World custom blocks (GPS). Users compose a block's behaviour from reusable pieces; the tool generates GPS `.asm` and can re-open its own output. Distributed as a downloadable community tool.

## Glossary

- **Block** — one GPS custom block (`.asm` file). What the tool edits and generates.
- **Slot** — a place on a Block that can be filled with logic: an interaction such as "Mario from above" or "sprite from the side". Maps to one or more GPS offsets.
- **Action** — something a Block does when a Slot fires: act as a tile, hurt/kill Mario, kill a sprite, spawn smoke, play a sound, … "Act as 130" is an Action.
- **Condition** — a yes/no check used in `if`/`else if`/`else`: ON/OFF state, Mario's powerup, riding Yoshi, … Combinable with AND / OR / NOT.
- **Piece** — umbrella term for an Action or a Condition: one folder in a Library with a JSON manifest and an `.asm` template.
- **Library** — a folder of Pieces (`actions/<id>/`, `conditions/<id>/`). The built-in Library ships with the tool; a user Library (configurable path) overrides built-in Pieces with the same id.
- **Custom ASM** — an Action whose body is hand-written ASM, stored in the Block's model (the escape hatch for anything the library lacks).

_Avoid:_ "State" — it was used for Slots, Conditions and Actions alike.

## Settled decisions

- Logic model: Scratch-style nested `if` / `else if` / `else` stacks per Slot, not a node graph.
- Re-import: the generated `.asm` starts with a comment header holding the full Block model as JSON. The tool reads only that header; code below it is always regenerated. A checksum in the header detects hand edits and triggers a warning before overwriting.
- Audience: public community tool, distributed as a download by the author.
- Stack: Tauri (native shell, small `.exe`, WebView2) + Blockly for the Slot logic editor.
- UI (chosen from prototype variant C, 2026-09-18; to be revisited later): left sidebar with Block properties (name, description, default act-as), then a row per Slot grouped under Mario and Sprite (character image as group header), each row showing a filled dot and a one-line summary of its logic, with "copy" on hover; advanced Slots behind a toggle; save buttons at the bottom. Right: header with the selected Slot's title, Piece search and "Copy to…", then the Blockly editor and the live ASM preview side by side, always visible. Dark theme. Prototype: branch `prototype/ui`.
- Pieces have no icons in v1 (colour per category instead); the manifest reserves an optional `icon` field.
- Asar validation: on demand and automatically before saving; errors map back to Slot and Piece.
- Saving: "Save as…" anywhere, or save directly into the project's GPS folder, optionally writing the `list.txt` entry.
- Block header stores only Piece id, version and parameter values. Newer Piece version → notice before regenerating. Missing Piece → greyed placeholder; saving is blocked until it is replaced or removed.
- Piece templates use Mustache-style placeholders with minimal logic (`{{param}}`, `{{#if}}`, loops). Pieces never contain executable JavaScript. Parameter types: number (hex/dec, range), enum, bool, Map16 tile, sprite number, text.
- **Preset** — a ready-made Block in `library/presets/` used as a starting point ("New from preset…"); presets double as generator test cases.
- Pieces are kept simple and written from the RAM map and GPS's own routines, not copied from other authors' resources. The manifest keeps an optional `credits` field for the rare exception.
- Importing arbitrary (non-BlockCreator) GPS blocks as Custom ASM per Slot is a v2 candidate, not v1.
- **Default act-as** — a Block property (e.g. 130). It is *not* emitted as code: it lives in the header (model JSON plus a human-readable "Insert with act as 130" line) and is written into the `list.txt` entry (`<map16>:<act-as> <file>`). Slots that set no act-as fall back to whatever `list.txt` / Lunar Magic says.
- One-shot Actions (sound, spawn, points, …) are flagged `once` in their manifest; the editor warns when a `once` Action is not followed by something that removes or changes the Block in the same branch. Slot code runs every frame per contact point.
- Piece authoring contract (written out in [docs/piece-authoring.md](docs/piece-authoring.md)): a Condition jumps to `{{false}}` when false and falls through when true; the generator wires AND/OR/NOT and long branches. The manifest's `clobbers` lists registers the Piece destroys and the generator saves/restores them (X = sprite index, Y = act-as high byte). Local labels via `{{label "name"}}`, made unique by the generator. Code must be SA-1 compatible (`|!addr`, `!sprite_*` defines).
- The user's own Pieces are a `pieces` folder, in the app's data folder (the default) or next to `BlockCreator.exe`, which the user chooses in the Custom Pieces window (remembered in the WebView's local storage, like the GPS and PIXI folders). Switching offers to copy the Pieces to an empty new place and never deletes the old ones. The release zip carries a README.txt, an AGENTS.md for AI tools and the guides next to the program (`release/`, made by `build.bat`).
- Tool-provided routines are prefixed `bc_` and live in `library/routines/`; a Piece lists the routines it needs. Saving into a project copies missing routines into `GPS/routines/` after asking, never overwrites silently; "Save as…" lists the files to copy instead.
- Slots in the UI are Block sides, not GPS offsets. Mario: Top, Bottom, Left, Right, Inside; advanced (collapsed): Top corner (linked to Top by default), Head/Body inside separately, Cape, Fireball, Wall-run feet/body. Sprite: Top, Bottom, Left, Right. The generator maps sides onto offsets and inserts the direction checks (`$93` for Mario, speed sign for sprites). Filling a Wall-run Slot switches the header to `db $37`, otherwise `db $42`.
- v1 ships a large, searchable built-in Library (actions incl. level flags such as water/slippery, brightness, screen shake, music, coins, star, timers, end level, scroll lock, powerup, speed boosts, P-switches; conditions incl. ON/OFF, powerup, Yoshi, star, P-switch, spin jump, carrying, holding sprite X, direction, really-on-top, sprite number/state) plus generic **Write RAM** and **RAM check** Pieces for anything else.
- Map16 picker: choose a Map16 page, then a dropdown (like Lunar Magic's Super GFX Bypass list) shows every number on that page with the file occupying it in `list.txt` or "free". No graphics.
- Name lists: vanilla sprite and sound names ship with the tool; with a project open, the PIXI `list.txt` adds custom sprites by file name.
- Block properties: name (= file name), description (header comment + `print "…"` for the Lunar Magic tooltip), author, default act-as; header type is derived from the Slots.
- **Boost Mario**: one push per axis (none, left / right, up / down, or "away from block", derived from the Slot the code is in), each with its own strength (`$00–$7F`); mode set or add. The 8 directions are the two axes together. Writes `$7B` / `$7D`. Springs, note blocks and the like are presets (Blocks), not options of the Piece.
- **Spawn sprite**: vanilla or PIXI custom (extra bit, extra bytes 1–4 for custom); position in/above/below/left/right of the Block or pixel offset (GPS `move_spawn_*`); initial state normal / carryable / kicked / carried; X/Y speed; facing (fixed, like Mario, away from Mario). Recommended states are hinted for vanilla sprites but not enforced.
- **Touching-sprite Actions** (sprite Slots): set sprite speed (set / add / away from block), set sprite state, turn around; plus kill (see Library).
- Emulator test integration is out of scope.
- Pieces come from a survey of the SMWCentral block archive ([docs/research/piece-kandidaten.md](docs/research/piece-kandidaten.md)): the economy (coins, lives, time, bonus stars), progress Conditions (Yoshi coins, events, switch palaces, level flags), the bounce animation, carried items, Yoshi and midway. A Piece works in every Slot when it reads only global state; only Pieces that read the side of the contact (`$93`, `$96`, `$98`) or a sprite table are limited to one kind of Slot. Companion files for a Piece (UberASM code, PIXI sprites) are out of v1; so are Pieces that need per-block or per-level state, which would need a "free RAM" setting first. Pieces are run on a small model of the RAM in tests (`core/testing/mini65816.ts`).
- Repository is private for now, public later; the licence is chosen before publishing.
- Terms, UI and generated code comments are in English. UI strings live in locale files so the community can add translations by dropping in a file; Pieces are English only.
