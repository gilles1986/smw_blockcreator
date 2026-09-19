import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../testing/library';

// GPS puts a routine into a macro and calls it from every Block that uses it, so a plain label
// would clash the second time; only `?` labels are local to each use.
describe('tool routines of the built-in Library', () => {
  const library = builtInLibrary();

  it('has the routines the Pieces list', () => {
    expect(library.errors).toEqual([]);
    expect([...library.routines.keys()]).toContain('bc_holding_sprite');
  });

  it.each([...library.routines].map(([name, file]) => [name, file.text] as const))(
    '%s uses only ? labels',
    (_, text) => {
      const labels = [...text.matchAll(/^[ \t]*([A-Za-z_.?][\w.]*):/gm)].map((match) => match[1]!);
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.filter((label) => !label.startsWith('?'))).toEqual([]);
    },
  );
});
