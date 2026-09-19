import { describe, expect, it } from 'vitest';
import { generate } from '../core/generator';
import { builtInLibrary } from '../core/testing/library';
import { PRESET_TOOL_VERSION, PRESETS } from '../core/testing/presets';
import { presetList } from './presets';

const library = builtInLibrary();

describe('presetList', () => {
  it('offers the Presets of the Library with their name and description', () => {
    const presets = presetList(library);
    expect(presets.map((preset) => preset.id).sort()).toEqual(Object.keys(PRESETS).sort());
    const muncher = presets.find((preset) => preset.id === 'muncher')!;
    expect(muncher.name).toBe('muncher');
    expect(muncher.description).toContain('vanilla muncher');
    // The copy is the Preset's model: the same links and Pieces.
    expect(muncher.model).toEqual(PRESETS.muncher);
  });

  it('opens a Preset as a Block that generates the same file', () => {
    const muncher = presetList(library).find((preset) => preset.id === 'muncher')!;
    const again = generate(muncher.model, library, { toolVersion: PRESET_TOOL_VERSION });
    expect(again.text).toBe(library.presets.get('muncher')!.text);
  });

  it('leaves out files that are not Blocks, or that need Pieces the Library lacks', () => {
    const good = library.presets.get('muncher')!;
    const missingPiece = {
      ...good,
      text: good.text.replace(/"id":"hurt_mario"/g, '"id":"no_such_piece"'),
    };
    const broken = new Map([
      ['muncher', good],
      ['not_a_block', { ...good, text: 'db $42\nRTL\n' }],
      ['missing_piece', missingPiece],
    ]);
    expect(presetList({ ...library, presets: broken }).map((preset) => preset.id)).toEqual([
      'muncher',
    ]);
  });

  it('sorts by name', () => {
    const good = library.presets.get('muncher')!;
    const renamed = { ...good, text: good.text.replace(/"name":"muncher"/, '"name":"a_first"') };
    const presets = presetList({
      ...library,
      presets: new Map([
        ['muncher', good],
        ['other', renamed],
      ]),
    });
    expect(presets.map((preset) => preset.id)).toEqual(['other', 'muncher']);
  });
});
