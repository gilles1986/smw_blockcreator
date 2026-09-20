// Rows that hide, in headless Blockly (no DOM): the rules a manifest gives, and applying them.
import * as Blockly from 'blockly';
import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../../core/testing/library';
import { blockDefinitions, visibilityRules } from './blocks';
import './nameField';
import {
  applyVisibility,
  refreshVisibility,
  setVisibilityRules,
  watchVisibility,
} from './visibility';

const library = builtInLibrary();
const rules = visibilityRules(library);
setVisibilityRules(rules);
Blockly.common.defineBlocksWithJsonArray(blockDefinitions(library));

/** Blockly fires events a moment later. */
const events = () => new Promise((resolve) => setTimeout(resolve, 0));
const rowsShown = (block: Blockly.Block) => block.inputList.map((input) => input.isVisible());

describe('visibilityRules', () => {
  it('follow the showWhen of a manifest: one row per parameter, after the name', () => {
    const spawn = rules.filter((rule) => rule.blockType === 'piece_spawn_sprite');
    const params = library.pieces.get('spawn_sprite')!.manifest.params;
    const rowOf = (name: string) => params.findIndex((p) => p.name === name) + 1;
    expect(spawn.map((rule) => [rule.row, rule.control, rule.shownWhen])).toEqual([
      [rowOf('extra_bit'), 'custom', 'TRUE'],
      [rowOf('extra_byte_1'), 'custom', 'TRUE'],
      [rowOf('extra_byte_2'), 'custom', 'TRUE'],
      [rowOf('extra_byte_3'), 'custom', 'TRUE'],
      [rowOf('extra_byte_4'), 'custom', 'TRUE'],
      [rowOf('x_offset'), 'position', 'offset'],
      [rowOf('y_offset'), 'position', 'offset'],
      [rowOf('state'), 'custom', 'FALSE'],
    ]);
  });

  it('are only for Pieces that ask for them', () => {
    expect(new Set(rules.map((rule) => rule.blockType))).toEqual(
      new Set([
        'piece_spawn_sprite',
        'piece_change_sprite',
        'piece_set_midway',
        'piece_c_yoshi_coins',
      ]),
    );
  });
});

describe('applyVisibility', () => {
  const spawn = () => {
    const workspace = new Blockly.Workspace();
    return { workspace, block: workspace.newBlock('piece_spawn_sprite') };
  };
  const params = library.pieces.get('spawn_sprite')!.manifest.params;
  const hidden = ['extra_bit', 'extra_byte_1', 'extra_byte_2', 'extra_byte_3', 'extra_byte_4'];
  const row = (name: string) => params.findIndex((p) => p.name === name) + 1;

  it('hides the extra bytes until the sprite is custom, and the offset until it is wanted', () => {
    const { block } = spawn();
    applyVisibility(block);
    const shown = rowsShown(block);
    for (const name of [...hidden, 'x_offset', 'y_offset'])
      expect(shown[row(name)], name).toBe(false);
    for (const name of ['custom', 'sprite_number', 'position', 'state', 'facing']) {
      expect(shown[row(name)], name).toBe(true);
    }

    block.setFieldValue('TRUE', 'custom');
    applyVisibility(block);
    for (const name of hidden) expect(rowsShown(block)[row(name)], name).toBe(true);
    expect(rowsShown(block)[row('state')]).toBe(false);
    expect(rowsShown(block)[row('x_offset')]).toBe(false);

    block.setFieldValue('offset', 'position');
    applyVisibility(block);
    expect(rowsShown(block)[row('x_offset')]).toBe(true);
    expect(rowsShown(block)[row('y_offset')]).toBe(true);
  });

  it('keeps the value of a hidden row', () => {
    const { block } = spawn();
    block.setFieldValue('5', 'extra_byte_1');
    applyVisibility(block);
    expect(rowsShown(block)[row('extra_byte_1')]).toBe(false);
    expect(block.getFieldValue('extra_byte_1')).toBe('5');
    expect(Blockly.serialization.blocks.save(block)?.fields).toMatchObject({ extra_byte_1: '5' });
  });

  it('is applied to every block when a workspace is refreshed', () => {
    const { workspace, block } = spawn();
    block.setFieldValue('TRUE', 'custom');
    refreshVisibility(workspace);
    expect(rowsShown(block)[row('extra_bit')]).toBe(true);
  });

  it('follows a field that changes, and blocks that are created', async () => {
    const { workspace, block } = spawn();
    const stop = watchVisibility(workspace);
    applyVisibility(block);
    block.setFieldValue('TRUE', 'custom');
    await events();
    expect(rowsShown(block)[row('extra_bit')]).toBe(true);
    const copy = Blockly.serialization.blocks.append(
      Blockly.serialization.blocks.save(block)!,
      workspace,
    );
    await events();
    expect(rowsShown(copy)[row('extra_bit')]).toBe(true);
    stop();
  });
});
