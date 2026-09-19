import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../core/testing/library';
import type { BlockState, WorkspaceState } from './blockly/workspace';
import { STACK_WARNING, stackWarnings } from './stackWarnings';

const library = builtInLibrary();
const act = (id: string, x: number, y: number): BlockState => ({
  type: 'piece_act_as',
  id,
  x,
  y,
  fields: { tile: '130' },
});
const state = (...blocks: BlockState[]): WorkspaceState => ({
  blocks: { languageVersion: 0, blocks },
});

describe('stackWarnings', () => {
  it('has none for a Slot with one stack, or nothing', () => {
    expect(stackWarnings(state(act('a', 0, 0)), library).size).toBe(0);
    expect(stackWarnings({}, library).size).toBe(0);
  });

  it('puts a warning on the top block of every stack after the first, top to bottom', () => {
    const warnings = stackWarnings(
      state(act('low', 0, 200), act('high', 0, 0), act('mid', 0, 100)),
      library,
    );
    expect([...warnings.keys()]).toEqual(['mid', 'low']);
    expect(warnings.get('mid')).toBe(STACK_WARNING);
  });

  it('reads stacks on the same height from left to right, like the generator does', () => {
    const warnings = stackWarnings(state(act('right', 300, 0), act('left', 0, 0)), library);
    expect([...warnings.keys()]).toEqual(['right']);
  });

  it('counts an if as a stack, and leaves a loose Condition out', () => {
    const rule: BlockState = { type: 'controls_if', id: 'if', x: 0, y: 100 };
    const loose: BlockState = { type: 'piece_c_onoff', id: 'c', x: 0, y: 50 };
    expect([...stackWarnings(state(act('a', 0, 0), loose, rule), library).keys()]).toEqual(['if']);
    expect(stackWarnings(state(loose, act('a', 0, 0)), library).size).toBe(0);
  });

  it('counts the placeholder of a missing Piece as a statement', () => {
    const missing: BlockState = { type: 'missing_piece_action', id: 'm', x: 0, y: 100 };
    expect([...stackWarnings(state(act('a', 0, 0), missing), library).keys()]).toEqual(['m']);
  });

  it('skips a block without an id: there is nowhere to put the warning', () => {
    const anonymous: BlockState = { type: 'piece_act_as', x: 0, y: 100 };
    expect(stackWarnings(state(act('a', 0, 0), anonymous), library).size).toBe(0);
  });
});
