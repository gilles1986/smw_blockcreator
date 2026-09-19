# Slot summaries, copy / Copy to..., search, Block properties

Status: done
Blocked by: 07
Spec: ../spec.md

One-line summaries per Slot row (`core/summary`), hover "copy" and a "Copy to..." dialog (same character only, overwrite hint), Piece search as the top toolbox category, Block properties (name, description, author, default act-as) in the sidebar.

**Done when**
- Summaries match the prototype's wording for the preset blocks.

**Notes from 05 (editor tracer)**
- A minimal `PropertiesForm` (name, description, author, default act-as) exists in `ui/App.tsx`; polish and validate it here. Top-level stacks in a Slot run top to bottom by canvas position (`workspaceToStatements`) — consider showing that order or warning about several stacks.

**Notes from 07 (all Slots)**
- The "Top corner = Top" switch currently lives in the editor header (shown while Top corner is selected and empty); the sidebar row only shows a read-only "= Top" tag. The spec wants the link in the sidebar.

**Notes from 14 (level Pieces)**
- The ranking is done: `searchPieces(library, query, { slotKind })` in `core/library/search.ts` (tested by `search.test.ts`). What is left here is the search box in the editor header and the "Search" category at the top of the toolbox that shows its result; pass the kind of the selected Slot as `slotKind`.

**Result (2026-09-19)**
- **Summaries:** `core/summary` (`summarizeStatements`, `summarizeCondition`, `summarizePiece`) writes each Slot's logic as one line from the Pieces' manifests, no extra field: the name, then the values (a Piece with one or two parameters says them all, `Act as 130`; one with more says only what differs from the default, with the labels, `Boost Mario (horizontal push Left, X strength 16)`; a parameter the block hides says nothing; sprites are named as the list names them). Actions are joined with `·`, an `if` reads `if X: … else if Y: … else: …` with `—` for an empty part, and AND / OR / NOT as `(X and Y)`, `not X`. The Slot rows show it (cut off with `…`, the whole text as tooltip); a linked Slot still says `= Top`. `summary.test.ts` has the wording for the Presets (`if ON/OFF switch is ON: Act as 130 else: Act as 025`, `Give coins 1 · Change to tile 132`, …).
- **Copy:** a filled Slot row has a copy button (⧉): "Copy to …" lists the Slots of the same kind that do not already use this logic, and says "replaces what is there" for a filled one. `copySlot` (`ui/slotOps.ts`) copies what the Slot uses (also when it is linked), makes a linked target its own again, and leaves Slots that follow the target following it.
- **Search:** the box at the right of the editor header fills a first toolbox category "Search: N found" with `searchPieces` (only what the Slot takes), and opens it. `toolbox(library, kind, query)`.
- **Properties:** the sidebar says what is wrong under the field: an empty name, characters a Windows file name cannot have (and what they become), a dot at the end; an act as that is not hex or above FFFF (`ui/properties.ts`). The form is remounted for each opened Block, so the act as field no longer keeps the text of the Block before.
- **Stacks:** the first block of every stack after the first in a Slot gets a warning icon (a Slot runs all its stacks, top to bottom) (`ui/stackWarnings.ts`).
- **Top corner:** the "= Top" switch is in the Slot list (an empty corner does what Top does), no longer in the editor header.
- Not tried by hand: the layout of the new buttons, the switch and the search box (`ui/app.css`), and how the toolbox behaves while typing a search. Try: fill some Slots, look at the rows; copy Top to Bottom (and onto the Slot on show); type "boost" in the search box; type a name like `a/b` and an act as of `xyz`; drag a second stack into a Slot.
