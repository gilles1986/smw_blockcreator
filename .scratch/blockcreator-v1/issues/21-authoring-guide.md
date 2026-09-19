# Piece authoring guide + published manifest schema

Status: open
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
