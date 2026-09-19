# User Library, missing/outdated Pieces, placeholders

Status: in progress
Blocked by: 06, 03
Spec: ../spec.md

Settings: user Library path. Opening a Block with a missing Piece shows a greyed placeholder with its params and blocks saving; an outdated Piece version shows a notice with old -> new before regenerating.

**Done when**
- Tests with fixture Libraries for missing and newer Pieces; the UI shows both states.

**Notes from 05 (editor tracer)**
- Unknown `piece_*` blocks are currently dropped by `workspaceToStatements`; placeholders need a block type for "missing Piece" that keeps its params, and the adapter must carry them into the model.

**Notes from 06 (open/save)**
- Opening currently refuses Blocks with unknown Pieces, wrong kinds or invalid values (`checkPieces` in `core/model/check.ts`, used by `openBlock`). Replace the refusal for missing Pieces with placeholders here.
- The recorded Piece version survives opening: `statementsToWorkspace` stores it in Blockly's per-block `data`, and `workspaceToStatements` reads it back (new toolbox blocks get the Library version). Compare it with `manifest.version` for the "newer Piece" notice.

**Notes from 12 (Boost Mario, Push sprite)**
- Version 2 of `boost_mario` and `push_sprite` renamed their parameters (`change_x` / `x_speed` became `x_direction` / `x_strength`, and the same for Y). A Block saved with version 1 still opens, but its values are not carried over: it generates the defaults (up by 96 / 64). The "newer Piece" notice should name this kind of change (old -> new version) before regenerating; there is no migration.

**Result (2026-09-19): missing and newer Pieces**
- **Missing Pieces** open as grey placeholders. `openBlock` no longer refuses a Piece the Library lacks (`checkPieces(…, { allowMissing: true })`); everything else that is wrong with a Block (a Piece of the wrong kind or in the wrong Slot, a value that does not fit) still refuses it. In the editor the Piece is a grey block ("Missing Piece", its id, its values on one line), an Action or a Condition as it was used, that keeps the whole use in the block's data (`ui/blockly/blocks.ts`, `workspace.ts`), so the Block re-opens and regenerates as it was once the Piece is back. Saving is blocked (`workspaceProblems`: "Piece 'x' is not in the Library."); a placeholder for a Piece that has come into the Library since says to open the Block again. Removing the block is the way out.
- **Older Pieces** are brought up to the Library's version when a Block is opened (`upgradePieces` in `core/model/versions.ts`): a value for a parameter the Piece no longer has is dropped, one that no longer fits becomes the default, a new parameter gets its default. The notice after opening (`ui/openNotice.ts`) names each Piece with its old and new version and what was lost (`Boost Mario 1 → 2 (values gone: change_x, x_speed)`, the case from ticket 12), says saving writes the newer versions, and warns about Pieces that are newer in the file than in this Library ("Saving drops what this version does not know"), and about hand edits.
- Tests: fixture Libraries for an older and a newer Piece and for a missing one (`core/model/versions.test.ts`, `check.test.ts`, `ui/blockDocument.test.ts`), the placeholders in the adapter (`ui/blockly/placeholder.test.ts`) and in headless Blockly (`placeholder.blockly.test.ts`), the notice texts (`ui/openNotice.test.ts`).
- **Not done here: the user Library folder.** The rest of this ticket ("Settings: user Library path") was being built at the same time in another change that is not part of this one (`core/library/archive.ts`, `src-tauri/src/userlibrary.rs`, `ui/userLibrary.ts`, the merge in `App.tsx`: a folder in the app's data dir, zip import and export). It should settle whether the path is configurable. Then this ticket can be closed: check that a Block opened before a Piece was added shows its placeholders and re-opens with the Piece.
- Try in the app: open a Block that uses a Piece you do not have (delete a Piece folder from `library/`, or edit the id in the `;bc-model` line): grey block, notice, Save refused; delete the block, save works. Open a Block made before the Boost Mario rework: the notice names Boost Mario 1 → 2.
