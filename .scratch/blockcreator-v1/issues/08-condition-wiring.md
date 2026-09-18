# Condition logic: AND / OR / NOT, long branches, register saves

Status: open
Blocked by: 04
Spec: ../spec.md

Generator: label rewiring for AND/OR/NOT and nested ifs; branch-range handling (inverted branch + `JMP` when the target is out of range); save/restore per `clobbers` (Y always, X in sprite/fireball Slots); unique labels across Pieces.

**Done when**
- Golden tests for OR, NOT, nested if with else-if, and a branch body over 128 bytes.
- Every test output assembles with Asar once ticket 09 lands.
