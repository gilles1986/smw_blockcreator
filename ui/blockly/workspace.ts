// Adapter between Blockly's workspace serialisation (JSON) and the Block model's statements.
// Pure data: no Blockly import, so it runs in tests without a DOM.

import type { Library } from '../../core/library';
import type { BlockModel, Branch, PieceRef, SlotId, Statement } from '../../core/model';
import type { Value } from '../../core/template';
import { pieceIdOf } from './blocks';
import { fieldCodec } from './fields';
import { IF_BLOCK } from './toolbox';

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
  const tops = [...(state.blocks?.blocks ?? [])].sort(
    (a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0),
  );
  return tops.flatMap((top) => stack(top, library));
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
    const conditionBlock = input(`IF${i}`);
    const piece = conditionBlock && pieceRef(conditionBlock, library, 'condition');
    if (!piece) continue;
    branches.push({
      condition: { type: 'condition', piece },
      body: stack(input(`DO${i}`), library),
    });
  }
  if (branches.length === 0) return undefined;
  if (!block.extraState?.hasElse) return { type: 'if', branches };
  return { type: 'if', branches, else: stack(input('ELSE'), library) };
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
  return { id: piece.manifest.id, version: piece.manifest.version, params };
}
