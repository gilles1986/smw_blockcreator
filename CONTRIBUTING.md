# Contributing to BlockCreator

Thank you for your interest in contributing to BlockCreator! Whether you want to add new Pieces (Actions/Conditions) to the built-in Library, fix a bug, or improve documentation, your help is welcome.

---

## 🧩 Adding New Pieces to the Library

The built-in Library (`library/actions/` and `library/conditions/`) contains reusable building blocks for SMW block creation.

If you have designed a useful Piece or port of a classic block behavior:
1. **Read the Authoring Guides:**
   - [docs/piece-authoring.md](docs/piece-authoring.md) — The comprehensive authoring specification.
   - [docs/piece-authoring-for-ai.md](docs/piece-authoring-for-ai.md) — If you are drafting Pieces with the help of an AI assistant.
2. **Follow the Piece Guidelines:**
   - **SA-1 Compatibility:** All ASM code must be SA-1 compatible (use `|!addr` and standard GPS defines).
   - **Clobbers:** Accurately declare which registers (`A`, `X`, `Y`) the piece changes in its `piece.json`.
   - **Flags:** Set `"once": true` for actions that should not run repeatedly every frame unless the block is destroyed.
   - **RAM Documentation:** Cite verified SMW RAM addresses in the manifest's `description`.
3. **Test Your Piece:**
   - Place the Piece in `library/actions/<id>/` or `library/conditions/<id>/`.
   - Verify it loads cleanly without schema errors: `npm run tauri dev` or `npm test`.

---

## 🛠️ Code Contributions

### Development Setup

1. Clone your fork of the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development environment:
   - **Desktop (Tauri):** `npm run tauri dev`
   - **Web frontend:** `npm run dev`

### Quality Checks

Before submitting a pull request, ensure all tests and linters pass:

```bash
# Type check all packages
npm run typecheck

# Run unit and integration tests
npm test

# Check code formatting and linting
npm run lint
npm run format:check
```

---

## 🐛 Reporting Issues & Feature Requests

- **Bug Reports:** Open an issue describing the bug, what steps reproduce it, and the generated `.asm` or block state if applicable.
- **Piece Proposals:** If you'd like to see a specific Action or Condition in the Library, describe the desired SMW behavior, what RAM addresses it affects, and which interaction Slots it belongs in.
