// The warning for one-shot Actions. A Slot's code runs every frame something touches the Block,
// so an Action that should happen once (a sound, a coin, a spawned sprite) repeats every frame
// unless the same branch also removes or changes the Block: then it is gone after the first run.

import type { Library, Piece } from '../core/library';
import { pieceIdOf } from './blockly/blocks';
import { AT_NEIGHBOUR_BLOCK, IF_BLOCK } from './blockly/toolbox';
import type { BlockState, WorkspaceState } from './blockly/workspace';

export const ONCE_WARNING =
  'Runs again every frame the block is touched. Put an action in the same branch that removes or changes the block (Erase block, Shatter, Change to tile).';

/** The branches of an `if` block: its bodies and the `else`. */
const BRANCH_INPUT = /^(DO\d+|ELSE)$/;

/**
 * Block id → warning for each `once` Piece block whose branch has no `removesBlock` Piece. A
 * branch is one statement list: the top of a Slot, or the body of an `if` / `else if` / `else`.
 */
export function onceWarnings(workspace: WorkspaceState, library: Library): Map<string, string> {
  const warnings = new Map<string, string>();
  const pieceOf = (block: BlockState): Piece | undefined => {
    const id = pieceIdOf(block.type);
    return id === undefined ? undefined : library.pieces.get(id);
  };
  const visit = (first: BlockState | undefined) => {
    const branch: BlockState[] = [];
    for (let block = first; block; block = block.next?.block) branch.push(block);
    const removes = branch.some((block) => pieceOf(block)?.manifest.removesBlock);
    for (const block of branch) {
      if (block.type === IF_BLOCK) {
        for (const [name, input] of Object.entries(block.inputs ?? {})) {
          if (BRANCH_INPUT.test(name)) visit(input.block);
        }
      } else if (block.type === AT_NEIGHBOUR_BLOCK) {
        if (block.inputs?.DO?.block) visit(block.inputs.DO.block);
      } else if (!removes && block.id !== undefined && pieceOf(block)?.manifest.once) {
        warnings.set(block.id, ONCE_WARNING);
      }
    }
  };
  for (const top of workspace.blocks?.blocks ?? []) visit(top);
  return warnings;
}
