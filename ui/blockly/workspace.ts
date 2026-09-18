// Adapter between Blockly's workspace serialisation (JSON) and the Block model's statements.
// Pure data: no Blockly import, so it runs in tests without a DOM.

import type { Library } from '../../core/library';
import type {
  BlockModel,
  Branch,
  ConditionExpr,
  PieceRef,
  SlotId,
  Statement,
} from '../../core/model';
import type { Value } from '../../core/template';
import { pieceBlockType, pieceIdOf } from './blocks';
import { fieldCodec } from './fields';
import { AND_OR_BLOCK, AND_OR_INPUTS, IF_BLOCK, NOT_BLOCK, NOT_INPUT } from './toolbox';

/** The subset of `Blockly.serialization.workspaces.save()` output the adapter reads and writes. */
export interface WorkspaceState {
  blocks?: { languageVersion: number; blocks: BlockState[] };
}

export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  /** Blockly's free-form string per block; Piece blocks keep the Piece version they were made with. */
  data?: string;
  inputs?: Record<string, { block?: BlockState }>;
  next?: { block?: BlockState };
  extraState?: { elseIfCount?: number; hasElse?: boolean };
}

/** The model's Slots from one Blockly workspace per Slot; Slots without statements are left out. */
export function workspacesToSlots(
  workspaces: Partial<Record<SlotId, WorkspaceState>>,
  library: Library,
): BlockModel['slots'] {
  return Object.fromEntries(
    Object.entries(workspaces)
      .map(([slot, state]) => [slot, workspaceToStatements(state, library)] as const)
      .filter(([, statements]) => statements.length > 0),
  );
}

/**
 * Statements of one Slot. Top-level stacks run top to bottom (then left to right); loose Condition
 * blocks and `if` branches without a Condition are left out, as they are still being edited.
 */
export function workspaceToStatements(state: WorkspaceState, library: Library): Statement[] {
  return sortedTops(state).flatMap((top) => stack(top, library));
}

/** Top-level stacks in reading order: top to bottom, then left to right. */
function sortedTops(state: WorkspaceState): BlockState[] {
  return [...(state.blocks?.blocks ?? [])].sort(
    (a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0),
  );
}

/** A block and every block chained below it. */
function stack(first: BlockState | undefined, library: Library): Statement[] {
  const statements: Statement[] = [];
  for (let block = first; block; block = block.next?.block) {
    const statement = toStatement(block, library);
    if (statement) statements.push(statement);
  }
  return statements;
}

function toStatement(block: BlockState, library: Library): Statement | undefined {
  if (block.type === IF_BLOCK) return ifStatement(block, library);
  const piece = pieceRef(block, library, 'action');
  return piece && { type: 'action', piece };
}

function ifStatement(block: BlockState, library: Library): Statement | undefined {
  const input = (name: string) => block.inputs?.[name]?.block;
  const branches: Branch[] = [];
  for (let i = 0; i <= (block.extraState?.elseIfCount ?? 0); i++) {
    const condition = conditionExpr(input(`IF${i}`), library);
    if (!condition) continue;
    branches.push({ condition, body: stack(input(`DO${i}`), library) });
  }
  if (branches.length === 0) return undefined;
  if (!block.extraState?.hasElse) return { type: 'if', branches };
  return { type: 'if', branches, else: stack(input('ELSE'), library) };
}

/** A Condition block, or AND / OR / NOT over them; undefined while any part is missing. */
function conditionExpr(block: BlockState | undefined, library: Library): ConditionExpr | undefined {
  if (!block) return undefined;
  const input = (name: string) => conditionExpr(block.inputs?.[name]?.block, library);
  if (block.type === AND_OR_BLOCK) {
    const [left, right] = AND_OR_INPUTS.map(input);
    if (!left || !right) return undefined;
    return { type: block.fields?.OP === 'OR' ? 'or' : 'and', left, right };
  }
  if (block.type === NOT_BLOCK) {
    const condition = input(NOT_INPUT);
    return condition && { type: 'not', condition };
  }
  const piece = pieceRef(block, library, 'condition');
  return piece && { type: 'condition', piece };
}

function pieceRef(
  block: BlockState,
  library: Library,
  kind: 'action' | 'condition',
): PieceRef | undefined {
  const id = pieceIdOf(block.type);
  const piece = id === undefined ? undefined : library.pieces.get(id);
  if (!piece || piece.manifest.kind !== kind) return undefined;
  const params: Record<string, Value> = {};
  for (const param of piece.manifest.params) {
    const raw = block.fields?.[param.name];
    params[param.name] =
      (raw === undefined ? undefined : fieldCodec(param).fromField(raw)) ?? param.default;
  }
  const recorded = Number(block.data);
  const version = Number.isInteger(recorded) && recorded >= 1 ? recorded : piece.manifest.version;
  return { id: piece.manifest.id, version, params };
}

/** The workspace for a Slot's statements: one stack, top left (for opening a saved Block). */
export function statementsToWorkspace(statements: Statement[], library: Library): WorkspaceState {
  const first = chain(statements, library);
  return { blocks: { languageVersion: 0, blocks: first ? [{ ...first, x: 20, y: 20 }] : [] } };
}

function chain(statements: Statement[], library: Library): BlockState | undefined {
  return statements.reduceRight<BlockState | undefined>((next, statement) => {
    const block = toBlock(statement, library);
    return next ? { ...block, next: { block: next } } : block;
  }, undefined);
}

function toBlock(statement: Statement, library: Library): BlockState {
  if (statement.type === 'action') return pieceBlock(statement.piece, library);
  const inputs: NonNullable<BlockState['inputs']> = {};
  statement.branches.forEach((branch, i) => {
    inputs[`IF${i}`] = { block: conditionBlock(branch.condition, library) };
    const body = chain(branch.body, library);
    if (body) inputs[`DO${i}`] = { block: body };
  });
  const otherwise = statement.else && chain(statement.else, library);
  if (otherwise) inputs.ELSE = { block: otherwise };
  const elseIfCount = statement.branches.length - 1;
  return {
    type: IF_BLOCK,
    extraState: {
      ...(elseIfCount > 0 && { elseIfCount }),
      ...(statement.else && { hasElse: true }),
    },
    inputs,
  };
}

function conditionBlock(expr: ConditionExpr, library: Library): BlockState {
  switch (expr.type) {
    case 'condition':
      return pieceBlock(expr.piece, library);
    case 'and':
    case 'or':
      return {
        type: AND_OR_BLOCK,
        fields: { OP: expr.type.toUpperCase() },
        inputs: {
          [AND_OR_INPUTS[0]]: { block: conditionBlock(expr.left, library) },
          [AND_OR_INPUTS[1]]: { block: conditionBlock(expr.right, library) },
        },
      };
    case 'not':
      return {
        type: NOT_BLOCK,
        inputs: { [NOT_INPUT]: { block: conditionBlock(expr.condition, library) } },
      };
  }
}

function pieceBlock(ref: PieceRef, library: Library): BlockState {
  const params = library.pieces.get(ref.id)?.manifest.params ?? [];
  const fields = Object.fromEntries(
    params
      .filter((param) => ref.params[param.name] !== undefined)
      .map((param) => [param.name, fieldCodec(param).toField(ref.params[param.name]!)]),
  );
  return { type: pieceBlockType(ref.id), fields, data: String(ref.version) };
}

/**
 * What `workspaceToStatements` would leave out, as messages for the user: saving is blocked
 * until they are fixed, so no logic is lost silently.
 */
export function workspaceProblems(state: WorkspaceState, library: Library): string[] {
  const problems = new Set<string>();
  const visit = (block: BlockState | undefined, topLevel: boolean) => {
    for (let current = block; current; current = current.next?.block, topLevel = false) {
      const id = pieceIdOf(current.type);
      const piece = id === undefined ? undefined : library.pieces.get(id);
      if (id !== undefined && !piece) problems.add(`Piece '${id}' is not in the Library.`);
      const logic = current.type === AND_OR_BLOCK || current.type === NOT_BLOCK;
      const isCondition = logic || piece?.manifest.kind === 'condition';
      if (topLevel && isCondition) problems.add('A Condition is not attached to an if.');
      const operands: readonly string[] =
        current.type === AND_OR_BLOCK ? AND_OR_INPUTS : logic ? [NOT_INPUT] : [];
      if (operands.some((name) => !current.inputs?.[name]?.block)) {
        problems.add('An AND / OR / NOT is missing a Condition.');
      }
      if (current.type === IF_BLOCK) {
        for (let i = 0; i <= (current.extraState?.elseIfCount ?? 0); i++) {
          if (!current.inputs?.[`IF${i}`]?.block) {
            problems.add('An if has a branch without a Condition.');
          }
        }
      }
      for (const input of Object.values(current.inputs ?? {})) visit(input.block, false);
    }
  };
  for (const top of sortedTops(state)) visit(top, true);
  return [...problems];
}

/** One workspace per filled Slot, for opening a saved Block (inverse of `workspacesToSlots`). */
export function slotsToWorkspaces(
  slots: BlockModel['slots'],
  library: Library,
): Partial<Record<SlotId, WorkspaceState>> {
  return Object.fromEntries(
    Object.entries(slots).map(([slot, statements]) => [
      slot,
      statementsToWorkspace(statements ?? [], library),
    ]),
  );
}
