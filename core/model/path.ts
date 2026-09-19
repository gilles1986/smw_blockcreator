import type { PieceRef, Statement } from './index';

/**
 * The Piece at a statement or Condition path as the generator's line map names it, e.g.
 * `/0`, `/1/branches/0/condition` or `/1/else/0`. Undefined where the path ends at something
 * without a Piece (an `if`, AND / OR / NOT) or leaves the tree.
 */
export function pieceAtPath(statements: readonly Statement[], path: string): PieceRef | undefined {
  let node: unknown = statements;
  for (const step of path.split('/').slice(1)) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, step)) return undefined;
    node = (node as Record<string, unknown>)[step];
  }
  return (node as { piece?: PieceRef } | undefined)?.piece;
}
