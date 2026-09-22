// "Mario is on block half" (c_block_half), run on the model of the RAM (core/testing/mini65816.ts).
// The fact it rests on: `CODE_00F44D` (bank 00) puts Mario's X plus the X offset of the interaction
// point into `$9A` (TouchBlockXPos) and reads the tile at `$9A >> 4`; nothing rounds `$9A` to the
// block before the block's code runs, which is why the blocks of the archive mask it with `AND #$FFF0`.
import { describe, expect, it } from 'vitest';
import { render } from '../template';
import { run } from '../testing/mini65816';
import { builtInLibrary } from '../testing/library';

const library = builtInLibrary();
const FALSE = 'FALSE';

function isOn(half: 0 | 1 | 2 | 3, low: number, high = 0): boolean {
  const piece = library.pieces.get('c_block_half');
  if (!piece) throw new Error("Piece 'c_block_half' not loaded");
  const code = render(piece.template, {
    params: { half },
    label: (name) => name,
    falseLabel: FALSE,
    slot: 'marioTop',
  });
  const ram: Record<number, number> = half >= 2 ? { 0x98: low, 0x99: high } : { 0x9a: low, 0x9b: high };
  return !run(code, { falseLabel: FALSE, ram }).falseTaken;
}

describe('Mario is on block half', () => {
  it('takes pixels 0 to 7 of a block as the left half and 8 to 15 as the right', () => {
    for (let x = 0; x < 256; x++) {
      const right = (x & 0x0f) >= 8;
      expect(isOn(0, x), `left at ${x}`).toBe(!right);
      expect(isOn(1, x), `right at ${x}`).toBe(right);
    }
  });

  it('only reads the low byte of the X, so a vertical level or a second screen changes nothing', () => {
    for (let x = 0; x < 256; x++) {
      expect(isOn(0, x, 1)).toBe(isOn(0, x, 0));
      expect(isOn(1, x, 1)).toBe(isOn(1, x, 0));
    }
  });

  it('takes pixels 0 to 7 of a block as the top half and 8 to 15 as the bottom', () => {
    for (let y = 0; y < 256; y++) {
      const bottom = (y & 0x0f) >= 8;
      expect(isOn(2, y), `top at ${y}`).toBe(!bottom);
      expect(isOn(3, y), `bottom at ${y}`).toBe(bottom);
    }
  });

  it('only reads the low byte of the Y, so a vertical level or a second screen changes nothing', () => {
    for (let y = 0; y < 256; y++) {
      expect(isOn(2, y, 1)).toBe(isOn(2, y, 0));
      expect(isOn(3, y, 1)).toBe(isOn(3, y, 0));
    }
  });

  it('is a Mario Slot Condition: a sprite has no contact point in $9A or $98', () => {
    expect(library.pieces.get('c_block_half')!.manifest.slots).toBe('mario');
  });
});
