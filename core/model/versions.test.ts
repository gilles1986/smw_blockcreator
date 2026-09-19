// Ticket 16: a Block made with other versions of a Piece than the Library has. Fixture Libraries
// stand for "the Piece as it was" and "the Piece as it is now".
import { describe, expect, it } from 'vitest';
import { loadLibrary, type Library } from '../library';
import { upgradePieces } from './versions';
import type { BlockModel, PieceRef, Statement } from './index';

function piece(version: number, params: unknown[]): Record<string, string> {
  return {
    'actions/boost/piece.json': JSON.stringify({
      id: 'boost',
      version,
      kind: 'action',
      category: 'physics',
      name: 'Boost',
      description: '',
      author: 'test',
      slots: 'mario',
      params,
      clobbers: ['A'],
    }),
    'actions/boost/code.asm': 'LDA #$00\n',
    'conditions/c_fast/piece.json': JSON.stringify({
      id: 'c_fast',
      version: 1,
      kind: 'condition',
      category: 'conditions',
      name: 'Fast',
      description: '',
      author: 'test',
      slots: 'mario',
      params: [],
      clobbers: ['A'],
    }),
    'conditions/c_fast/code.asm': 'LDA $7B\nBEQ {{false}}\n',
  };
}

const speed = (max: number, dflt: number) => ({
  name: 'speed',
  label: 'Speed',
  type: 'number',
  min: 0,
  max,
  default: dflt,
});

/** The Piece as it was: two parameters. */
const before: Library = loadLibrary(
  piece(1, [speed(255, 0), { name: 'flag', label: 'Flag', type: 'bool', default: false }]),
  'builtin',
);
/** The Piece as it is: `flag` is gone, `speed` tops at 99, `direction` is new. */
const now: Library = loadLibrary(
  piece(2, [
    speed(99, 10),
    {
      name: 'direction',
      label: 'Direction',
      type: 'enum',
      options: [
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ],
      default: 'up',
    },
  ]),
  'builtin',
);

const ref = (id: string, version: number, params: PieceRef['params']): PieceRef => ({
  id,
  version,
  params,
});
const action = (r: PieceRef): Statement => ({ type: 'action', piece: r });
const model = (marioTop: Statement[], marioBottom: Statement[] = []): BlockModel => ({
  properties: { name: 'b', description: '', author: '', defaultActAs: 0x130 },
  slots: { marioTop, ...(marioBottom.length > 0 && { marioBottom }) },
});

describe('the fixture Libraries', () => {
  it('load', () => {
    expect(before.errors).toEqual([]);
    expect(now.errors).toEqual([]);
  });
});

describe('upgradePieces', () => {
  it('brings a Piece up to the version of the Library, and says what it lost', () => {
    const old = model([action(ref('boost', 1, { speed: 120, flag: true }))]);
    const result = upgradePieces(old, now);
    // `flag` is not a parameter any more; 120 does not fit 0..99 any more, so it is reset.
    expect(result.model.slots.marioTop).toEqual([
      action(ref('boost', 2, { speed: 10, direction: 'up' })),
    ]);
    expect(result.upgraded).toEqual([
      { id: 'boost', name: 'Boost', from: 1, to: 2, dropped: ['flag'], reset: ['speed'] },
    ]);
    expect(result.ahead).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('keeps the values that still fit, and does not touch the model it was given', () => {
    const old = model([action(ref('boost', 1, { speed: 50, flag: false }))]);
    const snapshot = JSON.stringify(old);
    const result = upgradePieces(old, now);
    expect(result.model.slots.marioTop).toEqual([
      action(ref('boost', 2, { speed: 50, direction: 'up' })),
    ]);
    expect(result.upgraded[0]).toMatchObject({ dropped: ['flag'], reset: [] });
    expect(JSON.stringify(old)).toBe(snapshot);
  });

  it('leaves a Block alone that is up to date, or made with the same version', () => {
    const current = model([action(ref('boost', 2, { speed: 50, direction: 'down' }))]);
    expect(upgradePieces(current, now)).toEqual({
      model: current,
      upgraded: [],
      ahead: [],
      missing: [],
    });
  });

  it('names the Pieces that are newer in the Block than in the Library, and changes nothing', () => {
    const fromTheFuture = model([action(ref('boost', 3, { speed: 5, later: 1 }))]);
    const result = upgradePieces(fromTheFuture, now);
    expect(result.model).toEqual(fromTheFuture);
    expect(result.ahead).toEqual([{ id: 'boost', name: 'Boost', recorded: 3, installed: 2 }]);
    expect(result.upgraded).toEqual([]);
  });

  it('names the Pieces the Library does not have, once each, and keeps their values', () => {
    const ghost = action(ref('ghost', 4, { a: 1, b: 'x' }));
    const result = upgradePieces(model([ghost, ghost], [ghost, action(ref('other', 1, {}))]), now);
    expect(result.missing).toEqual(['ghost', 'other']);
    expect(result.model.slots.marioTop).toEqual([ghost, ghost]);
  });

  it('finds Pieces in every Slot, in branches, else parts and Conditions, and lists a Piece once', () => {
    const fast = (version: number): PieceRef => ref('c_fast', version, {});
    const nested: Statement = {
      type: 'if',
      branches: [
        {
          condition: {
            type: 'and',
            left: { type: 'condition', piece: fast(1) },
            right: { type: 'not', condition: { type: 'condition', piece: fast(1) } },
          },
          body: [action(ref('boost', 1, { speed: 1, flag: true }))],
        },
      ],
      else: [action(ref('boost', 1, { speed: 2, flag: false }))],
    };
    const result = upgradePieces(model([nested], [action(ref('boost', 1, { speed: 3 }))]), now);
    expect(result.upgraded).toEqual([
      { id: 'boost', name: 'Boost', from: 1, to: 2, dropped: ['flag'], reset: [] },
    ]);
    const versions: number[] = [];
    JSON.stringify(result.model, (key, value: unknown) => {
      if (key === 'version') versions.push(value as number);
      return value;
    });
    // c_fast is at version 1 in both Libraries (twice); the three Boosts are now at 2.
    expect(versions.sort()).toEqual([1, 1, 2, 2, 2]);
  });

  it('with the old Library, the same Block needs nothing', () => {
    const old = model([action(ref('boost', 1, { speed: 120, flag: true }))]);
    expect(upgradePieces(old, before)).toMatchObject({ upgraded: [], ahead: [], missing: [] });
  });
});
