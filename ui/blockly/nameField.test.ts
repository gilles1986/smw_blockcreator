// The name field in headless Blockly (no DOM): its options, and how it follows the block's other field.
import * as Blockly from 'blockly';
import { afterAll, describe, expect, it } from 'vitest';
import { BUILT_IN_NAMES, type NameSource } from '../../core/names';
import { NameField, refreshNameFields, setNameSource } from './nameField';

const names: NameSource = {
  sprites: (custom) =>
    custom ? [{ id: 0x05, name: 'ghost-shell' }] : [{ id: 0x04, name: 'Green Koopa' }],
  sounds: (port) => [{ id: 0x01, name: port === '$1DFC' ? 'Coin' : 'Hit head' }],
};
setNameSource(names);
afterAll(() => setNameSource(BUILT_IN_NAMES));

Blockly.common.defineBlocksWithJsonArray([
  {
    type: 'test_sprite',
    message0: '%1 %2',
    args0: [
      { type: 'field_checkbox', name: 'custom', checked: false },
      { type: 'field_names', name: 'sprite', value: '04', names: 'sprite', listParam: 'custom' },
    ],
  },
  {
    type: 'test_sound',
    message0: '%1 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'port',
        options: [
          ['1DF9', '$1DF9'],
          ['1DFC', '$1DFC'],
        ],
      },
      { type: 'field_names', name: 'sound', value: '01', names: 'sound', listParam: 'port' },
    ],
  },
]);

/** Blockly fires events a moment later; the field listens to them. */
const events = () => new Promise((resolve) => setTimeout(resolve, 0));

function spriteBlock() {
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock('test_sprite');
  return { workspace, block, field: block.getField('sprite') as NameField };
}

describe('NameField', () => {
  it('offers the named numbers first, then a separator and every other number', () => {
    const { field } = spriteBlock();
    const options = field.getOptions(false);
    expect(options.slice(0, 3)).toEqual([['04 · Green Koopa', '04'], 'separator', ['00', '00']]);
    expect(options.filter((option) => option !== 'separator')).toHaveLength(256);
  });

  it('accepts any number, also one no list names', () => {
    const { field } = spriteBlock();
    field.setValue('C9');
    expect(field.getValue()).toBe('C9');
    field.setValue('FF');
    expect(field.getValue()).toBe('FF');
  });

  it('lists the PIXI sprites once the custom checkbox is on, and keeps the number', async () => {
    const { block, field } = spriteBlock();
    field.setValue('05');
    field.refresh();
    expect(field.getText()).toBe('05');
    block.setFieldValue('TRUE', 'custom');
    await events();
    expect(field.getValue()).toBe('05');
    expect(field.getText()).toBe('05 · ghost-shell');
    expect(field.getOptions(false)[0]).toEqual(['05 · ghost-shell', '05']);
    block.setFieldValue('FALSE', 'custom');
    await events();
    expect(field.getOptions(false)[0]).toEqual(['04 · Green Koopa', '04']);
  });

  it('follows the port of a sound', async () => {
    const workspace = new Blockly.Workspace();
    const block = workspace.newBlock('test_sound');
    const field = block.getField('sound') as NameField;
    field.refresh();
    expect(field.getText()).toBe('01 · Hit head');
    block.setFieldValue('$1DFC', 'port');
    await events();
    expect(field.getText()).toBe('01 · Coin');
  });

  it('is saved and loaded as the two hex digits, with the custom checkbox next to it', () => {
    const { workspace, block } = spriteBlock();
    block.setFieldValue('TRUE', 'custom');
    block.setFieldValue('C9', 'sprite');
    const saved = Blockly.serialization.blocks.save(block);
    expect(saved?.fields).toEqual({ custom: true, sprite: 'C9' });
    const copy = Blockly.serialization.blocks.append(saved!, workspace);
    expect(copy.getFieldValue('sprite')).toBe('C9');
    expect(copy.getFieldValue('custom')).toBe('TRUE');
  });

  it('shows the names again when the lists change', () => {
    const { workspace, field } = spriteBlock();
    field.refresh();
    expect(field.getText()).toBe('04 · Green Koopa');
    setNameSource({ ...names, sprites: () => [{ id: 0x04, name: 'Renamed' }] });
    refreshNameFields(workspace);
    expect(field.getText()).toBe('04 · Renamed');
    setNameSource(names);
  });
});
