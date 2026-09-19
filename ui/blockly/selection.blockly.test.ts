// The copies must be something Blockly itself accepts: load a workspace into headless Blockly
// (no DOM), copy a selection, append the copies to a second workspace and read that back.
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { describe, expect, it } from 'vitest';
import type { Statement } from '../../core/model';
import { builtInLibrary } from '../../core/testing/library';
import { blockDefinitions } from './blocks';
import { copyStacks, offsetStacks } from './selection';
import {
  statementsToWorkspace,
  workspaceToStatements,
  type BlockState,
  type WorkspaceState,
} from './workspace';

const library = builtInLibrary();

const act = (tile: number): Statement => ({
  type: 'action',
  piece: { id: 'act_as', version: 1, params: { tile } },
});
const onOff: Statement = {
  type: 'if',
  branches: [
    {
      condition: {
        type: 'condition',
        piece: { id: 'c_onoff', version: 1, params: { position: 0 } },
      },
      body: [
        act(0x30),
        { type: 'action', piece: { id: 'hurt_mario', version: 2, params: { side_hitbox: false } } },
      ],
    },
  ],
};
const statements: Statement[] = [act(0x25), onOff, act(0x1f0)];

// Registered at module level: the tests below load workspaces while they are being collected.
Blockly.common.defineBlocksWithJsonArray(blockDefinitions(library));

function loaded(state: WorkspaceState): { ws: Blockly.Workspace; saved: WorkspaceState } {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, ws);
  return { ws, saved: Blockly.serialization.workspaces.save(ws) as WorkspaceState };
}

/** Ids of the blocks of the first stack, top to bottom (the stack's own blocks, not inputs). */
function stackIds(saved: WorkspaceState): string[] {
  const ids: string[] = [];
  for (let b: BlockState | undefined = saved.blocks?.blocks[0]; b; b = b.next?.block)
    ids.push(b.id!);
  return ids;
}

/** Headless blocks have no canvas position; in the editor `positionOf` reads the real one. */
function pasted(saved: WorkspaceState, selected: string[]): Statement[] {
  const target = new Blockly.Workspace();
  const rows = new Map(stackIds(saved).map((id, row) => [id, { x: 20, y: 20 + row * 40 }]));
  const stacks = offsetStacks(
    copyStacks(saved, new Set(selected), (id) => rows.get(id)),
    30,
    30,
  );
  for (const stack of stacks) Blockly.serialization.blocks.append(stack, target);
  return workspaceToStatements(
    Blockly.serialization.workspaces.save(target) as WorkspaceState,
    library,
  );
}

describe('pasting copies into Blockly', () => {
  const { saved } = loaded(statementsToWorkspace(statements, library));
  const [first, second, third] = stackIds(saved);

  it('brings an if along with its Condition and body, but not what follows it', () => {
    expect(pasted(saved, [second!])).toEqual([onOff]);
  });

  it('pastes stacks broken apart by the selection as separate stacks', () => {
    expect(pasted(saved, [first!, third!])).toEqual([act(0x25), act(0x1f0)]);
  });

  it('keeps selected neighbours connected', () => {
    expect(pasted(saved, [first!, second!, third!])).toEqual(statements);
  });

  it('leaves the source workspace as it was', () => {
    const before = JSON.stringify(saved);
    pasted(saved, [first!, second!]);
    expect(JSON.stringify(saved)).toBe(before);
  });
});
