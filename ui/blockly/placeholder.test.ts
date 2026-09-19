// Ticket 16: a Piece the Library does not have stays in the editor as a grey placeholder that keeps
// its values, so the Block can be looked at, and saving is blocked until it is removed.
import { describe, expect, it } from 'vitest';
import type { BlockModel, Statement } from '../../core/model';
import { builtInLibrary } from '../../core/testing/library';
import {
  blockDefinitions,
  MISSING_ACTION_BLOCK,
  MISSING_CONDITION_BLOCK,
  missingBlockDefinitions,
  missingPieceParamsText,
} from './blocks';
import {
  blockIdsByPath,
  slotsToWorkspaces,
  statementsToWorkspace,
  workspaceProblems,
  workspaceToStatements,
  workspacesToSlots,
  type BlockState,
} from './workspace';

const library = builtInLibrary();

const actAs: Statement = {
  type: 'action',
  piece: { id: 'act_as', version: 1, params: { tile: 0x130 } },
};
const timeMachine: Statement = {
  type: 'action',
  piece: { id: 'time_machine', version: 3, params: { year: 1985, note: 'Great Scott' } },
};
const ifBackThen: Statement = {
  type: 'if',
  branches: [
    {
      condition: {
        type: 'and',
        left: { type: 'condition', piece: { id: 'c_flux', version: 1, params: { on: true } } },
        right: {
          type: 'condition',
          piece: { id: 'c_onoff', version: 1, params: { position: 0 } },
        },
      },
      body: [timeMachine, actAs],
    },
  ],
  else: [timeMachine],
};
const statements: Statement[] = [actAs, timeMachine, ifBackThen];

/** A block and the blocks chained below it. */
function chain(first: BlockState | undefined): BlockState[] {
  const blocks: BlockState[] = [];
  for (let block = first; block; block = block.next?.block) blocks.push(block);
  return blocks;
}

describe('missingPieceParamsText', () => {
  it('shows the values on one line, text quoted and cut at its first line', () => {
    expect(missingPieceParamsText({ a: 1, b: true, c: 'x y' })).toBe('a = 1, b = true, c = "x y"');
    expect(missingPieceParamsText({ code: 'LDA #$01\nSTA $02' })).toBe('code = "LDA #$01"…');
    expect(missingPieceParamsText({})).toBe('no values');
  });

  it('cuts a long line', () => {
    const text = missingPieceParamsText({ long: 'x'.repeat(300) });
    expect(text.length).toBeLessThanOrEqual(100);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('missingBlockDefinitions', () => {
  const [action, condition] = missingBlockDefinitions();

  it('are a statement block and a Condition block, grey, that say what they are', () => {
    expect(action).toMatchObject({ type: MISSING_ACTION_BLOCK, previousStatement: null });
    expect(condition).toMatchObject({ type: MISSING_CONDITION_BLOCK, output: 'Boolean' });
    expect(condition).not.toHaveProperty('previousStatement');
    for (const definition of [action, condition]) {
      expect(definition!.colour).toBe('#6b7075');
      expect(definition!.tooltip).toContain('not in your Library');
      expect(definition!.message0).toContain('Missing Piece');
    }
  });

  it('do not clash with the block of any Piece', () => {
    const types = new Set(blockDefinitions(library).map((definition) => definition.type));
    expect(types.has(MISSING_ACTION_BLOCK)).toBe(false);
    expect(types.has(MISSING_CONDITION_BLOCK)).toBe(false);
  });
});

describe('a Block with Pieces the Library does not have, in the editor', () => {
  it('shows each one as a placeholder with its name and values, an Action or a Condition', () => {
    const [top] = statementsToWorkspace(statements, library).blocks!.blocks;
    const [first, missing, ifBlock] = chain(top);
    expect(first).toMatchObject({ type: 'piece_act_as' });
    expect(missing).toMatchObject({
      type: MISSING_ACTION_BLOCK,
      fields: { ID: 'time_machine', PARAMS: 'year = 1985, note = "Great Scott"' },
    });
    const condition = ifBlock!.inputs!.IF0!.block!.inputs!.A!.block!;
    expect(condition).toMatchObject({
      type: MISSING_CONDITION_BLOCK,
      fields: { ID: 'c_flux', PARAMS: 'on = true' },
    });
  });

  it('keeps everything about the Piece, so the Block comes back the way it was', () => {
    const state = statementsToWorkspace(statements, library);
    expect(workspaceToStatements(state, library)).toEqual(statements);
    const slots: BlockModel['slots'] = { marioTop: statements, spriteLeft: [timeMachine] };
    expect(workspacesToSlots(slotsToWorkspaces(slots, library), library)).toEqual(slots);
  });

  it('blocks saving, saying which Pieces are missing, until the placeholders are gone', () => {
    const state = statementsToWorkspace(statements, library);
    expect(workspaceProblems(state, library)).toEqual([
      "Piece 'time_machine' is not in the Library.",
      "Piece 'c_flux' is not in the Library.",
    ]);
    expect(workspaceProblems(statementsToWorkspace([actAs], library), library)).toEqual([]);
  });

  it('says so when the Piece has come into the Library since the Block was opened', () => {
    const state = statementsToWorkspace([timeMachine], library);
    const later = {
      ...library,
      pieces: new Map([...library.pieces, ['time_machine', library.pieces.get('act_as')!]]),
    };
    expect(workspaceProblems(state, later)).toEqual([
      "Piece 'time_machine' is in the Library now: open the Block again to use it.",
    ]);
  });

  it('finds the block of a placeholder by the statement path, for error messages', () => {
    const state = statementsToWorkspace([timeMachine], library);
    state.blocks!.blocks[0]!.id = 'gone';
    expect(blockIdsByPath(state, library).get('/0')).toBe('gone');
  });

  it('drops a placeholder whose data was damaged, and tells the user', () => {
    const state = statementsToWorkspace([timeMachine], library);
    state.blocks!.blocks[0]!.data = '{"nope"';
    expect(workspaceToStatements(state, library)).toEqual([]);
    expect(workspaceProblems(state, library)).toEqual([
      'A placeholder for a missing Piece lost its data.',
    ]);
  });
});
