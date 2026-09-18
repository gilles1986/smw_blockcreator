# Save as / Open with header round-trip and hand-edit detection

Status: done
Blocked by: 05
Spec: ../spec.md

`core/header.parse`; Save as... and Open via Tauri dialogs; round-trip the model through the file. Checksum mismatch -> warning before overwrite. Non-BlockCreator file -> clear message.

**Done when**
- Property test: random valid models survive generate -> parse unchanged.
- Hand-editing a saved file and re-opening shows the warning; saving again requires confirmation.

**Notes from 04 (generator tracer)**
- Put `parse` in `core/header` next to `writeBlockFile`; compare the stored checksum with `bodyChecksum(textBelowLine3)` — it already normalises CRLF and trailing newlines, so a git/editor line-ending conversion is not reported as a hand edit.
- The model JSON from a file is untrusted: validate it (shape of `BlockModel`, `;@bc-format` ≤ `MODEL_FORMAT`) and add the migration hook here; `core/model` has only types and `MODEL_FORMAT` so far.

**Notes from 05 (editor tracer)**
- The UI keeps one Blockly workspace JSON per Slot (`App` state) and derives the model with `workspacesToSlots` (`ui/blockly/workspace.ts`). Opening a file needs the reverse, `statementsToWorkspace`, plus a round-trip test (workspace → model → workspace → model).
- `workspaceToStatements` skips `if` branches without a Condition (and their bodies) and blocks whose Piece is unknown — fine for the live preview, but saving would silently drop them. Block saving (or warn) while such blocks exist.
- `PropertiesForm` keeps the default act-as text in local state; re-sync it when a file is opened (e.g. remount it with a `key` per opened Block).
