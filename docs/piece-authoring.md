# Writing Pieces

A **Piece** is one building block of the editor: an **Action** (does something when a Slot fires: act as a tile, hurt Mario, spawn a sprite) or a **Condition** (a yes/no test for `if`: is Mario ducking, is the ON/OFF switch ON). A Piece is a folder with two files, a JSON manifest and an ASM template. It contains no program logic of its own, so a Piece someone else wrote cannot run code on your machine. This guide is enough to write one without reading the source of BlockCreator; the vocabulary is in [CONTEXT.md](../CONTEXT.md) and the reasons in [ADR 3](adr/0003-declarative-pieces.md).

Where a Piece goes: the built-in Library is the `library/` folder of this repository, bundled into the app. A user Library (a folder with the same layout, whose Pieces win over built-in ones with the same `id`) is planned in ticket 16 and is not loaded by the app yet. Until then a new Piece goes into `library/actions/` or `library/conditions/` and is tried with `npm run tauri dev`.

Contents: [folder layout](#folder-layout) · [manifest](#the-manifest) · [parameters](#parameters) · [template](#the-template) · [what the code runs as](#what-the-code-runs-as) · [Conditions](#conditions) · [registers](#registers-and-clobbers) · [labels](#labels) · [SA-1](#sa-1) · [one-shot Actions](#one-shot-actions) · [routines](#routines) · [versions and credits](#versions-and-credits) · [checking a Piece](#checking-a-piece) · [worked example](#worked-example) · [checklist](#checklist)

## Folder layout

```
library/
  actions/<id>/piece.json      an Action: the manifest ...
  actions/<id>/code.asm        ... and its template
  conditions/<id>/piece.json   a Condition
  conditions/<id>/code.asm
  routines/bc_<name>.asm       code several Pieces share (see Routines)
  presets/<name>.asm           ready-made Blocks (see "New from preset")
```

The folder name is the Piece's `id`, and an Action lives in `actions/`, a Condition in `conditions/`. A Piece with an error (not valid JSON, a field that breaks the schema, a template that does not render) is left out and reported as a Library error; the other Pieces still load. An Action and a Condition cannot share an `id`.

## The manifest

`piece.json` says what the Piece is called, where it can go and what it needs. The schema is [core/library/piece.schema.json](../core/library/piece.schema.json); point `$schema` at it (a relative path is fine) and an editor completes and checks the fields as you type.

| Field | Meaning |
| --- | --- |
| `id` (required) | Lower-case letters, digits and `_`, starting with a letter, and the same as the folder name. Conditions are named `c_…` by convention. |
| `version` (required) | Whole number from 1. See [versions](#versions-and-credits). |
| `kind` (required) | `action` or `condition`, matching the folder. |
| `category` (required) | Where the toolbox files it, and its colour. The known ones are `conditions`, `physics`, `damage`, `effects`, `sound`, `sprites`, `level` and `advanced`; any other id (lower-case letters, digits, `_`) becomes a category of its own after those, named from the id (`my_pieces` is "My pieces"). |
| `name` (required) | What the block says, and what the search finds first. |
| `description` (required, may be empty) | The block's tooltip, and searched too. Say what it does and cite the RAM it touches (see [checking](#checking-a-piece)). |
| `author` (required) | Who wrote the Piece. |
| `credits` | Where the idea or the code came from, if it is not yours. It is written into the header of every Block that uses the Piece: `Credits (<name>): <credits>`. |
| `icon` | Reserved. Pieces have no icons in v1; the category colour is all there is. |
| `slots` (required) | Who touches the Block where this Piece works: `mario`, `sprite`, or `any`. The toolbox only offers the Piece in Slots of that kind, and a Block that uses it in the wrong kind is refused. |
| `params` (required) | The values the user fills in, see [parameters](#parameters). May be empty. |
| `once` | `true` for an Action that should happen once, see [one-shot Actions](#one-shot-actions). Default `false`. |
| `removesBlock` | `true` for an Action that replaces or erases this block. Default `false`. |
| `clobbers` (required) | The registers the code destroys: `A`, `X`, `Y`, see [registers](#registers-and-clobbers). May be empty. |
| `routines` | The tool routines the code calls, see [routines](#routines). Default none. |

### The Slots

A Block has one Slot per kind of contact. `slots` (`mario`, `sprite`, `any`) decides which of these a Piece may be in, and `{{slot}}` (see the [template](#the-template)) tells the template which one it is rendered for.

| In the editor | Id | GPS offset |
| --- | --- | --- |
| Mario: Top | `marioTop` | MarioAbove |
| Mario: Bottom | `marioBottom` | MarioBelow |
| Mario: Left, Right | `marioLeft`, `marioRight` | MarioSide, told apart at run time |
| Mario: Inside | `marioInside` | BodyInside and HeadInside |
| Mario: Top corner | `marioTopCorner` | TopCorner (does what Top does while empty) |
| Mario: Head inside, Body inside | `marioHeadInside`, `marioBodyInside` | HeadInside, BodyInside |
| Mario: Cape, Fireball | `marioCape`, `marioFireball` | MarioCape, MarioFireball |
| Mario: Wall-run feet, body | `marioWallFeet`, `marioWallBody` | WallFeet, WallBody (a Block with one of these gets the `db $37` header) |
| Sprite: Top, Bottom | `spriteTop`, `spriteBottom` | SpriteV |
| Sprite: Left, Right | `spriteLeft`, `spriteRight` | SpriteH |

## Parameters

Each entry of `params` is one row of the block. The user's value reaches the template under the parameter's `name`.

| Field | Meaning |
| --- | --- |
| `name` (required) | What the template calls it: letters, digits and `_`, not starting with a digit, unique in the Piece, and not one of the [reserved words](#the-template). |
| `label` (required) | The row's label in the editor. |
| `type` (required) | One of the types below. |
| `default` (required) | The value a new block starts with; must fit the type. A Block that leaves a parameter out gets the default. |
| `min`, `max` | For `number`: the range, both required. |
| `format` | For `number`: `hex` or `dec`, how the editor shows it. |
| `options` | For `enum`, required: a list of `{ "value": …, "label": … }`. Each `value` is a number or a string, and `default` is one of them. |
| `listParam` | For `sprite` and `sound`: the name of another parameter that decides which names are listed. |
| `showWhen` | Hides the row while another parameter has another value: `{ "param": "custom", "equals": true }`. |

| Type | Value | In the template |
| --- | --- | --- |
| `number` | A whole number from `min` to `max`. | `{{name}}` (decimal), `{{hex name 2}}`, `{{signed name}}` for a negative one. |
| `enum` | One of the `options`. | `{{#if name "value"}}`; a number is compared as its decimal text. |
| `bool` | true or false. | `{{#if name}}`. |
| `map16` | A Map16 number, 0 to 65535, typed as hex. | `{{hex name 4}}`, or `{{lo name}}` and `{{hi name}}`. |
| `sprite` | A sprite number, 0 to 255, searchable by name. | `{{hex name 2}}` |
| `sound` | A sound number, 0 to 255, searchable by name. | `{{hex name 2}}` |
| `text` | One line of text. | `{{name}}`, verbatim. |
| `multiline` | Several lines of text (Custom ASM is one). | `{{name}}`, verbatim. |

The Slot list shows every Piece in a Slot as one line made from the manifest: the `name`, then the values. A Piece with one or two parameters says all of them (`Act as 130`, `Controller button Up, Pressed (this frame)`); one with more says only the ones that are not the default, with their `label` in front (`Boost Mario (horizontal push Left, X strength 16)`), and a `bool` only when it was switched from its default. So name a Condition so that it reads after `if` (`ON/OFF switch is` + `ON`), keep option labels short and self-explanatory, and put a range in brackets at the end of a label (`X strength (0..127)`): the summary leaves it out.
`listParam` on a `sprite` names a `bool` parameter: while it is on, the names are the PIXI custom sprites of the project, otherwise the vanilla ones. On a `sound` it names an `enum` that holds the sound port. The names are only labels: every number from 00 to FF stays selectable.

`showWhen` has two fields: `param` names another parameter, and `equals` is a value that parameter can have (`true` or `false` for a `bool`, one of the `options` for an `enum`). The row is hidden while the other parameter has another value, but the hidden parameter keeps its value and **the template still gets it**, so the template must not depend on the row being visible. Use it for options that only apply to one setting of another parameter.

## The template

`code.asm` is 65816 assembly (Asar) with `{{…}}` placeholders in a small Mustache-style language. It has no JavaScript and cannot do anything but choose text.

| Tag | Result |
| --- | --- |
| `{{name}}` | A number as decimal, text as it is. An error for a `bool`; use `{{#if name}}`. |
| `{{hex name}}`, `{{hex name 4}}` | `$`-prefixed upper-case hex, with an even number of digits (at least 2), or the number of digits given (1 to 8). An error if the value does not fit. |
| `{{signed name}}` | -128 to 127 as a byte: -16 is `$F0`. |
| `{{lo name}}`, `{{hi name}}` | The low and the high byte of a 16-bit value (`$30` and `$01` for 304). |
| `{{ram name}}` | A RAM address the way SA-1 needs it, see [SA-1](#sa-1). |
| `{{slot}}` | The id of the Slot the Piece is rendered for, `marioTop` … `spriteRight`. |
| `{{label "skip"}}` | A label of this use of the Piece, see [labels](#labels). |
| `{{false}}` | Conditions only: where to jump when the Condition is false. |
| `{{#if name}}…{{else}}…{{/if}}` | The first part when the value is true, a number other than 0, or text that is not empty; else the second. The `{{else}}` may be left out. |
| `{{#if name "a" "b"}}…{{/if}}` | The first part when the value is `a` or `b` (or any other value listed), compared as text. |
| `{{#each name}}…{{this}}…{{/each}}` | Repeats for each item of a list. No parameter type is a list, so a Piece cannot use it yet. |

A line that holds nothing but a block tag (`{{#if …}}`, `{{else}}`, `{{/if}}`, `{{#each …}}`, `{{/each}}`) is removed with its indentation, so the tags can stand on their own lines without leaving blank lines in the ASM. Negative numbers work in ASM as usual: `LDA #-{{hex strength 2}}` is `LDA #-$30`.

`this`, `false`, `label`, `slot`, `hex`, `signed`, `lo`, `hi` and `ram` are reserved: a parameter cannot have one of these names.

`{{slot}}` is for Pieces whose code depends on the side that is touched ("away from the block"): `{{#if slot "marioTop" "marioTopCorner"}}`. It is the Slot whose code is written, so in code that other Slots are linked to it is the Slot they are linked to.

The whole template is checked when the Library loads: the structure, every name in every branch (also the ones that would not be rendered), and then one rendering with the default values. Errors say which line.

## What the code runs as

The code of every Piece in a Slot is put one after the other into the section of a GPS block, and the Block's `RTL` comes after the last one. So:

- **On entry** `A`, `X` and `Y` are 8 bit, and `A` holds nothing you can use. In the sprite Slots `X` is the slot of the touching sprite; in the `marioFireball` Slot it is the slot of the fireball; in the other Mario Slots it means nothing. `Y` is the high byte of the act-as value ($1693 is the low byte), which is why it has to survive unless the Piece sets act as. `$98` (Y) and `$9A` (X) are 16-bit positions: in the sprite Slots the generator has already called `%sprite_block_position()`, so they are the block's own; in the Mario Slots they are the collision point being processed, which lies inside the block (`$98` with its low four bits cleared is the top edge of the block).
- **On exit** the code just falls through to the next Piece, or the end. It never ends in `RTL`, `RTS` or a `JMP` out of its own labels. If you switch `A`, `X` or `Y` to 16 bit with `REP`, switch back with `SEP` before the code ends. There is no `org` and no data; a Piece is code only.
- **Every frame, for every contact point.** The Slot's code runs every frame something touches the block, once per touching point, so a Piece that must happen once needs [`once`](#one-shot-actions).
- **Scratch RAM** is `$00`-`$0F`. GPS routines use it freely, so do not keep a value there across a `%routine()` call. A Piece that moves `$98`-`$9B` (the neighbour Pieces do) must put them back.
- **GPS routines** are called as `%name()` (`%erase_block()`, `%give_points()`, …), any file of the GPS project's `routines` folder. Many expect 8-bit registers; a few want 16-bit `A` or `X` first (`%teleport()`, `%change_map16()`): the reference is the routine's own comment.

## Conditions

A Condition tests something and **falls through when it is true and jumps to `{{false}}` when it is false**. Set the flags, branch on them, and stop:

```asm
LDA $187A|!addr    ; riding Yoshi?
BEQ {{false}}      ; no: the Condition is false
```

That is all a Condition has to do. The generator wires it into `if` / `else if` / `else`, into AND, OR and NOT, and into long jumps; the Piece does not know what is around it and must not `RTL` or jump anywhere else. It may use `{{false}}` more than once. `{{false}}` is an error in an Action.

If the Condition destroys `X` or `Y` that must survive, it lists them in `clobbers`: the generator restores them on both ways out, the true one and the false one.

## Registers and `clobbers`

List in `clobbers` every register the code destroys as a side effect: `A`, `X`, `Y`. The generator then keeps the ones that matter around the Piece: **`Y` is saved and restored in every Slot** where the Piece lists it (it is the act-as high byte), **`X` only in the sprite Slots and the Fireball Slot**, where it is a slot index. `A` is scratch and never saved: no Piece may rely on `A` staying as another Piece left it.

A Piece that sets `Y` on purpose (Act as) does not list it, or the generator would undo it. A Piece that calls a routine which destroys `X` or `Y` lists that register.

## Labels

Write a label as `{{label "skip"}}`, and define it with a colon:

```asm
BEQ {{label "skip"}}
STZ $1411|!addr
{{label "skip"}}:
```

Inside one use of the Piece the same name is the same label; every use gets its own labels (`bc12_skip`), so two copies of a Piece in one Block do not collide, and so do Pieces of different authors. A label name starts with a letter and has letters, digits and `_`. Do not use `.sublabels` or hand-written global labels, and no `{{label}}` inside `{{#each}}` (it would repeat).

## Long branches

`BEQ`, `BNE` and friends reach 128 bytes back and 127 forward. The generator adds up the sizes of the code and rewrites a branch that might not reach (to `{{false}}` or to a `{{label}}`) as the opposite branch around a `JMP`; you write short branches. Two things help it: `db` and the like are counted, and `$xx`, `$xxxx|!addr` and `JSL` are known sizes. Code it cannot size (an assembler directive such as `rep`, `if` or `org`) makes every branch that crosses it a long one. That is correct, only longer.

## SA-1

All code must work on LoROM/FastROM and on SA-1, which moves the RAM. Write it as GPS does:

- Direct page (`$00`-`$FF`): as it is, `LDA $19`.
- Absolute RAM (`$0100`-`$1FFF`): with `|!addr`, `STA $1497|!addr`.
- A ROM routine: `JSL $00F5B7|!bank`.
- Sprite tables: the defines, `LDA !14C8,x`, `!E4,x`, `!AA,x`; the extra bits and the custom sprite number are `!7FAB10,x` and `!7FAB9E,x`; the number of sprite slots is `!sprite_slots`. Never `$14C8,x`. `!9E,x` holds the number a custom sprite *acts like*, so a test for a vanilla sprite must also check that bit 3 of `!7FAB10,x` is clear (`LDA !7FAB10,x : AND #$08 : BNE {{false}}`), or a custom sprite that acts like it passes too.
- A RAM address the **user** types: `{{ram address}}`, which writes `$85` for a direct page address, `$0F44|!addr` for the rest of `$0000`-`$1FFF` (`$7E0F44` gives the same), and any other address as 24 bits, as typed.
- Free RAM in `$7E`/`$7F` is not portable; SA-1 has it in `$40`/`$41`. A Piece with a fixed free RAM address says so in its description.

The generated code is assembled with the real `asar.dll` of your GPS project (`Check`, and before every save), so a mistake shows up there, but only the assembler's kind: a wrong RAM address or a missing `|!addr` on SA-1 assembles fine.

## One-shot Actions

An Action that should happen once (a sound, a coin, a spawned sprite, a level change) runs again every frame the block is touched. Flag it `"once": true`. The editor then warns unless the same branch also has an Action with `"removesBlock": true`, one that replaces or erases **this** block (Erase block, Shatter, Change to tile): once the block is gone the Action cannot run again. An Action that changes another block (the neighbour Pieces) is not `removesBlock`.

## Routines

Code that several Pieces share, or that is too long to repeat in every copy, goes into a **tool routine**: `library/routines/bc_<name>.asm` (lower-case letters, digits and `_`, always starting with `bc_`, so it cannot clash with a routine of the project). A Piece calls it as `%bc_<name>()` and lists the name in `routines`:

```json
"routines": ["bc_holding_sprite"]
```

GPS turns every file of its `routines` folder into a macro named after the file, so the file is the body of a macro: no `main:`, `?local` labels (`?loop:`), the registers and the result described in a comment at the top, and it ends with `RTL`. The Pieces that call it list the registers it destroys in their `clobbers`.

A Block that needs a routine says so in its header ("Needs GPS routines: …"). "Save to GPS project…" copies the missing ones into the project's `routines` folder after asking, and never overwrites a different file of the same name without saying so; "Save as…" tells you which files to copy.

## Versions and credits

Raise `version` whenever the code a Piece generates, or what its parameters mean, changes: a fix, a new parameter that changes what the defaults do, a renamed or removed parameter. Do not raise it for a new label or description. A Block remembers the version of every Piece it was made with, and is always generated with the current template. When such a Block is opened, its older Pieces are brought up to date: a value for a parameter the Piece no longer has is dropped, a value that no longer fits (out of range, an option that is gone) becomes the default, and a new parameter gets its default. A notice names each Piece with its old and new version and the values that were lost, and saving writes the newer versions. So keep parameter names stable, and add a new parameter with a default that keeps the old behaviour; a renamed parameter loses the user's value.

`credits` is for the rare Piece that is adapted from someone else's resource; Pieces are otherwise written from the RAM map and GPS's own routines, not copied.

## Checking a Piece

- **The facts.** Look every RAM address up in the RAM map (SMWCentral) or the disassembly, not from memory; the first pass over the built-in Library found ten Pieces that read, wrote or named the wrong thing. Cite each fixed address the code touches in the `description` or a label (`$1490`, `$0F31-$0F33`, `!14C8`). For Pieces of the `level`, `conditions` and `advanced` categories `descriptions.test.ts` checks it.
- **Loading.** `npm test` loads the built-in Library and fails on any error in it: the schema, the folder name, the defaults, the template with its defaults.
- **The code it makes.** Test what a Piece renders with the parameters you care about: `core/library/level.test.ts` is the pattern (render the template with values, compare the ASM).
- **Assembling.** `npm run check:asar` assembles every Piece in every Slot it allows, and every option of a choice, with the Asar of the GPS project (a `GPS` folder next to this repository, or `BLOCKCREATOR_GPS`). Add your Piece to the list in `core/assemble/asar.integration.test.ts` if it has options the defaults do not show.
- **In the app.** Put the block into a Slot and press `Check`.
- **In the game.** Nothing replaces trying it in an emulator (ticket 19); say in the description what you did not try.

## Worked example

Goal: a Condition "Mario is on Yoshi and ducking". These files are in [examples/piece-authoring](examples/piece-authoring), a folder that loads as a Library, and are checked by `core/library/authoring.test.ts`.

**1. Kind and name.** It is a yes/no test, so a Condition, and it goes in `conditions/`. The id is `c_yoshi_ducking`, so the folder is `conditions/c_yoshi_ducking/`.

**2. The facts.** Riding Yoshi is `$187A` (0 no, 1 yes, 2 yes while he turns around), so "not 0" is riding. Ducking is `$73` (0 no, 4 yes, any other value counts). Both are in the RAM map, both are one byte, and both are absolute addresses, so `$187A|!addr`, while `$73` is direct page and needs nothing.

**3. The manifest.** One parameter, a `bool`, so the same Piece also tests for "on Yoshi and *not* ducking". `A` is loaded, so `clobbers` is `["A"]`. Mario only, `slots` is `mario`.

```json file=conditions/c_yoshi_ducking/piece.json
{
  "$schema": "../../../../../core/library/piece.schema.json",
  "id": "c_yoshi_ducking",
  "version": 1,
  "kind": "condition",
  "category": "conditions",
  "name": "Mario is on Yoshi and ducking",
  "description": "True while Mario rides Yoshi ($187A) and is ducking ($73). Turn Ducking off to test for riding Yoshi without ducking.",
  "author": "Your Name",
  "slots": "mario",
  "params": [
    {
      "name": "ducking",
      "label": "Ducking",
      "type": "bool",
      "default": true
    }
  ],
  "clobbers": ["A"]
}
```

**4. The template.** A Condition falls through when true and jumps to `{{false}}` when false. First: not riding Yoshi, so false. Then load `$73`: for "ducking" a zero means false (`BEQ`), for "not ducking" a non-zero means false (`BNE`).

```asm file=conditions/c_yoshi_ducking/code.asm
LDA $187A|!addr
BEQ {{false}}
LDA $73
{{#if ducking}}
BEQ {{false}}
{{else}}
BNE {{false}}
{{/if}}
```

**5. Try it.** Copy the folder into `library/conditions/`, run `npm test` (the Library must still load without errors) and `npm run check:asar`, then `npm run tauri dev`: the Piece is in the toolbox under Conditions, in a Mario Slot only. Used in `if` with Act as, Top Slot, it generates

```asm
	LDA $187A|!addr
	BEQ bc1_end
	LDA $73
	BEQ bc1_end
	LDY #$00
	LDA #$25
	STA $1693|!addr
bc1_end:
```

where `bc1_end` is the label the generator made for the end of the `if`.

## Checklist

- [ ] The folder is `actions/<id>/` or `conditions/<id>/`, and `id` is the folder's name; `kind` matches.
- [ ] `slots` is right; `clobbers` lists what the code destroys; `once` and `removesBlock` are set for one-shot Actions.
- [ ] Every parameter has a `default` that fits its type; a Condition jumps to `{{false}}` when false and never ends with `RTL`.
- [ ] Addresses are looked up, SA-1 safe (`|!addr`, `|!bank`, sprite defines, `{{ram}}`), and cited in the `description`.
- [ ] Labels are `{{label "…"}}`; 16-bit `REP` is followed by `SEP`.
- [ ] `npm test` and `npm run check:asar` pass.
