// What a selection of several blocks copies, as data: no Blockly import, so it runs in tests
// without a DOM. A selected block takes what is inside it along (an `if` its Conditions and
// bodies, like Blockly's own copy), but not the blocks after it in its stack; those are only
// copied when they are selected too.

import type { BlockState, WorkspaceState } from './workspace';

interface Position {
  x: number;
  y: number;
}

/** The selected ids plus the id of every block inside the inputs of a selected block. */
export function withInputContents(
  state: WorkspaceState,
  selected: ReadonlySet<string>,
): Set<string> {
  const all = new Set(selected);
  const addInside = (block: BlockState): void => {
    for (const input of Object.values(block.inputs ?? {})) {
      for (let inner = input.block; inner; inner = inner.next?.block) {
        if (inner.id !== undefined) all.add(inner.id);
        addInside(inner);
      }
    }
  };
  const walk = (first: BlockState | undefined): void => {
    for (let block = first; block; block = block.next?.block) {
      if (block.id !== undefined && selected.has(block.id)) addInside(block);
      for (const input of Object.values(block.inputs ?? {})) walk(input.block);
    }
  };
  for (const top of state.blocks?.blocks ?? []) walk(top);
  return all;
}

/**
 * Stacks made of the selected blocks only, ready to paste: neighbours that are both selected stay
 * connected, a stack breaks where a block is left out, and a selected block inside an unselected
 * one becomes a stack of its own. Each stack starts where its first block was (`positionOf`, in
 * workspace coordinates; the position stored in the state when that has none), ids are dropped,
 * and the stacks come in reading order (top to bottom, then left to right).
 */
export function copyStacks(
  state: WorkspaceState,
  selected: ReadonlySet<string>,
  positionOf: (id: string) => Position | undefined,
): BlockState[] {
  const kept = withInputContents(state, selected);
  const roots = (state.blocks?.blocks ?? []).flatMap((top) => {
    const { head, others } = prune(top, kept);
    return head ? [head, ...others] : others;
  });
  return roots
    .map((root) => {
      const stored = { x: root.x ?? 0, y: root.y ?? 0 };
      return { root, at: (root.id !== undefined && positionOf(root.id)) || stored };
    })
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
    .map(({ root, at }) => {
      stripIds(root);
      return { ...root, x: at.x, y: at.y };
    });
}

/** The same stacks moved by (dx, dy); the stacks given are left as they are. */
export function offsetStacks(stacks: readonly BlockState[], dx: number, dy: number): BlockState[] {
  return stacks.map((stack) => ({ ...stack, x: (stack.x ?? 0) + dx, y: (stack.y ?? 0) + dy }));
}

/** The part of the workspace on screen, in workspace coordinates. */
export interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The stacks as they are while their top-left corner is in `view`; otherwise moved so that it
 * lands in the middle of `view`, keeping their layout (what Blockly's own paste does for a block
 * that was copied from out of sight).
 */
export function keepInView(stacks: readonly BlockState[], view: View): BlockState[] {
  if (stacks.length === 0) return [];
  const left = Math.min(...stacks.map((stack) => stack.x ?? 0));
  const top = Math.min(...stacks.map((stack) => stack.y ?? 0));
  const inView =
    left >= view.left &&
    left <= view.left + view.width &&
    top >= view.top &&
    top <= view.top + view.height;
  if (inView) return [...stacks];
  return offsetStacks(stacks, view.left + view.width / 2 - left, view.top + view.height / 2 - top);
}

interface Pruned {
  /** The run of kept blocks at the start of the chain, when its first block is kept. */
  head?: BlockState;
  /** Every other stack of kept blocks in the chain, its inputs and what hangs below them. */
  others: BlockState[];
}

/** Copies of the kept blocks in the chain starting at `first`, regrouped into stacks. */
function prune(first: BlockState | undefined, kept: ReadonlySet<string>): Pruned {
  const runs: BlockState[] = [];
  const others: BlockState[] = [];
  let tail: BlockState | undefined;
  let startsAtFirst = false;
  let index = 0;
  for (let block = first; block; block = block.next?.block, index++) {
    const copy = block.id !== undefined && kept.has(block.id) ? shell(block) : undefined;
    for (const [name, input] of Object.entries(block.inputs ?? {})) {
      const inside = prune(input.block, kept);
      if (copy && inside.head) copy.inputs = { ...copy.inputs, [name]: { block: inside.head } };
      else if (inside.head) others.push(inside.head);
      others.push(...inside.others);
    }
    if (!copy) {
      tail = undefined;
      continue;
    }
    if (tail) tail.next = { block: copy };
    else runs.push(copy);
    tail = copy;
    if (index === 0) startsAtFirst = true;
  }
  return startsAtFirst
    ? { head: runs[0], others: [...runs.slice(1), ...others] }
    : { others: [...runs, ...others] };
}

/** A deep copy of a block without its inputs and the blocks after it. */
function shell(block: BlockState): BlockState {
  const own = Object.entries(block).filter(([key]) => key !== 'next' && key !== 'inputs');
  return structuredClone(Object.fromEntries(own)) as BlockState;
}

/** Blockly gives pasted blocks ids of their own; the ones read from the workspace would clash. */
function stripIds(stack: BlockState): void {
  for (let block: BlockState | undefined = stack; block; block = block.next?.block) {
    delete block.id;
    for (const input of Object.values(block.inputs ?? {})) {
      if (input.block) stripIds(input.block);
    }
  }
}
