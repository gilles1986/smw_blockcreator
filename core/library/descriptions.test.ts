// Ticket 14: "every RAM address is verified with the SMW knowledge CLI and cited in the Piece
// description". The verifying is done by hand (level.test.ts holds what it found); this test keeps
// the citing honest: whatever address the code of a Level Action, a Condition or an advanced Piece
// touches, the description or a label of the Piece names it.
import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../testing/library';

const library = builtInLibrary();
const CATEGORIES = new Set(['level', 'conditions', 'advanced']);

/** `$0F31`, `$0F31-$0F33`, `$15-$18` and `!14C8` (a sprite table) as byte addresses. */
function cited(text: string): Set<number> {
  const found = new Set<number>();
  for (const match of text.matchAll(/[$!]([0-9A-F]{2,6})(?:\s*[-–]\s*\$?([0-9A-F]{2,6}))?\b/gi)) {
    const from = parseInt(match[1]!, 16);
    const to = match[2] ? parseInt(match[2], 16) : from;
    for (let address = from; address <= to && address - from < 0x40; address++) {
      found.add(bankless(address));
    }
  }
  return found;
}

/** Bank $7E:0000-$1FFF is the same RAM as $0000-$1FFF. */
function bankless(address: number): number {
  return address >= 0x7e0000 && address < 0x7e2000 ? address - 0x7e0000 : address;
}

/** The fixed RAM addresses a template reads or writes; not routine calls, not the user's own. */
function touched(template: string): Set<number> {
  const found = new Set<number>();
  for (const line of template.replace(/\{\{.*?\}\}/g, '').split('\n')) {
    const code = line.replace(/;.*$/, '');
    if (/^\s*(JSL|JSR|JML|JMP)\b/i.test(code)) continue;
    for (const match of code.matchAll(/(?<![#\w$])[$!]([0-9A-F]{2,6})\b/gi)) {
      if (/^(addr|bank|dp)$/i.test(match[1]!)) continue;
      found.add(bankless(parseInt(match[1]!, 16)));
    }
  }
  // $00-$0F is scratch RAM, which GPS routines and macros use freely.
  return new Set([...found].filter((address) => address >= 0x10));
}

describe('Piece descriptions cite the RAM their code touches', () => {
  const pieces = [...library.pieces.values()].filter(({ manifest }) =>
    CATEGORIES.has(manifest.category),
  );

  it('looks at the Level Actions, the Conditions and the advanced Pieces', () => {
    const ids = pieces.map(({ manifest }) => manifest.id);
    expect(ids).toEqual(expect.arrayContaining(['set_onoff', 'c_onoff', 'write_ram', 'c_ram']));
    expect(ids.length).toBeGreaterThan(40);
  });

  it.each(pieces.map((piece) => [piece.manifest.id, piece] as const))('%s', (_, piece) => {
    const { manifest, template } = piece;
    const words = [
      manifest.description,
      ...manifest.params.flatMap((param) => [
        param.label,
        ...(param.options ?? []).map((o) => o.label),
      ]),
    ].join('\n');
    const documented = cited(words);
    const missing = [...touched(template)].filter((address) => !documented.has(address));
    expect(
      missing.map((address) => `$${address.toString(16).toUpperCase().padStart(4, '0')}`),
      `${manifest.id} does not name these addresses in its description`,
    ).toEqual([]);
  });
});
