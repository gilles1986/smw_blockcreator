# Save as / Open with header round-trip and hand-edit detection

Status: open
Blocked by: 05
Spec: ../spec.md

`core/header.parse`; Save as... and Open via Tauri dialogs; round-trip the model through the file. Checksum mismatch -> warning before overwrite. Non-BlockCreator file -> clear message.

**Done when**
- Property test: random valid models survive generate -> parse unchanged.
- Hand-editing a saved file and re-opening shows the warning; saving again requires confirmation.

**Notes from 04 (generator tracer)**
- Put `parse` in `core/header` next to `writeBlockFile`; compare the stored checksum with `bodyChecksum(textBelowLine3)` — it already normalises CRLF and trailing newlines, so a git/editor line-ending conversion is not reported as a hand edit.
- The model JSON from a file is untrusted: validate it (shape of `BlockModel`, `;@bc-format` ≤ `MODEL_FORMAT`) and add the migration hook here; `core/model` has only types and `MODEL_FORMAT` so far.
