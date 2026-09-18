# Piece manifest schema + Library loader with three seed Pieces

Status: open
Blocked by: 02
Spec: ../spec.md

JSON Schema for `piece.json`; loader that reads a Library folder (actions/, conditions/, routines/, presets/), validates, and resolves Pieces by id; merge built-in + user Library (user wins on same id). Seed Pieces: `act_as`, `hurt_mario`, `c_onoff`.

**Done when**
- Invalid manifests produce readable errors naming file and field.
- Override test: a user Piece with the same id replaces the built-in one.
- Seed Pieces load and render through the template engine.

**Notes from 02 (template engine review)**
- Param names `this`, `false`, `label`, `hex`, `signed`, `lo`, `hi` are reserved in templates; the manifest schema should reject them.
- `render()` only checks param names against the params it is given. To report template errors per Piece at load time, render each template once with the manifest defaults (and a dummy false-target for Conditions), or add a `parse`/`check` export to `core/template` if that proves insufficient.
- `{{param}}` always renders numbers as decimal; manifest `format hex|dec` is treated as a UI input/display hint only. Templates use `{{hex param}}` where hex output matters.
