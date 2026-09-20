// Checks a Block model against a Library: every Piece exists, is used as its kind, and every
// parameter value fits its type. The schema (./schema.ts) only checks the JSON structure.

import type { Library, ParamSpec } from '../library';
import type { Value } from '../template';
import {
  fitsSlot,
  SLOT_KIND_NAMES,
  slotKind,
  type BlockModel,
  type ConditionExpr,
  type PieceRef,
  type SlotId,
  type Statement,
} from './index';

export interface CheckOptions {
  /**
   * A Piece the Library does not have is not a problem: the editor keeps it as a placeholder
   * (ticket 16). Everything else about the Block is still checked.
   */
  allowMissing?: boolean;
}

/** Problems as "slot path: message" lines; empty when the model can be edited and generated. */
export function checkPieces(
  model: BlockModel,
  library: Library,
  { allowMissing = false }: CheckOptions = {},
): string[] {
  const problems: string[] = [];
  const piece = (ref: PieceRef, kind: 'action' | 'condition', slot: SlotId, where: string) => {
    const found = library.pieces.get(ref.id);
    if (!found) {
      if (!allowMissing) problems.push(`${where}: Piece '${ref.id}' is not in the Library.`);
      return;
    }
    if (found.manifest.kind !== kind) {
      problems.push(
        `${where}: Piece '${ref.id}' is ${ARTICLE[found.manifest.kind]}, not ${ARTICLE[kind]}.`,
      );
      return;
    }
    const { slots } = found.manifest;
    if (slots !== 'any' && !fitsSlot(slots, slotKind(slot))) {
      problems.push(`${where}: Piece '${ref.id}' only works in ${SLOT_KIND_NAMES[slots]} Slots.`);
      return;
    }
    for (const param of found.manifest.params) {
      const value = ref.params[param.name];
      const problem = value === undefined ? undefined : valueProblem(param, value);
      if (problem)
        problems.push(`${where}: '${param.name}' = ${JSON.stringify(value)} ${problem}.`);
    }
  };
  const condition = (expr: ConditionExpr, slot: SlotId, path: string): void => {
    switch (expr.type) {
      case 'condition':
        return piece(expr.piece, 'condition', slot, path);
      case 'and':
      case 'or':
        condition(expr.left, slot, `${path}/left`);
        return condition(expr.right, slot, `${path}/right`);
      case 'not':
        return condition(expr.condition, slot, `${path}/condition`);
    }
  };
  const statements = (list: Statement[], slot: SlotId, where: string) =>
    list.forEach((statement, i) => {
      const path = `${where}/${i}`;
      if (statement.type === 'action') return piece(statement.piece, 'action', slot, path);
      if (statement.type === 'atNeighbour') {
        statements(statement.body, slot, `${path}/body`);
        return;
      }
      statement.branches.forEach((branch, b) => {
        condition(branch.condition, slot, `${path}/branches/${b}/condition`);
        statements(branch.body, slot, `${path}/branches/${b}/body`);
      });
      if (statement.else) statements(statement.else, slot, `${path}/else`);
    });
  for (const [slot, list] of Object.entries(model.slots) as [SlotId, Statement[]][]) {
    statements(list, slot, `${slot} `);
  }
  if (model.slotLinks) {
    const reportedCycles = new Set<SlotId>();
    for (const [source, target] of Object.entries(model.slotLinks) as [SlotId, SlotId][]) {
      if (source === target) {
        problems.push(`slotLinks: Slot '${source}' cannot link to itself.`);
        continue;
      }
      if (slotKind(source) !== slotKind(target)) {
        problems.push(
          `slotLinks: Slot '${source}' (${SLOT_KIND_NAMES[slotKind(source)]}) cannot link to '${target}' (${SLOT_KIND_NAMES[slotKind(target)]}).`,
        );
      }
      const visited = [source];
      let curr: SlotId | undefined = target;
      while (curr && model.slotLinks[curr]) {
        const cycleIdx = visited.indexOf(curr);
        if (cycleIdx >= 0) {
          const cycleNodes = visited.slice(cycleIdx);
          if (!cycleNodes.some((node) => reportedCycles.has(node))) {
            problems.push(`slotLinks: Circular link detected involving Slot '${curr}'.`);
            cycleNodes.forEach((node) => reportedCycles.add(node));
          }
          break;
        }
        visited.push(curr);
        curr = model.slotLinks[curr];
      }
    }
  }
  return problems;
}

const ARTICLE = { action: 'an Action', condition: 'a Condition' } as const;

/** Why `value` does not fit `param` ("is not a whole number from 0 to 99"), or undefined if it does. */
export function valueProblem(param: ParamSpec, value: Value): string | undefined {
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
