// Test support: fast-check generators for valid Block models built from the seed Pieces.
import fc from 'fast-check';
import {
  SLOT_IDS,
  slotKind,
  type BlockModel,
  type ConditionExpr,
  type SlotKind,
  type Statement,
} from '../model';

const text = fc.string({ unit: 'binary', maxLength: 40 });

const actAs = fc.integer({ min: 0, max: 0xffff }).map((tile): Statement => ({
  type: 'action',
  piece: { id: 'act_as', version: 1, params: { tile } },
}));
const hurtMario = fc.constant<Statement>({
  type: 'action',
  piece: { id: 'hurt_mario', version: 2, params: { side_hitbox: false } },
});
const onOff = fc.constantFrom(0, 1).map((position): ConditionExpr => ({
  type: 'condition',
  piece: { id: 'c_onoff', version: 1, params: { position } },
}));

/** Conditions, also combined with AND / OR / NOT. */
const condition = fc.letrec<{ expr: ConditionExpr }>((tie) => ({
  // Shallow: AND / OR / NOT nest inside nested ifs, so deep trees would get huge.
  expr: fc.oneof(
    { maxDepth: 2, withCrossShrink: true },
    onOff,
    fc
      .record({
        type: fc.constantFrom('and' as const, 'or' as const),
        left: tie('expr'),
        right: tie('expr'),
      })
      .map((expr): ConditionExpr => expr),
    tie('expr').map((inner): ConditionExpr => ({ type: 'not', condition: inner })),
  ),
})).expr;

/** Statements valid in a Slot of the given kind (hurt_mario works in Mario Slots only). */
function statementsFor(kind: SlotKind): fc.Arbitrary<Statement[]> {
  const action = kind === 'mario' ? fc.oneof(actAs, hurtMario) : actAs;
  return fc.letrec<{ statements: Statement[]; statement: Statement }>((tie) => ({
    statements: fc.array(tie('statement'), { maxLength: 3 }),
    statement: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      action,
      fc
        .record({
          branches: fc.array(fc.record({ condition, body: tie('statements') }), {
            minLength: 1,
            maxLength: 3,
          }),
          else: fc.option(tie('statements'), { nil: undefined }),
        })
        .map(({ branches, else: otherwise }): Statement =>
          otherwise === undefined
            ? { type: 'if', branches }
            : { type: 'if', branches, else: otherwise },
        ),
    ),
  })).statements;
}

export const marioStatements = statementsFor('mario');
const spriteStatements = statementsFor('sprite');

export const model: fc.Arbitrary<BlockModel> = fc
  .record({
    properties: fc.record({
      name: text,
      description: text,
      author: text,
      defaultActAs: fc.integer({ min: 0, max: 0xffff }),
    }),
    slots: fc.record(
      Object.fromEntries(
        SLOT_IDS.map((slot) => [
          slot,
          slotKind(slot) === 'mario' ? marioStatements : spriteStatements,
        ]),
      ),
      { requiredKeys: [] },
    ),
    topCornerFollowsTop: fc.option(fc.boolean(), { nil: undefined }),
  })
  .map(({ topCornerFollowsTop, ...rest }) =>
    topCornerFollowsTop === undefined ? rest : { ...rest, topCornerFollowsTop },
  );
