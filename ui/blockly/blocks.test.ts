import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../../core/testing/library';
import { blockDefinitions } from './blocks';

const library = builtInLibrary();
const definition = (type: string) => blockDefinitions(library).find((d) => d.type === type);

describe('blockDefinitions', () => {
  it('turns an Action into a statement block with one field per parameter', () => {
    expect(definition('piece_act_as')).toEqual({
      type: 'piece_act_as',
      message0: 'Act as %1',
      args0: [{ type: 'field_input', name: 'tile', text: '130' }],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip:
        'Makes the Block behave like another tile for this contact, e.g. 025 (air) or 130 (cement).',
    });
  });

  it('turns a Condition into a Boolean value block with enum options as a dropdown', () => {
    expect(definition('piece_c_onoff')).toMatchObject({
      message0: 'ON/OFF switch is %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'position',
          options: [
            ['ON', '0'],
            ['OFF', '1'],
          ],
        },
      ],
      output: 'Boolean',
      colour: 260,
    });
    expect(definition('piece_c_onoff')).not.toHaveProperty('previousStatement');
  });

  it('labels each parameter when a Piece has several, and colours unknown categories', () => {
    const base = library.pieces.get('act_as')!;
    const boost = {
      ...base,
      manifest: {
        ...base.manifest,
        id: 'boost',
        name: 'Boost Mario',
        category: 'kaizo_tricks',
        params: [
          { name: 'x', label: 'X', type: 'number' as const, min: 0, max: 127, default: 48 },
          { name: 'add', label: 'add', type: 'bool' as const, default: false },
        ],
      },
    };
    const [definitionOfBoost] = blockDefinitions({
      ...library,
      pieces: new Map([['boost', boost]]),
    });
    expect(definitionOfBoost).toMatchObject({
      message0: 'Boost Mario X %1 add %2',
      args0: [
        { type: 'field_number', name: 'x', value: 48, min: 0, max: 127, precision: 1 },
        { type: 'field_checkbox', name: 'add', checked: false },
      ],
    });
    expect(typeof definitionOfBoost!.colour).toBe('number');
  });
});
