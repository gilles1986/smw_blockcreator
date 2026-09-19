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
