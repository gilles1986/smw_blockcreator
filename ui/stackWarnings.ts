// A Slot's stacks run one after the other, top to bottom by where they are on the canvas. A second
// stack is easy to make by accident (a block dropped a little too far from the first), and then it
// runs after the first, not instead of it: say so on the block that starts it.

import type { Library } from '../core/library';
import { MISSING_ACTION_BLOCK, pieceIdOf } from './blockly/blocks';
import { IF_BLOCK } from './blockly/toolbox';
import { sortedTops, type BlockState, type WorkspaceState } from './blockly/workspace';

export const STACK_WARNING =
  'This stack runs after the stack above it: a Slot runs its stacks from top to bottom, all of them.';

/**
 * Block id → warning, for the first block of every stack after the first. Only stacks of statements
 * count: a Condition block on its own is not a stack (it is reported as unattached).
 */
export function stackWarnings(state: WorkspaceState, library: Library): Map<string, string> {
  const warnings = new Map<string, string>();
  for (const block of sortedTops(state)
    .filter((top) => isStatement(top, library))
    .slice(1)) {
    if (block.id !== undefined) warnings.set(block.id, STACK_WARNING);
  }
  return warnings;
}

/** An `if`, an Action, or the placeholder of an Action: what a stack is made of. */
function isStatement(block: BlockState, library: Library): boolean {
  if (block.type === IF_BLOCK || block.type === MISSING_ACTION_BLOCK) return true;
  const id = pieceIdOf(block.type);
  return id !== undefined && library.pieces.get(id)?.manifest.kind !== 'condition';
}
