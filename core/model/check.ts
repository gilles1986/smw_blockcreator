// Checks a Block model against a Library: every Piece exists, is used as its kind, and every
// parameter value fits its type. The schema (./schema.ts) only checks the JSON structure.

import type { Library, ParamSpec } from '../library';
import type { Value } from '../template';
import type { BlockModel, PieceRef, Statement } from './index';

/** Problems as "slot path: message" lines; empty when the model can be edited and generated. */
export function checkPieces(model: BlockModel, library: Library): string[] {
  const problems: string[] = [];
  const piece = (ref: PieceRef, kind: 'action' | 'condition', where: string) => {
    const found = library.pieces.get(ref.id);
    if (!found) {
      problems.push(`${where}: Piece '${ref.id}' is not in the Library.`);
      return;
    }
    if (found.manifest.kind !== kind) {
      problems.push(
        `${where}: Piece '${ref.id}' is ${ARTICLE[found.manifest.kind]}, not ${ARTICLE[kind]}.`,
      );
      return;
    }
    for (const param of found.manifest.params) {
      const value = ref.params[param.name];
      const problem = value === undefined ? undefined : valueProblem(param, value);
      if (problem)
        problems.push(`${where}: '${param.name}' = ${JSON.stringify(value)} ${problem}.`);
    }
  };
  const statements = (list: Statement[], where: string) =>
    list.forEach((statement, i) => {
      const path = `${where}/${i}`;
      if (statement.type === 'action') return piece(statement.piece, 'action', path);
      statement.branches.forEach((branch, b) => {
        piece(branch.condition.piece, 'condition', `${path}/branches/${b}/condition`);
        statements(branch.body, `${path}/branches/${b}/body`);
      });
      if (statement.else) statements(statement.else, `${path}/else`);
    });
  for (const [slot, list] of Object.entries(model.slots)) statements(list ?? [], `${slot} `);
  return problems;
}

const ARTICLE = { action: 'an Action', condition: 'a Condition' } as const;

function valueProblem(param: ParamSpec, value: Value): string | undefined {
  const whole = (min: number, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  switch (param.type) {
    case 'map16':
      return whole(0, 0xffff) ? undefined : 'is not a valid Map16 number';
    case 'number': {
      const { min = 0, max = 0 } = param;
      return whole(min, max) ? undefined : `is not a whole number from ${min} to ${max}`;
    }
    case 'sprite':
    case 'sound':
      return whole(0, 0xff) ? undefined : 'is not a number from 0 to 255';
    case 'enum': {
      const values = (param.options ?? []).map((option) => option.value);
      return values.includes(value as number | string)
        ? undefined
        : `is not one of: ${values.join(', ')}`;
    }
    case 'bool':
      return typeof value === 'boolean' ? undefined : 'is not true or false';
    case 'text':
    case 'multiline':
      return typeof value === 'string' ? undefined : 'is not text';
  }
}
