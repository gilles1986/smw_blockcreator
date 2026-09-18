import { describe, expect, it } from 'vitest';
import { BLOCK_FILE, buildHarness, mapAsarMessages } from './index';

describe('buildHarness', () => {
  it('includes the project defines, a stub macro per routine, then the Block', () => {
    const harness = buildHarness(['sprite_block_position', 'bc_holding_sprite']);
    const lines = harness.split('\n');
    expect(lines).toContain('incsrc "defines.asm"');
    expect(harness).toContain(
      'macro sprite_block_position()\n\tJSL BlockCreatorRoutineStub\nendmacro',
    );
    expect(harness).toContain('macro bc_holding_sprite()\n\tJSL BlockCreatorRoutineStub\nendmacro');
    expect(lines.at(-2)).toBe(`incsrc "${BLOCK_FILE}"`);
    expect(harness.indexOf('lorom')).toBeLessThan(harness.indexOf('incsrc "defines.asm"'));
  });

  it('skips routine names that cannot be macro names and lists each once', () => {
    const harness = buildHarness(['my-routine', 'ok_one', 'ok_one']);
    expect(harness).not.toContain('my-routine');
    expect(harness.split('macro ok_one()').length).toBe(2);
  });
});

describe('mapAsarMessages', () => {
  const lineMap = new Map([
    [20, { slot: 'marioTop' as const, path: '/0/branches/0/condition' }],
    [23, { slot: 'marioTop' as const, path: '/0/branches/0/body/0' }],
  ]);

  it('maps errors in the Block file to the Slot and statement of that line', () => {
    expect(
      mapAsarMessages([{ file: BLOCK_FILE, line: 23, message: 'Unknown command.' }], lineMap),
    ).toEqual([
      {
        message: 'Unknown command.',
        line: 23,
        origin: { slot: 'marioTop', path: '/0/branches/0/body/0' },
      },
    ]);
  });

  it('keeps errors it cannot place (header lines, other files) without an origin', () => {
    expect(
      mapAsarMessages(
        [
          { file: BLOCK_FILE, line: 2, message: 'Bad header.' },
          { file: 'defines.asm', line: 7, message: 'Broken define.' },
        ],
        lineMap,
      ),
    ).toEqual([
      { message: 'Bad header.', line: 2 },
      { message: 'defines.asm line 7: Broken define.' },
    ]);
  });
});
