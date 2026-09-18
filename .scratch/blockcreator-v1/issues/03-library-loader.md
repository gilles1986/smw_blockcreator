# Piece manifest schema + Library loader with three seed Pieces

Status: open
Blocked by: 02
Spec: ../spec.md

JSON Schema for `piece.json`; loader that reads a Library folder (actions/, conditions/, routines/, presets/), validates, and resolves Pieces by id; merge built-in + user Library (user wins on same id). Seed Pieces: `act_as`, `hurt_mario`, `c_onoff`.

**Done when**
- Invalid manifests produce readable errors naming file and field.
- Override test: a user Piece with the same id replaces the built-in one.
- Seed Pieces load and render through the template engine.
