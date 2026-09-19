import { describe, expect, it } from 'vitest';
import { BLOCK_FILE, mapAsarMessages, type CheckProblem } from '../core/assemble';
import { generate } from '../core/generator';
import type { BlockModel } from '../core/model';
import { builtInLibrary } from '../core/testing/library';
import { slotsToWorkspaces, type WorkspaceState } from './blockly/workspace';
import {
  blockWarnings,
  checkNotice,
  problemPieceName,
  saveVerdict,
  slotsWithProblems,
  type CheckOutcome,
} from './checkView';

const library = builtInLibrary();

const workspace: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'piece_act_as',
        id: 'first',
        next: { block: { type: 'piece_hurt_mario', id: 'second' } },
      },
    ],
  },
};

const problems: CheckProblem[] = [
  { message: 'Unknown command.', line: 20, origin: { slot: 'marioTop', path: '/1' } },
  { message: 'Label bc2_x not found.', line: 21, origin: { slot: 'marioTop', path: '/1' } },
  { message: 'Bad value.', line: 30, origin: { slot: 'spriteLeft', path: '/0' } },
  { message: 'defines.asm line 7: Broken define.' },
];

describe('slotsWithProblems', () => {
  it('lists each Slot that an Asar error points into', () => {
    expect(slotsWithProblems(problems)).toEqual(new Set(['marioTop', 'spriteLeft']));
  });
});

describe('an Asar error in generated code', () => {
  it('ends up as a warning on the Custom ASM block that produced the line', () => {
    const slots: BlockModel['slots'] = {
      marioTop: [
        { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
        { type: 'action', piece: { id: 'custom_asm', version: 1, params: { code: 'LDAX #$30' } } },
      ],
    };
    const { text, lineMap } = generate(
      { properties: { name: 'x', description: '', author: '', defaultActAs: 0x130 }, slots },
      library,
    );
    const line = text.split('\n').indexOf('\tLDAX #$30') + 1;
    const [problem] = mapAsarMessages(
      [{ file: BLOCK_FILE, line, message: 'Unknown command.' }],
      lineMap,
    );

    // Blockly assigns ids when it loads a workspace; its saved state, which the app checks, has them.
    const workspace = slotsToWorkspaces(slots, library).marioTop!;
    const actAs = workspace.blocks!.blocks[0]!;
    actAs.id = 'act-as-block';
    actAs.next!.block!.id = 'custom-asm-block';
    expect(slotsWithProblems([problem!])).toEqual(new Set(['marioTop']));
    expect(blockWarnings([problem!], 'marioTop', workspace, library)).toEqual(
      new Map([['custom-asm-block', 'Unknown command.']]),
    );
  });
});

describe('problemPieceName', () => {
  const slots: BlockModel['slots'] = {
    marioTop: [
      { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
      {
        type: 'if',
        branches: [
          {
            condition: { type: 'condition', piece: { id: 'c_onoff', version: 1, params: {} } },
            body: [],
          },
        ],
      },
    ],
  };
  const at = (slot: 'marioTop' | 'marioBottom', path: string): CheckProblem => ({
    message: 'x',
    line: 1,
    origin: { slot, path },
  });
  const name = (id: string) => library.pieces.get(id)!.manifest.name;

  it('names the Action or Condition an error comes from', () => {
    expect(problemPieceName(at('marioTop', '/0'), slots, library)).toBe(name('act_as'));
    expect(problemPieceName(at('marioTop', '/1/branches/0/condition'), slots, library)).toBe(
      name('c_onoff'),
    );
  });

  it('has no name for an error outside any Piece, in an empty Slot, or without a place', () => {
    expect(problemPieceName(at('marioTop', '/1'), slots, library)).toBeUndefined();
    expect(problemPieceName(at('marioBottom', '/0'), slots, library)).toBeUndefined();
    expect(problemPieceName({ message: 'harness' }, slots, library)).toBeUndefined();
  });
});

describe('what a check comes to', () => {
  const errors: CheckOutcome = { kind: 'errors', problems: [{ message: 'Unknown command.' }] };

  it('lets the Check button say why nothing was checked, and only then', () => {
    expect(checkNotice({ kind: 'passed' })).toBeNull();
    expect(checkNotice(errors)).toBeNull();
    expect(checkNotice({ kind: 'unavailable' })).toBeNull();
    expect(checkNotice({ kind: 'unavailable', reason: 'C:\\x has no asar.dll.' })).toEqual({
      kind: 'warning',
      text: 'C:\\x has no asar.dll.',
    });
    expect(checkNotice({ kind: 'failed', message: 'cannot load asar.dll' })).toEqual({
      kind: 'error',
      text: 'Asar check failed: cannot load asar.dll',
    });
  });

  it('saves after a pass and blocks the save on Asar errors', () => {
    expect(saveVerdict({ kind: 'passed' })).toEqual({ save: true, notice: null });
    expect(saveVerdict(errors)).toEqual({ save: false, notice: null });
  });

  it('saves an unchecked Block with a note that says why it was not checked', () => {
    expect(saveVerdict({ kind: 'unavailable' })).toEqual({
      save: true,
      notice: { kind: 'warning', text: 'Saved without an Asar check: no GPS folder chosen.' },
    });
    expect(saveVerdict({ kind: 'unavailable', reason: 'C:\\x has no asar.dll.' }).notice).toEqual({
      kind: 'warning',
      text: 'Saved without an Asar check: C:\\x has no asar.dll.',
    });
  });

  it('does not call a failed check "no GPS folder"', () => {
    const { save, notice } = saveVerdict({ kind: 'failed', message: 'cannot load asar.dll' });
    expect(save).toBe(true);
    expect(notice).toEqual({
      kind: 'warning',
      text: 'Saved, but the Asar check failed: cannot load asar.dll',
    });
  });
});

describe('blockWarnings', () => {
  it('puts the errors of a Slot on the Blockly blocks they come from', () => {
    expect(blockWarnings(problems, 'marioTop', workspace, library)).toEqual(
      new Map([['second', 'Unknown command.\nLabel bc2_x not found.']]),
    );
  });

  it('has nothing for a Slot without errors', () => {
    expect(blockWarnings(problems, 'marioBottom', workspace, library)).toEqual(new Map());
  });
});
