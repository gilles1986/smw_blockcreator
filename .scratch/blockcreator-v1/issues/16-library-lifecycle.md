# User Library, missing/outdated Pieces, placeholders

Status: open
Blocked by: 06, 03
Spec: ../spec.md

Settings: user Library path. Opening a Block with a missing Piece shows a greyed placeholder with its params and blocks saving; an outdated Piece version shows a notice with old -> new before regenerating.

**Done when**
- Tests with fixture Libraries for missing and newer Pieces; the UI shows both states.

**Notes from 05 (editor tracer)**
- Unknown `piece_*` blocks are currently dropped by `workspaceToStatements`; placeholders need a block type for "missing Piece" that keeps its params, and the adapter must carry them into the model.
