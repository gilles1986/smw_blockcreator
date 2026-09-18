# Slot summaries, copy / Copy to..., search, Block properties

Status: open
Blocked by: 07
Spec: ../spec.md

One-line summaries per Slot row (`core/summary`), hover "copy" and a "Copy to..." dialog (same character only, overwrite hint), Piece search as the top toolbox category, Block properties (name, description, author, default act-as) in the sidebar.

**Done when**
- Summaries match the prototype's wording for the preset blocks.

**Notes from 05 (editor tracer)**
- A minimal `PropertiesForm` (name, description, author, default act-as) exists in `ui/App.tsx`; polish and validate it here. Top-level stacks in a Slot run top to bottom by canvas position (`workspaceToStatements`) — consider showing that order or warning about several stacks.

**Notes from 07 (all Slots)**
- The "Top corner = Top" switch currently lives in the editor header (shown while Top corner is selected and empty); the sidebar row only shows a read-only "= Top" tag. The spec wants the link in the sidebar.
