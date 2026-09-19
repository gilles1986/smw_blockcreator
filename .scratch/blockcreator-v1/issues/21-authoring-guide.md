# Piece authoring guide + published manifest schema

Status: done
Blocked by: 08, 03
Spec: ../spec.md

`docs/piece-authoring.md`: folder layout, manifest fields, template syntax, Condition contract (`{{false}}`), `clobbers`, labels, SA-1 rules, `once` / `removesBlock`, routines, versioning, credits. Worked example building a new Piece.

**Done when**
- Following the guide, a new Piece (e.g. "Mario is on Yoshi and ducking") can be added without reading source code.

**Notes from 08 (condition logic)**
- Document for Piece authors: branches to `{{false}}` and `{{label}}` targets may be rewritten to inverted branch + `JMP` when far; code the generator cannot size (assembler directives such as `rep`, `if`, `org`) makes every branch across it long. `db` strings count their length. `$xx|!dp` and `$xxxx|!addr` count 3 bytes, `|!bank` 4.
- Registers: list in `clobbers` what the Piece destroys as a side effect; Y is saved/restored around the Piece, X only in Sprite and Fireball Slots. A Piece that sets Y on purpose (act-as) must not list it.

**Notes from 15 (name lists)**
- Document listParam on sprite / sound parameters: the other parameter of the Piece that picks the names shown (a `bool` for sprites, custom on = the PIXI list; an `enum` for sounds, the port). Every number 00-FF stays selectable, names are only labels.
- `once`: one-shot Actions (sounds, coins, spawns, level changes) run again every frame the block is touched. The editor warns when the branch has no `removesBlock` Piece; a Piece that replaces or erases this block sets `"removesBlock": true`, one that changes another block does not.
- `showWhen`: a parameter can be hidden in the editor while another parameter of the Piece does not have a value, `"showWhen": { "param": "custom", "equals": true }`. The hidden parameter keeps its value and the template still gets it, so a template must not depend on the row being visible; use it for options that only apply to one setting of another parameter.

**Notes from 14 (level Pieces)**
- `{{ram name}}`: a template helper for a RAM address that stays valid on SA-1 (`$85`, `$0F44|!addr`; `$7E0F44` is the same as `$0F44`; any address outside `$0000-$1FFF` is written as typed, 24 bits). Use it whenever the address is a parameter; fixed addresses are written `$xxxx|!addr` by hand.
- Cite every fixed RAM address the code touches in the description or a label of the Piece (`$1490`, `$0F31-$0F33`, `!14C8`); `descriptions.test.ts` checks it for the `level`, `conditions` and `advanced` categories. Address in the RAM map (SMWCentral) or the disassembly, not from memory: the first pass over the Library (ticket 14) found ten Pieces that read, wrote or named the wrong thing.
- Raise `version` whenever the generated code changes, not for a new label or description.
- Sprite numbers: `!9E` holds the number a custom sprite acts like, so a vanilla sprite test must also check that bit 3 of `!7FAB10` is clear.

**Notes from 12 (the Slot in templates)**
- `{{slot}}` is the id of the Slot the Piece is rendered for (`marioTop` … `spriteRight`), for Pieces whose code depends on the side: `{{#if slot "marioTop" "marioTopCorner"}}`. It is the Slot whose code is written, so it is the Slot other Slots are linked to. It is reserved: a parameter cannot be called `slot`. `{{#if name "a" "b"}}` is true when `name` is any of the values.
- Negative immediates in templates: `LDA #-{{hex strength 2}}` is fine, Asar takes `#-$30`.

**Result (2026-09-19)**
- `docs/piece-authoring.md`: folder layout, the manifest and the Slot ids, parameters and their types, the template language, what the code runs as (entry and exit state, every frame, scratch RAM, GPS routines), Conditions, `clobbers`, labels, long branches, SA-1, one-shot Actions, routines, versions and credits, how to check a Piece, a worked example and a checklist. All the notes above are in it.
- The worked example ("Mario is on Yoshi and ducking", `c_yoshi_ducking`) is a real Library folder, `docs/examples/piece-authoring/`, and the guide shows its two files. `core/library/authoring.test.ts` loads it as a user Library next to the built-in one, checks what it renders and generates, that the guide shows its files and the generated code exactly, and that the guide names every manifest field, parameter type, Slot id, reserved word and template tag (it caught a gap while it was written); `npm run check:asar` assembles it in every Mario Slot, both ways.
- The manifest schema stays at `core/library/piece.schema.json`; the guide tells authors to point `$schema` at it. Publishing it at a URL waits for the repository going public.
- The guide says the truth about where a Piece goes: the built-in `library/` folder. A user Library folder is not loaded by the app until ticket 16.