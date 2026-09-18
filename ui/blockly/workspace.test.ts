import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../../core/generator';
import type { Statement } from '../../core/model';
import { marioStatements } from '../../core/testing/arbitraries';
import { builtInLibrary } from '../../core/testing/library';
import {
  statementsToWorkspace,
  workspaceProblems,
  workspaceToStatements,
  type WorkspaceState,
} from './workspace';

const library = builtInLibrary();

/** What Blockly serialises after dragging together "if ON/OFF is ON: act as 130, else act as 025". */
const onOffWorkspace: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'controls_if',
        id: 'if',
        x: 20,
        y: 20,
        extraState: { hasElse: true },
        inputs: {
          IF0: { block: { type: 'piece_c_onoff', id: 'c', fields: { position: '0' } } },
          DO0: { block: { type: 'piece_act_as', id: 'a1', fields: { tile: '130' } } },
          ELSE: { block: { type: 'piece_act_as', id: 'a2', fields: { tile: '025' } } },
        },
      },
    ],
  },
};

const onOffStatements: Statement[] = [
  {
    type: 'if',
    branches: [
      {
        condition: {
          type: 'condition',
          piece: { id: 'c_onoff', version: 1, params: { position: 0 } },
        },
        body: [{ type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x130 } } }],
      },
    ],
    else: [{ type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } }],
  },
];

describe('workspaceToStatements', () => {
  it('turns the ON/OFF workspace into the model statements', () => {
    expect(workspaceToStatements(onOffWorkspace, library)).toEqual(onOffStatements);
  });

  it('gives the golden ASM of ticket 04 when generated', () => {
    const golden = readFileSync(
      join(import.meta.dirname, '..', '..', 'core', 'generator', 'golden', 'onoff_cement.asm'),
      'utf8',
    );
    const model = {
      properties: {
        name: 'onoff_cement',
        description: 'Mario can stand on it only while the switch is ON.',
        author: 'BlockCreator',
        defaultActAs: 0x130,
      },
      slots: { marioTop: workspaceToStatements(onOffWorkspace, library) },
    };
    expect(generate(model, library, { toolVersion: 'test' }).text).toBe(golden);
  });

  it('reads else-if branches, runs stacks top to bottom and skips what is still being edited', () => {
    const actAs = (tile: string, y?: number) => ({
      type: 'piece_act_as',
      fields: { tile },
      ...(y !== undefined && { y }),
    });
    const onOff = (position: string) => ({ type: 'piece_c_onoff', fields: { position } });
    const state: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { ...actAs('025', 300) },
          { ...onOff('1'), y: 0 }, // loose Condition: ignored
          {
            type: 'controls_if',
            y: 100,
            extraState: { elseIfCount: 2 },
            inputs: {
              IF0: { block: onOff('0') },
              DO0: { block: { ...actAs('130'), next: { block: actAs('12F') } } },
              DO1: { block: actAs('1F0') }, // no Condition in IF1: branch skipped
              IF2: { block: onOff('1') },
              DO2: { block: actAs('100') },
            },
          },
        ],
      },
    };
    const tile = (t: number): Statement => ({
      type: 'action',
      piece: { id: 'act_as', version: 1, params: { tile: t } },
    });
    const cond = (position: number) => ({
      type: 'condition' as const,
      piece: { id: 'c_onoff', version: 1, params: { position } },
    });
    expect(workspaceToStatements(state, library)).toEqual([
      {
        type: 'if',
        branches: [
          { condition: cond(0), body: [tile(0x130), tile(0x12f)] },
          { condition: cond(1), body: [tile(0x100)] },
        ],
      },
      tile(0x25),
    ]);
  });

  it('drops an if whose branches all lack a Condition, and falls back to defaults for bad input', () => {
    const state: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'controls_if', y: 0, inputs: { DO0: { block: { type: 'piece_act_as' } } } },
          { type: 'piece_act_as', y: 50, fields: { tile: 'xyz' } },
        ],
      },
    };
    expect(workspaceToStatements(state, library)).toEqual([
      { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x130 } } },
    ]);
  });

  it('returns no statements for an empty workspace', () => {
    expect(workspaceToStatements({}, library)).toEqual([]);
    expect(workspaceToStatements({ blocks: { languageVersion: 0, blocks: [] } }, library)).toEqual(
      [],
    );
  });
});

describe('statementsToWorkspace', () => {
  it('rebuilds a workspace that reads back as the same statements', () => {
    const workspace = statementsToWorkspace(onOffStatements, library);
    expect(workspaceToStatements(workspace, library)).toEqual(onOffStatements);
  });

  it('round-trips any valid statements (model → workspace → model)', () => {
    fc.assert(
      fc.property(marioStatements, (s) => {
        expect(workspaceToStatements(statementsToWorkspace(s, library), library)).toEqual(s);
      }),
      { numRuns: 300 },
    );
  });
});

describe('workspaceProblems', () => {
  it('reports what saving would lose: if branches without a Condition, loose Conditions, unknown Pieces', () => {
    const state: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'controls_if',
            y: 0,
            extraState: { elseIfCount: 1 },
            inputs: { IF1: { block: { type: 'piece_c_onoff' } } },
          },
          { type: 'piece_c_onoff', y: 100 },
          { type: 'piece_teleport', y: 200 },
        ],
      },
    };
    expect(workspaceProblems(state, library)).toEqual([
      'An if has a branch without a Condition.',
      'A Condition is not attached to an if.',
      "Piece 'teleport' is not in the Library.",
    ]);
  });

  it('finds nothing wrong with a complete workspace', () => {
    expect(workspaceProblems(onOffWorkspace, library)).toEqual([]);
  });
});

describe('Piece versions', () => {
  it('keeps the version a Block was made with through the workspace, so updates can be noticed', () => {
    const old: Statement[] = [
      { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
    ];
    const base = library.pieces.get('act_as')!;
    const newer = {
      ...library,
      pieces: new Map([['act_as', { ...base, manifest: { ...base.manifest, version: 2 } }]]),
    };
    expect(workspaceToStatements(statementsToWorkspace(old, newer), newer)).toEqual(old);
  });

  it('gives new blocks from the toolbox the Library version', () => {
    const state: WorkspaceState = {
      blocks: { languageVersion: 0, blocks: [{ type: 'piece_act_as', fields: { tile: '025' } }] },
    };
    expect(workspaceToStatements(state, library)).toEqual([
      { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
    ]);
  });
});

describe('AND / OR / NOT', () => {
  const onOff = (position: string) => ({ type: 'piece_c_onoff', fields: { position } });

  it('reads nested AND / OR / NOT blocks into condition expressions', () => {
    const state: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'controls_if',
            inputs: {
              IF0: {
                block: {
                  type: 'logic_operation',
                  fields: { OP: 'OR' },
                  inputs: {
                    A: { block: onOff('0') },
                    B: { block: { type: 'logic_negate', inputs: { BOOL: { block: onOff('1') } } } },
                  },
                },
              },
            },
          },
        ],
      },
    };
    const cond = (position: number) => ({
      type: 'condition' as const,
      piece: { id: 'c_onoff', version: 1, params: { position } },
    });
    expect(workspaceToStatements(state, library)).toEqual([
      {
        type: 'if',
        branches: [
          {
            condition: { type: 'or', left: cond(0), right: { type: 'not', condition: cond(1) } },
            body: [],
          },
        ],
      },
    ]);
  });

  it('reports AND / OR / NOT blocks that are incomplete or not attached to an if', () => {
    const state: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'controls_if',
            y: 0,
            inputs: {
              IF0: { block: { type: 'logic_operation', inputs: { A: { block: onOff('0') } } } },
            },
          },
          { type: 'logic_negate', y: 100, inputs: { BOOL: { block: onOff('0') } } },
        ],
      },
    };
    expect(workspaceProblems(state, library)).toEqual([
      'An AND / OR / NOT is missing a Condition.',
      'A Condition is not attached to an if.',
    ]);
  });
});
