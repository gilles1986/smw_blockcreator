# Open project + Save to project + `list.txt` entry with Map16 picker

Status: in progress
Blocked by: 06
Spec: ../spec.md

Project open (romhack or GPS folder; detect `gps.exe` + `list.txt`; recent projects). Save to `blocks/blockcreator/` (configurable). Optional `list.txt` entry `<map16>:<default act-as> <path>`: page selector + dropdown of the numbers on that page with the occupying file or "free"; update an existing entry for the same file; insert before `@dsc`; write `list.txt.bak` first. After saving: hint to run GPS / Callisto Update. `core/listtxt` preserves every other line byte for byte.

**Done when**
- `listtxt` tests on a fixture copied from `Rooms-For-A-Friend/tools/GPS/list.txt` (ranges, rectangles, comments, `@dsc`).
- Saving twice with the same file updates the entry instead of duplicating it.

**Progress (2026-09-19)**
- Done: `core/listtxt` (`parseList`, `occupancy`, `entryOf`, `withBlockEntry`) with tests on a copy of the real GPS `list.txt` (ranges, `R` rectangles, comments, `@dsc`, CRLF); saving twice updates the entry. `ui/projectSave.ts` writes the Block to `blocks/blockcreator/<name>.asm`, works out the list first (a tile another file holds stops the save before anything is written), asks before replacing a hand-edited or foreign file, and writes `list.txt.bak` before `list.txt`. Rust: `project_read` / `project_write` (paths relative to the GPS folder, only `list.txt`, `list.txt.bak`, `blocks/…`, `routines/…`). UI: a Settings dialog (GPS and PIXI folder, remembered in local storage; the Asar check uses the same GPS folder) and a "Save to GPS project…" dialog (Map16 page, tile list showing the occupying file or "free", acts like, optional list entry) that goes through the same Asar verdict as Save. The hint to run GPS / Callisto's Update is in the notice after saving.
- Not done: "open project" as a concept (romhack folder, `gps.exe` detection, recent projects: only the GPS folder is set, in Settings), the configurable target folder (`BLOCK_FOLDER` in `ui/projectSave.ts` is a constant), copying routines (ticket 11). The dialogs have not been tried by hand yet.

**Notes from 09 (Asar validation)**
- `ui/tauriAsar.ts` asks for the GPS folder (folder dialog) the first time a check runs, also before a save, and remembers it in local storage. With a project open, give `gpsAsar` the project's GPS folder instead and drop the dialog; ask only when no project is open.
- Save and Save as… check first and go through `saveVerdict` in `ui/checkView.ts` (Asar errors block; a check that cannot run saves with a note). "Save to project…" should use the same verdict.
