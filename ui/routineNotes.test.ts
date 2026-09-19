import { describe, expect, it } from 'vitest';
import type { ProjectSaveOutcome } from './projectSave';
import { routineFilesNote, savedToProjectNotice } from './routineNotes';

type Saved = Extract<ProjectSaveOutcome, { kind: 'saved' }>;
const saved = (routines: Partial<Saved['routines']> = {}, listUpdated = false): Saved => ({
  kind: 'saved',
  path: 'blocks/blockcreator/a.asm',
  listUpdated,
  routines: { copied: [], missing: [], kept: [], ...routines },
});

describe('savedToProjectNotice', () => {
  it('says what was saved, and to run GPS', () => {
    expect(savedToProjectNotice(saved())).toEqual({
      kind: 'info',
      text: "Saved blocks/blockcreator/a.asm. Run GPS (or Callisto's Update) to insert it.",
    });
  });

  it('names the list entry, and the routines that were copied', () => {
    const notice = savedToProjectNotice(saved({ copied: ['bc_a', 'bc_b'] }, true), {
      tile: 0x406,
      actAs: 0x130,
    });
    expect(notice.kind).toBe('info');
    expect(notice.text).toContain('and put it in list.txt at 0406 (the old list is list.txt.bak)');
    expect(notice.text).toContain('Copied bc_a.asm, bc_b.asm into the routines folder.');
  });

  it('warns about a routine that is still missing or that was kept different', () => {
    const missing = savedToProjectNotice(saved({ missing: ['bc_a'] }));
    expect(missing.kind).toBe('warning');
    expect(missing.text).toContain('bc_a.asm is not in the project');
    const kept = savedToProjectNotice(saved({ kept: ['bc_b'] }));
    expect(kept.kind).toBe('warning');
    expect(kept.text).toContain("Kept the project's own bc_b.asm");
  });
});

describe('routineFilesNote', () => {
  it('lists the files and where they go', () => {
    expect(routineFilesNote(['bc_a', 'bc_b'])).toBe(
      'This Block needs bc_a.asm, bc_b.asm in the routines folder of your GPS project. "Save to GPS project…" copies them there.',
    );
    expect(routineFilesNote(['bc_a'], 'D:/GPS')).toContain('in D:/GPS/routines.');
  });

  it('says nothing for a Block that needs no routine', () => {
    expect(routineFilesNote([])).toBeUndefined();
  });
});
