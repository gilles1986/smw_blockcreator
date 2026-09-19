import { describe, expect, it } from 'vitest';
import { pieceAtPath, type PieceRef, type Statement } from './index';

const piece = (id: string): PieceRef => ({ id, version: 1, params: {} });
const action = (id: string): Statement => ({ type: 'action', piece: piece(id) });

const statements: Statement[] = [
  action('first'),
  {
    type: 'if',
    branches: [
      { condition: { type: 'condition', piece: piece('c0') }, body: [action('body0')] },
      {
        condition: {
          type: 'or',
          left: { type: 'condition', piece: piece('left') },
          right: { type: 'not', condition: { type: 'condition', piece: piece('negated') } },
        },
        body: [],
      },
    ],
    else: [action('else0')],
  },
];

describe('pieceAtPath', () => {
  it.each([
    ['/0', 'first'],
    ['/1/branches/0/condition', 'c0'],
    ['/1/branches/0/body/0', 'body0'],
    ['/1/branches/1/condition/left', 'left'],
    ['/1/branches/1/condition/right/condition', 'negated'],
    ['/1/else/0', 'else0'],
  ])('finds the Piece at the generator path %s', (path, id) => {
    expect(pieceAtPath(statements, path)?.id).toBe(id);
  });

  it.each([
    ['an if statement', '/1'],
    ['a combined Condition', '/1/branches/1/condition'],
    ['a NOT', '/1/branches/1/condition/right'],
    ['the empty path', ''],
    ['a statement that is not there', '/7'],
    ['a step that does not exist', '/0/nope'],
    ['a branch that is not there', '/1/branches/9/condition'],
    ['a step into a parameter', '/0/piece/params'],
    ['an inherited property', '/1/constructor'],
  ])('has no Piece for %s', (_what, path) => {
    expect(pieceAtPath(statements, path)).toBeUndefined();
  });
});
