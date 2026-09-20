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

describe('checkPieces and Pieces the Library does not have', () => {
  const ghost = withTop([action('act_as', { tile: 0x25 }), action('no_such_piece', { x: 1 })]);

  it('reports a missing Piece by default', () => {
    expect(checkPieces(ghost, library)).toEqual([
      "marioTop /1: Piece 'no_such_piece' is not in the Library.",
    ]);
  });

  it('lets a missing Piece through when asked, and still checks the others', () => {
    expect(checkPieces(ghost, library, { allowMissing: true })).toEqual([]);
    const wrong = withTop([action('no_such_piece'), action('act_as', { tile: 'x' })]);
    expect(checkPieces(wrong, library, { allowMissing: true })).toEqual([
      'marioTop /1: \'tile\' = "x" is not a valid Map16 number.',
    ]);
  });
});

describe('checkPieces', () => {
  it('accepts a model whose Pieces exist and whose values fit their parameters', () => {
    expect(
      checkPieces(withTop([action('act_as', { tile: 0x130 }), action('hurt_mario')]), library),
    ).toEqual([]);
  });

  it('checks the Conditions inside AND / OR / NOT, naming their paths', () => {
    const onOff = (position: number) => ({
      type: 'condition' as const,
      piece: { id: 'c_onoff', version: 1, params: { position } },
    });
    const model = withTop([
      {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'or',
              left: onOff(0),
              right: {
                type: 'not',
                condition: { ...onOff(0), piece: { ...onOff(0).piece, id: 'act_as' } },
              },
            },
            body: [],
          },
          { condition: { type: 'and', left: onOff(5), right: onOff(1) }, body: [] },
        ],
      },
    ]);
    expect(checkPieces(model, library)).toEqual([
      "marioTop /0/branches/0/condition/right/condition: Piece 'act_as' is an Action, not a Condition.",
      "marioTop /0/branches/1/condition/left: 'position' = 5 is not one of: 0, 1.",
    ]);
  });

  it('names Pieces used in a Slot of the wrong kind', () => {
    const model: BlockModel = { ...withTop([]), slots: { spriteTop: [action('boost_mario')] } };
    expect(checkPieces(model, library)).toEqual([
      "spriteTop /0: Piece 'boost_mario' only works in Mario Slots.",
    ]);
  });

  it('names unknown Pieces, Pieces used as the wrong kind and values that do not fit', () => {
    const model = withTop([
      action('time_machine'),
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
      "marioTop /0: Piece 'time_machine' is not in the Library.",
      "marioTop /1: Piece 'c_onoff' is a Condition, not an Action.",
      "marioTop /2: 'tile' = 65536 is not a valid Map16 number.",
      "marioTop /3/branches/0/condition: 'position' = 2 is not one of: 0, 1.",
      'marioTop /3/branches/0/body/0: \'tile\' = "cement" is not a valid Map16 number.',
    ]);
  });

  it('validates slotLinks (self-link, kind mismatch, circular links)', () => {
    const model: BlockModel = {
      ...withTop([]),
      slotLinks: {
        marioTop: 'marioTop', // self-link
        marioLeft: 'spriteRight', // kind mismatch
        spriteLeft: 'spriteRight', // cycle part 1
        spriteRight: 'spriteLeft', // cycle part 2
      },
    };
    expect(checkPieces(model, library)).toEqual([
      "slotLinks: Slot 'marioTop' cannot link to itself.",
      "slotLinks: Slot 'marioLeft' (Mario) cannot link to 'spriteRight' (Sprite).",
      "slotLinks: Circular link detected involving Slot 'spriteRight'.",
    ]);
  });
});
