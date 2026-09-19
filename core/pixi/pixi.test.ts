import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePixiSprites } from '.';

// A copy of Rooms-For-A-Friend/tools/PIXI/list.txt.
const real = readFileSync(new URL('./fixtures/pixi-list.txt', import.meta.url), 'utf8');

describe('parsePixiSprites', () => {
  it('names each sprite after its file, without folders and extension', () => {
    expect(parsePixiSprites('00 a/b/ghost-shell.json\n01 Thing.cfg\n02 c\\d.asm\n')).toEqual([
      { id: 0, name: 'ghost-shell' },
      { id: 1, name: 'Thing' },
      { id: 2, name: 'd' },
    ]);
  });

  it('reads the sprites before the first section, in number order', () => {
    expect(parsePixiSprites('0A b.cfg\n; comment\n\n02 a.cfg\n')).toEqual([
      { id: 2, name: 'a' },
      { id: 10, name: 'b' },
    ]);
  });

  it('reads only the SPRITE: section, and no per-level lines', () => {
    const text = 'SPRITE:\n01 a.cfg\n105:02 level.cfg\nEXTENDED:\n03 ext.asm\nSPRITE:\n04 b.cfg\n';
    expect(parsePixiSprites(text).map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('keeps the last file of a number listed twice', () => {
    expect(parsePixiSprites('01 a.cfg\n01 b.cfg\n')).toEqual([{ id: 1, name: 'b' }]);
  });

  it("reads the project's real list", () => {
    const sprites = parsePixiSprites(real);
    expect(sprites.map((s) => [s.id.toString(16).toUpperCase().padStart(2, '0'), s.name])).toEqual([
      ['00', 'platform_megapack'],
      ['01', 'ExtendedSpriteKiller'],
      ['02', 'FlyingQuestionBlock'],
      ['03', 'TimedPlatform-AnyTimeAndDirection'],
      ['04', 'mega_mole_BF'],
      ['05', 'ghost-shell'],
      ['06', 'ChasinRex'],
      ['07', 'MotorShell'],
      ['A0', 'donut_sprite'],
    ]);
  });
});
