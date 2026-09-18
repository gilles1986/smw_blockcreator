# Save as / Open with header round-trip and hand-edit detection

Status: open
Blocked by: 05
Spec: ../spec.md

`core/header.parse`; Save as... and Open via Tauri dialogs; round-trip the model through the file. Checksum mismatch -> warning before overwrite. Non-BlockCreator file -> clear message.

**Done when**
- Property test: random valid models survive generate -> parse unchanged.
- Hand-editing a saved file and re-opening shows the warning; saving again requires confirmation.
