# Open project + Save to project + `list.txt` entry with Map16 picker

Status: open
Blocked by: 06
Spec: ../spec.md

Project open (romhack or GPS folder; detect `gps.exe` + `list.txt`; recent projects). Save to `blocks/blockcreator/` (configurable). Optional `list.txt` entry `<map16>:<default act-as> <path>`: page selector + dropdown of the numbers on that page with the occupying file or "free"; update an existing entry for the same file; insert before `@dsc`; write `list.txt.bak` first. After saving: hint to run GPS / Callisto Update. `core/listtxt` preserves every other line byte for byte.

**Done when**
- `listtxt` tests on a fixture copied from `Rooms-For-A-Friend/tools/GPS/list.txt` (ranges, rectangles, comments, `@dsc`).
- Saving twice with the same file updates the entry instead of duplicating it.

**Notes from 09 (Asar validation)**
- `ui/tauriAsar.ts` asks for the GPS folder (folder dialog) the first time a check runs, also before a save, and remembers it in local storage. With a project open, give `gpsAsar` the project's GPS folder instead and drop the dialog; ask only when no project is open.
- Save and Save as… check first and go through `saveVerdict` in `ui/checkView.ts` (Asar errors block; a check that cannot run saves with a note). "Save to project…" should use the same verdict.
