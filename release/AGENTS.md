# BlockCreator: notes for an AI assistant

This folder is BlockCreator, a visual editor for Super Mario World custom blocks (GPS). The user will most likely ask you to write a **Piece**: a building block, an Action or a Condition, that the editor offers. This file says where things are and how to work here.

## What is where

| Path                                       | What it is                                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/piece-authoring-for-ai.md`           | **Your brief. Read it first** and follow it.                                                                                                                                      |
| `docs/piece-authoring.md`                  | The full reference: manifest fields, parameter types, template tags, the rules for the code.                                                                                      |
| `core/library/piece.schema.json`           | The schema of `piece.json`.                                                                                                                                                       |
| `library/actions/`, `library/conditions/`  | The built-in Pieces: real examples of the house style. Read the ones closest to what you write. **Read only**: the program has its own copy, so a change here does nothing.      |
| `library/routines/`                        | Shared routines (`bc_*.asm`) that some Pieces call.                                                                                                                               |
| `docs/examples/piece-authoring/`           | A worked example, explained in `docs/piece-authoring.md`.                                                                                                                         |
| `CONTEXT.md`, `docs/adr/`                  | The vocabulary, and the reasons behind the design.                                                                                                                                |
| `pieces/`                                  | **The user's own Pieces, if they keep them next to the program.** New Pieces go here. It may not exist yet.                                                                        |

The user chooses where their Pieces are kept (BlockCreator: Pieces menu, Custom Pieces, "Your Pieces are kept …"):

- next to the program: the `pieces/` folder beside this file, or
- in the app data folder: `%APPDATA%\com.saphros.blockcreator\pieces`. This is the default.

If `pieces/` is not here and you do not know which the user uses, ask, or hand over the files as a zip (below).

## How to work

1. Read `docs/piece-authoring-for-ai.md`. It says what to ask the user, what to look up and what the two files must contain.
2. Write the Piece as two files: `pieces/actions/<id>/piece.json` and `pieces/actions/<id>/code.asm` (`conditions` instead of `actions` for a Condition). Nothing else goes into `pieces/`.
3. Check it by hand, as the brief says for the case without the repository. There are no build or test commands in this folder.
4. Tell the user how to load it: restart BlockCreator (it reads `pieces/` at the start), or pack the two files into a zip, with the paths `actions/<id>/piece.json` and `actions/<id>/code.asm` inside it, and use **Custom Pieces → Import (.zip)**.
5. When BlockCreator finds a mistake it says so ("Your Pieces: 1 problem, first: `<file>`: `<message>`"). The user gives you the message; fix what it names.

## Rules

- Write only inside `pieces/`, or into a zip you hand over. Do not change `BlockCreator.exe`, `library/`, `docs/`, `core/` or this file.
- Look up every RAM address and every routine; do not recall them. Say what you could not verify. Nothing replaces trying the Piece in an emulator, and the user should hear that it was not tried.
- The user's GPS and PIXI folders are not here. A GPS routine your code calls (`%name()`) must exist in the `routines` folder of the user's GPS folder; ask for the file if you need to read it.
- Ask when the effect, the kind (Action or Condition) or who touches the block (Mario, sprites) is unclear.
