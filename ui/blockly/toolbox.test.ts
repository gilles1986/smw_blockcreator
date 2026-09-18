import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../../core/testing/library';
import { toolbox } from './toolbox';

describe('toolbox', () => {
  it('starts with Logic, then one coloured category per Piece category in a fixed order', () => {
    expect(toolbox(builtInLibrary(), 'mario')).toEqual({
      kind: 'categoryToolbox',
      contents: [
        {
          kind: 'category',
          name: 'Logic',
          colour: '#5b80a5',
          contents: [
            { kind: 'block', type: 'controls_if' },
            { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
            { kind: 'block', type: 'logic_operation', fields: { OP: 'AND' } },
            { kind: 'block', type: 'logic_operation', fields: { OP: 'OR' } },
            { kind: 'block', type: 'logic_negate' },
          ],
        },
        {
          kind: 'category',
          name: 'Conditions',
          colour: 260,
          contents: [{ kind: 'block', type: 'piece_c_onoff', fields: { position: '0' } }],
        },
        {
          kind: 'category',
          name: 'Physics',
          colour: 210,
          contents: [{ kind: 'block', type: 'piece_act_as', fields: { tile: '130' } }],
        },
        {
          kind: 'category',
          name: 'Damage',
          colour: 0,
          contents: [{ kind: 'block', type: 'piece_hurt_mario' }],
        },
      ],
    });
  });

  it('adds community categories after the built-in ones, blocks sorted by name', () => {
    const library = builtInLibrary();
    const base = library.pieces.get('act_as')!;
    const piece = (id: string, name: string, category: string) => ({
      ...base,
      manifest: { ...base.manifest, id, name, category },
    });
    const pieces = new Map([
      ['zz', piece('zz', 'Zap', 'kaizo_tricks')],
      ['aa', piece('aa', 'Anchor', 'kaizo_tricks')],
      ['bb', piece('bb', 'Bounce', 'physics')],
    ]);
    const categories = toolbox({ ...library, pieces }, 'mario').contents.map((c) => [
      c.name,
      c.contents.map((b) => b.type),
    ]);
    expect(categories).toEqual([
      [
        'Logic',
        ['controls_if', 'controls_if', 'logic_operation', 'logic_operation', 'logic_negate'],
      ],
      ['Physics', ['piece_bb']],
      ['Kaizo tricks', ['piece_aa', 'piece_zz']],
    ]);
  });
});

describe('toolbox defaults', () => {
  it('presets every field with the manifest default, since a dropdown would start on its first option', () => {
    const library = builtInLibrary();
    const base = library.pieces.get('c_onoff')!;
    const offByDefault = {
      ...base,
      manifest: {
        ...base.manifest,
        params: [{ ...base.manifest.params[0]!, default: 1 }],
      },
    };
    const pieces = new Map([
      ['c_onoff', offByDefault],
      ['act_as', library.pieces.get('act_as')!],
    ]);
    const blocks = toolbox({ ...library, pieces }, 'mario').contents.flatMap((c) => c.contents);
    expect(blocks.find((b) => b.type === 'piece_c_onoff')).toEqual({
      kind: 'block',
      type: 'piece_c_onoff',
      fields: { position: '1' },
    });
    expect(blocks.find((b) => b.type === 'piece_act_as')).toEqual({
      kind: 'block',
      type: 'piece_act_as',
      fields: { tile: '130' },
    });
  });
});

describe('toolbox per Slot kind', () => {
  const library = builtInLibrary();
  const types = (kind: 'mario' | 'sprite') =>
    toolbox(library, kind).contents.flatMap((c) => c.contents.map((b) => b.type));

  it('hides Mario-only Pieces in Sprite Slots (and drops categories left empty)', () => {
    expect(types('sprite')).not.toContain('piece_hurt_mario');
    expect(toolbox(library, 'sprite').contents.map((c) => c.name)).toEqual([
      'Logic',
      'Conditions',
      'Physics',
    ]);
  });

  it('shows Mario-only and any-Slot Pieces in Mario Slots', () => {
    expect(types('mario')).toEqual(
      expect.arrayContaining(['piece_hurt_mario', 'piece_act_as', 'piece_c_onoff']),
    );
  });

  it('hides Sprite-only Pieces in Mario Slots', () => {
    const base = library.pieces.get('act_as')!;
    const spriteOnly = {
      ...base,
      manifest: { ...base.manifest, id: 'turn', slots: 'sprite' as const },
    };
    const withTurn = { ...library, pieces: new Map([...library.pieces, ['turn', spriteOnly]]) };
    const typesIn = (kind: 'mario' | 'sprite') =>
      toolbox(withTurn, kind).contents.flatMap((c) => c.contents.map((b) => b.type));
    expect(typesIn('mario')).not.toContain('piece_turn');
    expect(typesIn('sprite')).toContain('piece_turn');
  });
});
