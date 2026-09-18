# 1. The Block model lives as JSON in the generated `.asm` header

## Status
Accepted (2026-09-18)

## Context
Users must be able to re-open a generated block in the tool. Parsing arbitrary 65816 ASM back into Slots, Conditions and Actions is fragile, and a separate project file next to the `.asm` gets lost when blocks are shared on their own.

## Decision
Every generated `.asm` starts with a comment header holding the full Block model as JSON (Piece ids, versions, parameter values, Block properties) plus a checksum of the generated code. The tool reads only the header; the code below it is always regenerated. A checksum mismatch means hand edits and triggers a warning before overwriting. Hand-written code belongs in a Custom ASM Action, i.e. inside the model.

## Consequences
- One file is the whole Block; sharing an `.asm` shares an editable Block.
- The header format is a public contract: it needs a version field and migrations from day one.
- Hand edits outside Custom ASM are not preserved.
