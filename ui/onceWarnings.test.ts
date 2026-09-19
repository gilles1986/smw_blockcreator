import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../core/testing/library';
import type { BlockState, WorkspaceState } from './blockly/workspace';
import { ONCE_WARNING, onceWarnings } from './onceWarnings';

const library = builtInLibrary();

/** A Piece block, followed by the blocks after it. */
const piece = (id: string, blockId: string, ...after: BlockState[]): BlockState => {
  const [next, ...rest] = after;
  return {
    type: `piece_${id}`,
    id: blockId,
    ...(next && { next: { block: piece(next.type.slice(6), next.id!, ...rest) } }),
  };
};
const state = (...blocks: BlockState[]): WorkspaceState => ({
  blocks: { languageVersion: 0, blocks },
});
const ifBlock = (body?: BlockState, elseBody?: BlockState, next?: BlockState): BlockState => ({
  type: 'controls_if',
  id: 'if',
  extraState: { hasElse: true },
  inputs: {
    IF0: { block: { type: 'piece_c_onoff', id: 'cond' } },
    ...(body && { DO0: { block: body } }),
    ...(elseBody && { ELSE: { block: elseBody } }),
  },
  ...(next && { next: { block: next } }),
});
const warned = (workspace: WorkspaceState) => [...onceWarnings(workspace, library).keys()].sort();

describe('onceWarnings', () => {
  it('warns about a one-shot Action that nothing removes', () => {
    const warnings = onceWarnings(state(piece('play_sound', 'sound')), library);
    expect(warnings).toEqual(new Map([['sound', ONCE_WARNING]]));
  });

  it('is content once the branch removes or changes the block, before or after', () => {
    expect(warned(state(piece('play_sound', 'sound', piece('erase_block', 'erase'))))).toEqual([]);
    expect(warned(state(piece('erase_block', 'erase', piece('play_sound', 'sound'))))).toEqual([]);
    expect(warned(state(piece('give_coins', 'coins', piece('change_to_tile', 'change'))))).toEqual(
      [],
    );
  });

  it('leaves Actions that may repeat, and Actions that are not Pieces, alone', () => {
    expect(warned(state(piece('act_as', 'act', piece('hurt_mario', 'hurt'))))).toEqual([]);
    expect(warned(state({ type: 'unknown_block', id: 'x' }))).toEqual([]);
    // No id, nothing to put the warning on.
    expect(warned(state({ type: 'piece_play_sound' }))).toEqual([]);
  });

  it('looks at each branch of an if on its own', () => {
    const inIf = state(
      ifBlock(
        piece('play_sound', 'in_body', piece('erase_block', 'erase')),
        piece('give_coins', 'in_else'),
      ),
    );
    expect(warned(inIf)).toEqual(['in_else']);
  });

  it('does not let a remover after the if cover what is inside it', () => {
    const outer = state(
      ifBlock(piece('play_sound', 'inside'), undefined, piece('erase_block', 'erase')),
    );
    expect(warned(outer)).toEqual(['inside']);
  });

  it('warns about Actions in every Slot stack of the workspace', () => {
    expect(warned(state(piece('play_sound', 'a'), piece('give_coins', 'b')))).toEqual(['a', 'b']);
  });

  it('warns about every one-shot Piece of the Library that has nothing to remove the block', () => {
    const once = [...library.pieces.values()].filter((p) => p.manifest.once);
    expect(once.length).toBeGreaterThan(5);
    for (const { manifest } of once) {
      const alone = warned(state(piece(manifest.id, 'only')));
      expect(alone, manifest.id).toEqual(manifest.removesBlock ? [] : ['only']);
    }
  });
});
