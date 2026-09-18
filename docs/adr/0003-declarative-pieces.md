# 3. Pieces are declarative: manifest plus Mustache-style ASM template

## Status
Accepted (2026-09-18)

## Context
The Library is meant to be extended by the community. Pieces need parameters and small variations, and they must compose safely (registers, labels, branch distances).

## Decision
A Piece is a folder with a JSON manifest (id, version, author, category, parameters, allowed Slots, `once`, `clobbers`, required `routines`, optional `icon`, optional `credits`) and an `.asm` template using Mustache-style placeholders with minimal logic. Pieces contain no executable JavaScript. The generator owns label uniqueness, register save/restore, AND/OR/NOT wiring and long branches; a Condition only jumps to `{{false}}` or falls through.

## Consequences
- Installing someone else's Piece cannot run code on the user's machine.
- Anything the template language cannot express has to be solved in the generator or with a Custom ASM Action.
- The manifest schema and authoring contract are public and need versioning.
