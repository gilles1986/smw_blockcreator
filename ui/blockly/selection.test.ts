import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../../core/testing/library';
import { copyStacks, keepInView, offsetStacks, withInputContents } from './selection';
import { workspaceToStatements, type BlockState, type WorkspaceState } from './workspace';

const library = builtInLibrary();

// Copies lose their ids, so each block also carries its name in `data` (Blockly's free-form
// string, kept by copies) for the tests to tell them apart.
const actAs = (id: string, tile = '025', next?: BlockState): BlockState => ({
  type: 'piece_act_as',
  id,
  fields: { tile },
  data: id,
  ...(next && { next: { block: next } }),
});

/**
 * Left: a → b → c.  Right: an if (condition, body d → e, else-if count 1) followed by f.
 * Only structure matters to the selection; the Pieces are real so the copies can be read back.
 */
const left: BlockState = {
  ...actAs('a', '025', actAs('b', '030', actAs('c', '1F0'))),
  x: 10,
  y: 20,
};
const right: BlockState = {
  type: 'controls_if',
  id: 'if1',
  data: 'if1',
  x: 200,
  y: 20,
  extraState: { elseIfCount: 1 },
  inputs: {
    IF0: { block: { type: 'piece_c_onoff', id: 'cond', data: 'cond', fields: { position: '1' } } },
    DO0: { block: actAs('d', '025', actAs('e', '030')) },
  },
  next: { block: actAs('f') },
};
const state: WorkspaceState = { blocks: { languageVersion: 0, blocks: [left, right] } };

const at: Record<string, { x: number; y: number }> = {
  a: { x: 10, y: 20 },
  b: { x: 10, y: 60 },
  c: { x: 10, y: 100 },
  if1: { x: 200, y: 20 },
  d: { x: 230, y: 60 },
  cond: { x: 240, y: 25 },
  f: { x: 200, y: 200 },
};
const positionOf = (id: string) => at[id];

/** Name of every block in a stack, following inputs, in a compact form for comparing. */
function outline(block: BlockState | undefined): string {
  if (!block) return '';
  const inputs = Object.entries(block.inputs ?? {})
    .map(([name, input]) => `${name}:[${outline(input.block)}]`)
    .join('');
  const own = `${block.data ?? '?'}${inputs ? `{${inputs}}` : ''}`;
  return block.next?.block ? `${own}>${outline(block.next.block)}` : own;
}
const stacks = (selected: string[]) =>
  copyStacks(state, new Set(selected), positionOf).map((stack) => outline(stack));

describe('withInputContents', () => {
  it('adds what is inside a selected block, but not the blocks after it', () => {
    expect(withInputContents(state, new Set(['if1']))).toEqual(new Set(['if1', 'cond', 'd', 'e']));
  });

  it('leaves the selection as it is for blocks without inputs', () => {
    expect(withInputContents(state, new Set(['a', 'c']))).toEqual(new Set(['a', 'c']));
  });
});

describe('copyStacks', () => {
  it('copies a single block without the blocks after it', () => {
    expect(stacks(['a'])).toEqual(['a']);
  });

  it('keeps selected neighbours together, in order', () => {
    expect(stacks(['b', 'a'])).toEqual(['a>b']);
  });

  it('splits a stack where a block is left out', () => {
    expect(stacks(['a', 'c'])).toEqual(['a', 'c']);
  });

  it('takes the Condition and the bodies of a selected if along, but not the block after it', () => {
    expect(stacks(['if1'])).toEqual(['if1{IF0:[cond]DO0:[d>e]}']);
  });

  it('copies a selected if together with the block after it when both are selected', () => {
    expect(stacks(['if1', 'f'])).toEqual(['if1{IF0:[cond]DO0:[d>e]}>f']);
  });

  it('makes a stack of its own from blocks inside an if that is not selected', () => {
    expect(stacks(['d'])).toEqual(['d']);
    expect(stacks(['d', 'e'])).toEqual(['d>e']);
  });

  it('copies a Condition without its if as a loose block', () => {
    expect(stacks(['cond'])).toEqual(['cond']);
  });

  it('starts each stack where its first block was, and drops the ids', () => {
    const copies = copyStacks(state, new Set(['b', 'c', 'f']), positionOf);
    expect(copies.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 10, y: 60 },
      { x: 200, y: 200 },
    ]);
    expect(JSON.stringify(copies)).not.toContain('"id"');
  });

  it('lists stacks in reading order whatever the order of the selection', () => {
    // Top to bottom, then left to right, like the Slot's statements are read.
    expect(stacks(['f', 'c', 'a', 'if1'])).toEqual(['a', 'if1{IF0:[cond]DO0:[d>e]}>f', 'c']);
  });

  it('keeps fields, data and extra state of the blocks', () => {
    const [copy] = copyStacks(state, new Set(['if1']), positionOf);
    expect(copy).toMatchObject({
      type: 'controls_if',
      extraState: { elseIfCount: 1 },
      inputs: { IF0: { block: { fields: { position: '1' } } } },
    });
    expect(copyStacks(state, new Set(['b']), positionOf)[0]).toMatchObject({
      type: 'piece_act_as',
      fields: { tile: '030' },
      data: 'b',
    });
  });

  it('has nothing for an empty selection or ids that are not there', () => {
    expect(copyStacks(state, new Set(), positionOf)).toEqual([]);
    expect(copyStacks(state, new Set(['nope']), positionOf)).toEqual([]);
  });

  it('does not change the workspace state it reads', () => {
    const before = JSON.stringify(state);
    copyStacks(state, new Set(['a', 'c', 'if1']), positionOf);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('falls back to the position stored in the state when none is given', () => {
    const [copy] = copyStacks(state, new Set(['a']), () => undefined);
    expect(copy).toMatchObject({ x: 10, y: 20 });
  });

  it('gives copies of Pieces that read back as the same statements', () => {
    const blocks = copyStacks(state, new Set(['a', 'b']), positionOf);
    const statements = workspaceToStatements({ blocks: { languageVersion: 0, blocks } }, library);
    expect(statements.map((s) => (s.type === 'action' ? s.piece.params.tile : undefined))).toEqual([
      0x25, 0x30,
    ]);
  });
});

describe('keepInView', () => {
  const view = { left: 0, top: 0, width: 400, height: 300 };
  const two = copyStacks(state, new Set(['a', 'f']), positionOf); // (10, 20) and (200, 200)

  it('leaves stacks alone when their top-left corner is in view', () => {
    expect(keepInView(two, view)).toEqual(two);
  });

  it('moves stacks that are out of view to the middle, keeping their layout', () => {
    const away = offsetStacks(two, 1000, 800);
    const moved = keepInView(away, view);
    expect(moved.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 200, y: 150 },
      { x: 390, y: 330 },
    ]);
  });

  it('treats the view as it is scrolled to, not only the origin', () => {
    const scrolled = { left: 500, top: 500, width: 400, height: 300 };
    const [first] = keepInView(two, scrolled);
    expect(first).toMatchObject({ x: 700, y: 650 });
  });

  it('does not change the stacks it is given', () => {
    const before = JSON.stringify(two);
    keepInView(offsetStacks(two, 1000, 800), view);
    expect(JSON.stringify(two)).toBe(before);
  });

  it('has nothing to move for no stacks', () => {
    expect(keepInView([], view)).toEqual([]);
  });
});

describe('offsetStacks', () => {
  it('moves every stack by the same amount without touching the originals', () => {
    const originals = copyStacks(state, new Set(['a', 'f']), positionOf);
    const before = JSON.stringify(originals);
    expect(offsetStacks(originals, 30, 40).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 40, y: 60 },
      { x: 230, y: 240 },
    ]);
    expect(JSON.stringify(originals)).toBe(before);
  });
});
