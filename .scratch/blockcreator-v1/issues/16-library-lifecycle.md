# User Library, missing/outdated Pieces, placeholders

Status: open
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
