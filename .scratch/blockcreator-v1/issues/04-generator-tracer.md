# Block model + generator tracer bullet (Mario Top/Bottom/Inside, if/else)

Status: done
Blocked by: 03
Spec: ../spec.md

Block model types (versioned) and `generate(model, library)`: machine header (`;@bc-format`, `;@bc-model`, `;@bc-checksum`), human header, `db $42` jump table, sections for MarioAbove / MarioBelow / BodyInside / HeadInside, empty offsets as `RTL`, `print` description. Statements: Actions and `if / else if / else` with single Conditions. Returns `{ text, lineMap }` (line -> Slot + Piece instance).

**Done when**
- Golden test: ON/OFF block (Top: if ON act as 130 else act as 025) matches the expected file.
- Output is deterministic (same input -> identical text and checksum).

**Notes from 03 (library loader)**
- `act_as` sets Y on purpose (act-as high byte) and therefore does not list Y in `clobbers`. The generator must not restore Y around it; `clobbers` means "destroyed as a side effect", not "written".
- Pieces carry `dir` and `origin`; the Library is a plain `Map` by id — compare `manifest.version` with the model's recorded version directly (ticket 16).
