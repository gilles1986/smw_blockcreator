// Hides the rows of a Piece block that its manifest hides for now (`showWhen`): the extra bytes of
// a sprite while it is not custom, the offset while the position is not "offset". The value of a
// hidden row stays in the block and is still used.

import * as Blockly from 'blockly';
import type { VisibilityRule } from './blocks';

let rulesByBlock = new Map<string, VisibilityRule[]>();

export function setVisibilityRules(rules: readonly VisibilityRule[]): void {
  rulesByBlock = new Map();
  for (const rule of rules) {
    rulesByBlock.set(rule.blockType, [...(rulesByBlock.get(rule.blockType) ?? []), rule]);
  }
}

/** Shows or hides the rows of one block as its fields now say. */
export function applyVisibility(block: Blockly.Block): void {
  let changed = false;
  for (const rule of rulesByBlock.get(block.type) ?? []) {
    const input = block.inputList[rule.row];
    if (!input) continue;
    const shown = String(block.getFieldValue(rule.control)) === String(rule.shownWhen);
    if (input.isVisible() !== shown) {
      input.setVisible(shown);
      changed = true;
    }
  }
  if (changed && (block as any).rendered) {
    let current: Blockly.Block | null = block;
    while (current) {
      if (typeof (current as any).render === 'function') {
        (current as any).render();
      }
      current = current.getParent();
    }
  }
}

/** Applies the rules to every block of a workspace, e.g. after a Slot was loaded into it. */
export function refreshVisibility(workspace: Blockly.Workspace): void {
  for (const block of workspace.getAllBlocks(false)) applyVisibility(block);
}

/**
 * Keeps the rows right while the user works: a field of a block changed, or blocks were created
 * (pasted, dragged out of the toolbox) with values of their own. Returns the function that stops it.
 */
export function watchVisibility(workspace: Blockly.Workspace): () => void {
  const listener = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.BLOCK_CHANGE) {
      const id = (event as Blockly.Events.BlockChange).blockId;
      const block = id === undefined ? undefined : workspace.getBlockById(id);
      if (block) applyVisibility(block);
    } else if (event.type === Blockly.Events.BLOCK_CREATE) {
      for (const id of (event as Blockly.Events.BlockCreate).ids ?? []) {
        const block = workspace.getBlockById(id);
        if (block) applyVisibility(block);
      }
    }
  };
  workspace.addChangeListener(listener);
  return () => workspace.removeChangeListener(listener);
}
