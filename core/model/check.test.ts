import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../testing/library';
import { checkPieces, type BlockModel, type Statement } from './index';

const library = builtInLibrary();
const withTop = (marioTop: Statement[]): BlockModel => ({
  properties: { name: 'b', description: '', author: '', defaultActAs: 0x130 },
  slots: { marioTop },
});
const action = (id: string, params: Record<string, unknown> = {}): Statement => ({
  type: 'action',
  piece: { id, version: 1, params: params as never },
});

describe('checkPieces', () => {
  it('accepts a model whose Pieces exist and whose values fit their parameters', () => {
    expect(
      checkPieces(withTop([action('act_as', { tile: 0x130 }), action('hurt_mario')]), library),
    ).toEqual([]);
  });

  it('names Pieces used in a Slot of the wrong kind', () => {
    const model: BlockModel = { ...withTop([]), slots: { spriteTop: [action('hurt_mario')] } };
    expect(checkPieces(model, library)).toEqual([
      "spriteTop /0: Piece 'hurt_mario' only works in Mario Slots.",
    ]);
  });

  it('names unknown Pieces, Pieces used as the wrong kind and values that do not fit', () => {
    const model = withTop([
      action('teleport'),
      action('c_onoff', { position: 0 }),
      action('act_as', { tile: 0x10000 }),
      {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'condition',
              piece: { id: 'c_onoff', version: 1, params: { position: 2 } },
            },
            body: [action('act_as', { tile: 'cement' })],
          },
        ],
      },
    ]);
    expect(checkPieces(model, library)).toEqual([
      "marioTop /0: Piece 'teleport' is not in the Library.",
      "marioTop /1: Piece 'c_onoff' is a Condition, not an Action.",
      "marioTop /2: 'tile' = 65536 is not a valid Map16 number.",
      "marioTop /3/branches/0/condition: 'position' = 2 is not one of: 0, 1.",
      'marioTop /3/branches/0/body/0: \'tile\' = "cement" is not a valid Map16 number.',
    ]);
  });
});
