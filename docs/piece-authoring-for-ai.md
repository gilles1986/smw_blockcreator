# Writing Pieces with an AI

This is the brief for an AI assistant (a chat AI or a coding agent) that is asked to write a new BlockCreator **Piece**, an Action or a Condition. It says what to get from the user, what to look up, what to decide, what the code must obey and what to hand back. It is short on purpose: [piece-authoring.md](piece-authoring.md) is the full reference (every manifest field, parameter type and template tag) and this brief assumes you have it. A chat AI cannot read the repository, so give it three files: this one, `docs/piece-authoring.md` and `core/library/piece.schema.json`. The words Block, Slot and Piece are explained in [CONTEXT.md](../CONTEXT.md). The zip a user downloads has this file, the guide, the schema and the built-in Library next to the program, and an `AGENTS.md` that says where the user's Pieces are: an AI tool opened in that folder starts from there.

## The job

A Piece is a folder of two files: `piece.json` (the manifest: name, where it may go, the values the user fills in, what it destroys) and `code.asm` (65816 assembly for Asar with `{{…}}` placeholders). The generator puts the code of all Pieces of a Slot one after the other into a GPS block and adds everything around it: the header, the jump table, the side checks, the `if` / `else` wiring, the long branches and the final `RTL`. A Piece is only the part in the middle. It has no header, no `RTL`, no data and no logic beyond choosing text.

## 1. What you need from the user

Ask for what the last column says to ask for. For the rest, propose a value and say that you did.

| Need                                                                                        | Why                                                            | If missing                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| What it does, in a sentence or two of Super Mario World terms ("Mario is ducking", "add coins") | Everything follows from it                                     | Ask                                                              |
| An Action (does something) or a Condition (a yes/no test for `if`)                          | Decides the folder, the `id` and the shape of the code         | Ask. A yes/no question is a Condition                            |
| Who touches the block: Mario, sprites or both                                               | `slots` is `mario`, `sprite` or `any`; the toolbox follows it  | Ask                                                              |
| What the user should be able to change, and its range                                       | These are the `params`                                         | Propose a few, each with a sensible default                      |
| For an Action: once, or is every frame fine?                                                | `once` and `removesBlock`, see [the flags](#3-decide)          | Decide from the effect                                           |
| The author's name                                                                           | `author` is required and must not be empty                     | Ask                                                              |
| A GPS routine to call                                                                       | `%name()` only works if the file is in the GPS `routines` folder | Never invent a routine name; use one whose file you have read    |

## 2. Look up the facts, do not recall them

The first pass over the built-in Library found ten Pieces that read, wrote or named the wrong thing. So every address, every meaning of a value and every register a routine destroys is looked up:

- RAM addresses and what their values mean: the SMWCentral RAM map (<https://www.smwcentral.net/?p=memorymap&game=smw&region=ram>) or the SMW disassembly (SMWDisX).
- Sprite table defines, `!sprite_slots` and the like: `defines.asm` in the user's GPS folder.
- GPS routines: the routine's own file in the GPS `routines` folder. Its comment at the top says which registers it needs and destroys.
- A tool for Super Mario World knowledge (a RAM map, a disassembly, an MCP server), if you have one.

Then say what you found in the manifest's `description`, and cite every fixed address the code touches (`$1490`, `!14C8`). What you could not verify goes into your notes to the user, not into the Piece as if it were true.

Look at what exists before you write anything. The built-in Library is the `library/actions/` and `library/conditions/` folders. The generic `write_ram`, `c_ram` and `custom_asm` cover one-off needs; a new Piece is worth it when it has a good name, useful parameters or will be used often. Read the two or three Pieces closest to yours for the house style: `give_coins` (a small Action, below), `boost_mario` (an Action with several `enum` parameters), `c_button` (a Condition with `enum` parameters) and `c_yoshi_ducking` in the [worked example](piece-authoring.md#worked-example).

## 3. Decide

1. **Folder and `id`.** `actions/<id>/` or `conditions/<id>/`. The `id` is lower-case letters, digits and `_`, starts with a letter and is the folder's name. Conditions start with `c_`. An Action and a Condition cannot share an `id`, and a user Piece with the id of a built-in one replaces it, which is almost never what the user wants.
2. **`category`.** `conditions` for a Condition, otherwise `physics`, `damage`, `effects`, `sound`, `sprites`, `level` or `advanced`. Any other id makes a new category.
3. **`slots`.** `mario` if the code reads or writes Mario (`$7B`, `$19`, …), `sprite` if it uses the touching sprite's slot in `X`, `any` if it does not matter who touches the block (a level flag, a sound). Mario RAM means nothing in a sprite Slot.
4. **`params`.** Few. Each has a `name` (letters, digits, `_`; not a [reserved word](piece-authoring.md#the-template)), a `label`, a `type`, a `default` that fits the type and, as the type asks, `min` and `max` or `options`. Put a range in brackets at the end of a label (`Strength (0..127)`), keep option labels short, and name a Condition so that it reads after "if" (`ON/OFF switch is` + `ON`): the Slot list shows every Piece as one line made from the `name` and the values.
5. **The flags.** They are easy to get wrong and not obvious to the user, so decide them on purpose:

| Flag                          | Ask yourself                                                                                                                       | Then                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `once` (Actions)              | A Slot's code runs every frame the block is touched, about 60 times a second. Would that be a bug? A sound, coins, a life, a spawned sprite, a message, a level change would. | `"once": true`. The editor warns the user unless the same branch also removes or changes the block. A push or a held effect stays `false`.                                                                                                                                       |
| `removesBlock` (Actions)      | Does the Action erase or replace **this** block, like Erase block, Shatter or Change to tile?                                      | `"removesBlock": true`, and `"once": true` as well, as the built-in ones have it. An Action that changes a neighbouring block is not `removesBlock`.                                                                                                                             |
| `clobbers` (required, may be `[]`) | Which of `A`, `X`, `Y` does the code change as a side effect, also through a `JSL` or a `%routine()`?                          | List them. The generator saves and restores `Y` in every Slot and `X` in the sprite Slots and the Fireball Slot, so a Piece that does not list what it destroys breaks the Pieces after it. `A` is never restored; list it when the code loads it. Do not list `Y` when the Piece sets it on purpose (Act as). |

None of the three changes what the code says: `once` and `removesBlock` only feed a warning, `clobbers` makes the generator save and restore. `give_coins` is `once` and lists all three registers because it calls a ROM routine. `boost_mario` repeats on purpose, so it has no `once`, and it only loads `A`.

6. **`version`** is `1` for a new Piece; **`credits`** only if the code is adapted from someone else's resource, which it should not be.

## 4. Rules for `code.asm`

The code is put into a GPS block, so the rules are those of code that is _pasted in_.

- **Only code.** No `org`, no `db` data, no `main:`, no `RTL`, `RTS` or `JMP` out of the Piece. Fall through at the end.
- **Registers.** On entry `A`, `X` and `Y` are 8 bit and `A` holds nothing you can use. `X` is the touching sprite's slot in the sprite Slots and the fireball's in the Fireball Slot; `Y` is the high byte of the act-as value. After a `REP` switch back with `SEP` before the code ends.
- **A Condition** falls through when true and jumps to `{{false}}` when false: set the flags, `BEQ {{false}}` or `BNE {{false}}`, stop. It may jump there more than once. `{{false}}` is an error in an Action.
- **SA-1.** Direct page as it is (`LDA $19`); absolute RAM with `|!addr` (`STA $1497|!addr`); ROM routines with `|!bank` (`JSL $00F5B7|!bank`); sprite tables through the defines (`LDA !14C8,x`, never `$14C8,x`). A RAM address the user types goes through `{{ram name}}`. A wrong address or a missing `|!addr` still assembles, so nothing but your care catches it.
- **Labels.** `{{label "skip"}}` to use and `{{label "skip"}}:` to define. No `.sublabels`, no labels you name yourself.
- **Parameters** reach the template by name: `{{n}}` or `{{hex n 2}}` for a `number`, `{{signed n}}` for a negative byte, `{{#if flag}}…{{/if}}` for a `bool`, `{{#if mode "held"}}…{{/if}}` for an `enum`, `{{hex tile 4}}` or `{{lo tile}}` / `{{hi tile}}` for a `map16`. `{{name}}` on a `bool` is an error. A parameter hidden by `showWhen` still reaches the template. A line with only a block tag is removed, so put the tags on their own lines.
- **Scratch RAM** is `$00`-`$0F`; a `%routine()` may overwrite it. A Piece that moves `$98`-`$9B` puts them back.
- **Branches.** They only reach 128 bytes back and 127 forward. Write short ones; the generator fixes what does not reach.

A Condition:

```asm
LDA $187A|!addr    ; riding Yoshi?
BEQ {{false}}      ; no: the Condition is false
```

An Action is `give_coins`, complete:

```json file=actions/give_coins/piece.json
{
  "id": "give_coins",
  "version": 1,
  "kind": "action",
  "category": "level",
  "name": "Give coins",
  "description": "Gives coins to Mario and plays the coin sound.",
  "author": "BlockCreator",
  "slots": "any",
  "params": [
    {
      "name": "amount",
      "label": "Coin count (1..99)",
      "type": "number",
      "min": 1,
      "max": 99,
      "default": 1
    }
  ],
  "once": true,
  "clobbers": ["A", "X", "Y"]
}
```

```asm file=actions/give_coins/code.asm
LDA #{{amount}}
JSL $05B329|!bank
```

The built-in Pieces start with `"$schema": "../../../core/library/piece.schema.json"` for the editor's sake; a Piece outside this repository leaves it out.

## 5. Check before you hand it back

Without the repository, go through it by hand: render the template once with the defaults and once for every option of every `enum`; every `{{…}}` name is a parameter; every branch of every `{{#if}}` is valid ASM; every `default` is inside its range or is one of its options; `id` is the folder's name; `kind` matches the folder; `params` and `clobbers` are there even if empty; the [checklist](piece-authoring.md#checklist) is ticked.

With the repository (a coding agent):

```bash
npm test             # loads the whole built-in Library, fails on any error in it
npm run check:asar   # assembles every Piece in every Slot with the GPS project's Asar
```

`check:asar` needs the GPS folder next to the repository or in `BLOCKCREATOR_GPS`. A Piece that goes into the built-in Library is a folder of `library/actions/` or `library/conditions/`, and gets a test in the pattern of `core/library/level.test.ts` (render with the values you care about, compare the ASM). The user's own Pieces are not tested by `npm test`; the app checks them when it loads them.

## 6. Getting the Piece into the app

The user's Pieces live in a `pieces` folder with the layout of the built-in Library. The user chooses where it is (**Pieces → Custom Pieces**, "Your Pieces are kept …"): in the app's data folder (`%APPDATA%\com.saphros.blockcreator\pieces`, the default) or next to `BlockCreator.exe`. **Open Folder** in the same dialog opens the one in use. There are three ways in:

1. **Zip.** Put the files in a zip as `actions/<id>/piece.json` and `actions/<id>/code.asm` (or `conditions/…`), nothing else, then **Custom Pieces → Import (.zip)**. The Piece is there at once.
2. **Copy the folder** into the `pieces` folder (`actions/<id>/…`) and restart the app: it reads the folder at the start.
3. **The Piece maker** (**Custom Pieces → + New Piece**): fill the form from `piece.json` and paste `code.asm` into the ASM template.

A Piece with a mistake is left out and the app says so ("Your Pieces: 1 problem, first: `<file>`: `<message>`"). Ask the user to paste that message back, and fix what it names.

## 7. What you hand back

1. `piece.json` and `code.asm`, each in a code block headed with its path (`actions/<id>/piece.json`).
2. The ASM the Piece makes with its default values.
3. Where each address and routine fact came from, and what you could not verify.
4. The flags you chose, in one line each, with the reason.
5. What was not tried in an emulator, which is always something: nothing replaces trying it in the game.

## Mistakes that come up

- A Condition that ends with `RTL`, jumps somewhere else, or never jumps to `{{false}}`.
- `$14C8,x` instead of `!14C8,x`, or a missing `|!addr` on an absolute address.
- A `default` outside `min` and `max`, or an `enum` whose `default` is not one of the option values (a number and its text are different values).
- `{{name}}` on a `bool`, or a name in a template that is not a parameter.
- A sound, coins, a life or a spawn without `once`; `removesBlock` on an Action that changes another block.
- A missing `clobbers`, `params` or `description` (all required; `[]` and `""` are fine), or an empty `author`.
- Reading `$00`-`$0F` after a `%routine()` call, or leaving `A`, `X` or `Y` in 16 bit.
- A changed template for an existing Piece without raising its `version`.
- An address from memory, cited as a fact.
