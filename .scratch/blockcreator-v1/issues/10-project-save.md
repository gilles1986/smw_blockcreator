# Open project + Save to project + `list.txt` entry with Map16 picker

Status: open
Blocked by: 06
Spec: ../spec.md

Project open (romhack or GPS folder; detect `gps.exe` + `list.txt`; recent projects). Save to `blocks/blockcreator/` (configurable). Optional `list.txt` entry `<map16>:<default act-as> <path>`: page selector + dropdown of the numbers on that page with the occupying file or "free"; update an existing entry for the same file; insert before `@dsc`; write `list.txt.bak` first. After saving: hint to run GPS / Callisto Update. `core/listtxt` preserves every other line byte for byte.

**Done when**
- `listtxt` tests on a fixture copied from `Rooms-For-A-Friend/tools/GPS/list.txt` (ranges, rectangles, comments, `@dsc`).
- Saving twice with the same file updates the entry instead of duplicating it.
