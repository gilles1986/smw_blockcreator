// Test support: fast-check generators for valid Block models built from the seed Pieces.
import fc from 'fast-check';
import { SLOT_IDS, type BlockModel, type Statement } from '../model';

const text = fc.string({ unit: 'binary', maxLength: 40 });

const action: fc.Arbitrary<Statement> = fc.oneof(
  fc.integer({ min: 0, max: 0xffff }).map((tile): Statement => ({
    type: 'action',
    piece: { id: 'act_as', version: 1, params: { tile } },
  })),
  fc.constant<Statement>({ type: 'action', piece: { id: 'hurt_mario', version: 1, params: {} } }),
);
const condition = fc.constantFrom(0, 1).map((position) => ({
  type: 'condition' as const,
  piece: { id: 'c_onoff', version: 1, params: { position } },
}));

export const { statements } = fc.letrec<{ statements: Statement[]; statement: Statement }>(
  (tie) => ({
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
  }),
);

export const model: fc.Arbitrary<BlockModel> = fc.record({
  properties: fc.record({
    name: text,
    description: text,
    author: text,
    defaultActAs: fc.integer({ min: 0, max: 0xffff }),
  }),
  slots: fc.record(Object.fromEntries(SLOT_IDS.map((slot) => [slot, statements])), {
    requiredKeys: [],
  }),
});
