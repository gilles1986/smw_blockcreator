// Walking the Piece uses of a Block: every Action and Condition Piece in every Slot, in `if`
// branches, `else` parts and inside AND / OR / NOT.

import type { BlockModel, ConditionExpr, PieceRef, Statement } from './index';

/** A copy of the model in which every Piece use is what `change` makes of it. */
export function mapPieces(model: BlockModel, change: (ref: PieceRef) => PieceRef): BlockModel {
  const condition = (expr: ConditionExpr): ConditionExpr => {
    switch (expr.type) {
      case 'condition':
        return { type: 'condition', piece: change(expr.piece) };
      case 'and':
      case 'or':
        return { type: expr.type, left: condition(expr.left), right: condition(expr.right) };
      case 'not':
        return { type: 'not', condition: condition(expr.condition) };
    }
  };
  const statements = (list: Statement[]): Statement[] =>
    list.map((statement): Statement => {
      if (statement.type === 'action') return { type: 'action', piece: change(statement.piece) };
      return {
        type: 'if',
        branches: statement.branches.map((branch) => ({
          condition: condition(branch.condition),
          body: statements(branch.body),
        })),
        ...(statement.else && { else: statements(statement.else) }),
      };
    });
  return {
    ...model,
    slots: Object.fromEntries(
      Object.entries(model.slots).map(([slot, list]) => [slot, statements(list ?? [])]),
    ),
  };
}
