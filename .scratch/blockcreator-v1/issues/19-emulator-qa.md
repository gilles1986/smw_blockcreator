# HITL: verify generated Blocks in an emulator

Status: open
Blocked by: 18
Spec: ../spec.md

Human in the loop: insert all presets into a test project via GPS and check them in an emulator. Resolve the research's open points: WallFeet vs. WallBody, X in MarioCape, sound IDs, `1F0` behaviour, spawned custom sprites with extra bytes. Record findings in `docs/research/` and fix Pieces / generator.

**Done when**
- The user signs off a checklist per preset; research open points are closed or re-scoped.

**Notes from 07 (all Slots)**
- Confirm `$93`: 0 = Mario touches the block from its left (corrected from the research doc via disassembly `CODE_00EB77`). Test with `core/generator/golden/side_split.asm` (solid from the left, air from the right).
- WallFeet vs WallBody mapping is still unverified (research doc, open question 1).
