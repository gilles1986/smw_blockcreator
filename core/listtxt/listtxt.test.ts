import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entryOf, ListError, occupancy, parseList, withBlockEntry } from '.';

// A copy of Rooms-For-A-Friend/tools/GPS/list.txt: ranges, rectangles' neighbours, comments, @dsc.
const real = readFileSync(new URL('./fixtures/gps-list.txt', import.meta.url), 'utf8');

const block = { tile: 0x406, actAs: 0x130, file: 'blockcreator/my_block.asm' };

describe('parseList', () => {
  it('reads a tile with and without acts-like, in 3 or 4 digits', () => {
    expect(parseList('0290:0130 a.asm\n2F7:025 b.asm\n201\tc.asm\n')).toEqual([
      { line: 0, kind: 'single', tiles: [0x290], actAs: 0x130, file: 'a.asm' },
      { line: 1, kind: 'single', tiles: [0x2f7], actAs: 0x25, file: 'b.asm' },
      { line: 2, kind: 'single', tiles: [0x201], file: 'c.asm' },
    ]);
  });

  it('reads ranges and rectangles as README describes them', () => {
    const [range, rect] = parseList('200-202:10 power.asm\nR203-214 power.asm\n');
    expect(range).toMatchObject({ kind: 'range', tiles: [0x200, 0x201, 0x202], actAs: 0x10 });
    expect(rect).toMatchObject({ kind: 'rectangle', tiles: [0x203, 0x204, 0x213, 0x214] });
    expect(rect?.actAs).toBeUndefined();
  });

  it('skips comments and blank lines, and stops at @dsc', () => {
    const text = '; 400:130 example.asm\n\n0400:0130 a.asm\n@dsc\n0401 0 not a block\n';
    expect(parseList(text).map((entry) => entry.file)).toEqual(['a.asm']);
  });

  it('reads a file with Windows line breaks', () => {
    expect(parseList('0400:0130 a.asm\r\n0401:0130 b.asm\r\n').map((e) => e.file)).toEqual([
      'a.asm',
      'b.asm',
    ]);
  });

  it("reads the project's real list", () => {
    const entries = parseList(real);
    const holder = occupancy(entries);
    expect(holder.get(0x290)?.file).toBe('global/mario_passable.asm');
    // 0332-0335 is a range with acts-like 0130.
    expect(holder.get(0x334)).toMatchObject({ kind: 'range', actAs: 0x130 });
    // The tile descriptions after @dsc are not blocks.
    expect(holder.has(0x3ec)).toBe(false);
    expect(holder.has(0x200)).toBe(false);
    expect(entries.every((entry) => entry.tiles.length > 0)).toBe(true);
  });
});

describe('withBlockEntry', () => {
  it('adds the line after the last block line, before the @dsc section', () => {
    const out = withBlockEntry(real, block);
    const lines = real.split('\n');
    const at = lines.indexOf('0405:130 Spin_Block.asm') + 1;
    expect(out.split('\n')).toEqual([
      ...lines.slice(0, at),
      '0406:0130 blockcreator/my_block.asm',
      ...lines.slice(at),
    ]);
  });

  it('updates the same file instead of adding it twice', () => {
    const once = withBlockEntry(real, block);
    expect(withBlockEntry(once, block)).toBe(once);
    const moved = withBlockEntry(once, { ...block, tile: 0x407, actAs: 0x25 });
    expect(moved.split('\n')).toHaveLength(once.split('\n').length);
    expect(moved).toContain('0407:0025 blockcreator/my_block.asm');
    expect(moved).not.toContain('0406:0130 blockcreator');
    expect(entryOf(parseList(moved), 'BlockCreator\\My_Block.asm')?.tiles).toEqual([0x407]);
  });

  it('refuses a tile another file holds, also inside a range', () => {
    expect(() => withBlockEntry(real, { ...block, tile: 0x290 })).toThrow(ListError);
    expect(() => withBlockEntry(real, { ...block, tile: 0x334 })).toThrow(/pass_if_in_pipe/);
  });

  it('writes Windows line breaks into a list that has them', () => {
    const out = withBlockEntry('0400:0130 a.asm\r\n@dsc\r\n', block);
    expect(out).toBe('0400:0130 a.asm\r\n0406:0130 blockcreator/my_block.asm\r\n@dsc\r\n');
  });

  it('starts a list, adds to one without a final line break, and goes before @dsc when empty', () => {
    expect(withBlockEntry('', block)).toBe('0406:0130 blockcreator/my_block.asm\n');
    expect(withBlockEntry('; blocks', block)).toBe('; blocks\n0406:0130 blockcreator/my_block.asm');
    expect(withBlockEntry('; blocks\n\n@dsc\n1 0 d\n', block)).toBe(
      '; blocks\n0406:0130 blockcreator/my_block.asm\n\n@dsc\n1 0 d\n',
    );
  });

  it('never changes any other line', () => {
    const lineOf = fc.constantFrom(
      '',
      '; a comment',
      '0290:0130 global/a.asm',
      '0291-0293:0025 b.asm',
      'R2A0-2B1 c.asm',
      '@dsc',
    );
    fc.assert(
      fc.property(
        fc.array(lineOf, { maxLength: 12 }),
        fc.integer({ min: 0x400, max: 0x4ff }),
        (lines, tile) => {
          const text = lines.join('\n');
          const out = withBlockEntry(text, { ...block, tile }).split('\n');
          const added = out.filter((line) => line.includes('blockcreator/my_block.asm'));
          expect(added).toEqual([
            `${tile.toString(16).toUpperCase().padStart(4, '0')}:0130 blockcreator/my_block.asm`,
          ]);
          expect(out.filter((line) => !added.includes(line))).toEqual(text.split('\n'));
        },
      ),
    );
  });
});
