import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_NAMES,
  filterChoices,
  LEVEL_SHELLS,
  nameChoices,
  soundsOf,
  typedNumber,
  VANILLA_SPRITES,
} from '.';

describe('vanilla sprite names', () => {
  it('cover every sprite from 00 to C8 in number order', () => {
    expect(VANILLA_SPRITES).toHaveLength(0xc9);
    expect(VANILLA_SPRITES.every((sprite, i) => sprite.id === i && sprite.name !== '')).toBe(true);
  });

  it('name the well-known ones', () => {
    const name = (id: number) => VANILLA_SPRITES[id]?.name;
    expect(name(0x00)).toBe('Green Koopa, no shell');
    expect(name(0x0f)).toBe('Goomba');
    expect(name(0x74)).toBe('Mushroom');
    expect(name(0x91)).toBe("Chargin' Chuck");
    expect(name(0xc8)).toBe('Light switch block for dark room');
  });
});

describe('sound names', () => {
  it('list the sounds of each port', () => {
    expect(soundsOf('$1DF9').find((s) => s.id === 0x01)?.name).toBe('Hit head');
    expect(soundsOf('$1DFC').find((s) => s.id === 0x01)?.name).toBe('Coin');
    expect(soundsOf('$1DFA').find((s) => s.id === 0x01)?.name).toBe('Jump');
  });

  it('leave out the special values and know nothing of other ports', () => {
    expect(soundsOf('$1DF9').every((s) => s.id <= 0x2a)).toBe(true);
    expect(soundsOf('$1DFC').every((s) => s.id <= 0x34)).toBe(true);
    expect(soundsOf('$1DFA').some((s) => s.id === 0xff)).toBe(false);
    expect(soundsOf('$1DFB')).toEqual([]);
  });

  it('are what the built-in names offer, and no custom sprites', () => {
    expect(BUILT_IN_NAMES.sounds('$1DFC')).toEqual(soundsOf('$1DFC'));
    expect(BUILT_IN_NAMES.sprites(false)).toEqual([...VANILLA_SPRITES, ...LEVEL_SHELLS]);
    expect(BUILT_IN_NAMES.sprites(true)).toEqual([]);
  });
});

describe('level shells', () => {
  it('name the Lunar Magic shell numbers: DA–DD after the Koopas 04–07, and DF', () => {
    expect(LEVEL_SHELLS).toEqual([
      { id: 0xda, name: 'Green Koopa shell' },
      { id: 0xdb, name: 'Red Koopa shell' },
      { id: 0xdc, name: 'Blue Koopa shell' },
      { id: 0xdd, name: 'Yellow Koopa shell' },
      { id: 0xdf, name: "Green shell, won't use special world graphic" },
    ]);
  });

  it('are named choices, ahead of the numbers without a name', () => {
    const choices = nameChoices(BUILT_IN_NAMES.sprites(false));
    expect(choices.find((c) => c.value === 'DA')).toMatchObject({
      label: 'DA · Green Koopa shell',
      named: true,
    });
    expect(choices.find((c) => c.value === 'DE')?.named).toBe(false);
  });
});

describe('typedNumber', () => {
  it.each([
    ['da', 'DA'],
    ['$DA', 'DA'],
    ['0xda', 'DA'],
    [' 4 ', '04'],
    ['0', '00'],
  ])('reads %j as %s', (text, value) => {
    expect(typedNumber(text)).toBe(value);
  });

  it.each(['', 'd4x', 'green', '123', '$', '0x'])('does not read %j as a number', (text) => {
    expect(typedNumber(text)).toBeUndefined();
  });
});

describe('filterChoices', () => {
  const choices = nameChoices(BUILT_IN_NAMES.sprites(false));
  const values = (query: string) => filterChoices(choices, query).map((c) => c.value);

  it('shows everything for an empty search', () => {
    expect(values('  ')).toHaveLength(256);
  });

  it('puts a typed number first, however it is written', () => {
    for (const text of ['da', 'DA', '$da', '0xDA']) expect(values(text)[0]).toBe('DA');
    expect(values('4')[0]).toBe('04');
  });

  it('finds a name anywhere in it, ignoring case', () => {
    expect(values('koopa shell')).toEqual(['DA', 'DB', 'DC', 'DD']);
    expect(values('GOOMBA')).toContain('0F');
  });

  it('only searches the names for a single letter', () => {
    const found = filterChoices(choices, 'd');
    expect(found[0]?.value).not.toBe('0D');
    expect(found.every((c) => c.label.toLowerCase().includes('d'))).toBe(true);
  });

  it('finds nothing for something that is neither', () => {
    expect(values('no such sprite')).toEqual([]);
  });
});

describe('nameChoices', () => {
  it('offers every number, the named ones first, each once', () => {
    const choices = nameChoices([
      { id: 0x30, name: 'Thirty' },
      { id: 0x05, name: 'Five' },
    ]);
    expect(choices).toHaveLength(256);
    expect(choices.slice(0, 3).map((c) => c.label)).toEqual(['05 · Five', '30 · Thirty', '00']);
    expect(new Set(choices.map((c) => c.value)).size).toBe(256);
    expect(choices.filter((c) => c.named).map((c) => c.value)).toEqual(['05', '30']);
  });

  it('ignores names for numbers outside 00–FF', () => {
    expect(nameChoices([{ id: 0x100, name: 'Too big' }]).every((c) => !c.named)).toBe(true);
  });
});
