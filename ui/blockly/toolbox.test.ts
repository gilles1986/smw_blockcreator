import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../../core/testing/library';
import { toolbox } from './toolbox';

describe('toolbox', () => {
  it('starts with Logic, then one coloured category per Piece category in a fixed order', () => {
    expect(toolbox(builtInLibrary())).toEqual({
      kind: 'categoryToolbox',
      contents: [
        {
          kind: 'category',
          name: 'Logic',
          colour: '#5b80a5',
          contents: [
            { kind: 'block', type: 'controls_if' },
            { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
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
    const categories = toolbox({ ...library, pieces }).contents.map((c) => [
      c.name,
      c.contents.map((b) => b.type),
    ]);
    expect(categories).toEqual([
      ['Logic', ['controls_if', 'controls_if']],
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
    const blocks = toolbox({ ...library, pieces }).contents.flatMap((c) => c.contents);
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
