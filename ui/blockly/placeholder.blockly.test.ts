// The placeholders must be something Blockly itself accepts: load a Block with Pieces the Library
// does not have into headless Blockly (no DOM), see the blocks, save the workspace, read it back.
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { describe, expect, it } from 'vitest';
import type { Statement } from '../../core/model';
import { builtInLibrary } from '../../core/testing/library';
import { blockDefinitions, MISSING_ACTION_BLOCK, missingBlockDefinitions } from './blocks';
import { statementsToWorkspace, workspaceToStatements, type WorkspaceState } from './workspace';

const library = builtInLibrary();

// Registered at module level: the tests below load workspaces while they are being collected.
Blockly.common.defineBlocksWithJsonArray([
  ...blockDefinitions(library),
  ...missingBlockDefinitions(),
]);

const statements: Statement[] = [
  { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x130 } } },
  { type: 'action', piece: { id: 'time_machine', version: 3, params: { year: 1985 } } },
  {
    type: 'if',
    branches: [
      {
        condition: { type: 'condition', piece: { id: 'c_flux', version: 2, params: { on: true } } },
        body: [{ type: 'action', piece: { id: 'time_machine', version: 3, params: { year: 1 } } }],
      },
    ],
  },
];

describe('placeholders in Blockly', () => {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(statementsToWorkspace(statements, library), ws);
  const saved = Blockly.serialization.workspaces.save(ws) as WorkspaceState;

  it('are blocks of their own, with the Piece id and its values to read', () => {
    const missing = ws.getAllBlocks(false).filter((block) => block.type.startsWith('missing_'));
    expect(missing.map((block) => block.type).sort()).toEqual([
      'missing_piece_action',
      'missing_piece_action',
      'missing_piece_condition',
    ]);
    const action = missing.find((block) => block.type === MISSING_ACTION_BLOCK)!;
    expect(action.getFieldValue('ID')).toBe('time_machine');
    expect(action.getFieldValue('PARAMS')).toBe('year = 1985');
    expect(action.getColour()).toBe('#6b7075');
  });

  it('stay a Condition in an if, and a statement in a stack', () => {
    const condition = ws
      .getAllBlocks(false)
      .find((block) => block.type === 'missing_piece_condition')!;
    expect(condition.outputConnection).not.toBeNull();
    expect(condition.getParent()?.type).toBe('controls_if');
    const action = ws.getAllBlocks(false).find((block) => block.type === MISSING_ACTION_BLOCK)!;
    expect(action.previousConnection).not.toBeNull();
  });

  it('come back out of Blockly as the same Piece uses, whole', () => {
    expect(workspaceToStatements(saved, library)).toEqual(statements);
  });
});
