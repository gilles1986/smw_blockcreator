import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BlockModel, PieceRef, Statement } from '../model';
import { builtInLibrary } from '../testing/library';
import { generate, GenerateError } from './index';

const library = builtInLibrary();
const golden = (name: string) =>
  readFileSync(join(import.meta.dirname, 'golden', `${name}.asm`), 'utf8');

const actAs = (tile: number): Statement => ({
  type: 'action',
  piece: { id: 'act_as', version: 1, params: { tile } },
});
const onOff = (position: number): PieceRef => ({ id: 'c_onoff', version: 1, params: { position } });

const onOffCement: BlockModel = {
  properties: {
    name: 'onoff_cement',
    description: 'Mario can stand on it only while the switch is ON.',
    author: 'BlockCreator',
    defaultActAs: 0x130,
  },
  slots: {
    marioTop: [
      {
        type: 'if',
        branches: [{ condition: { type: 'condition', piece: onOff(0) }, body: [actAs(0x130)] }],
        else: [actAs(0x25)],
      },
    ],
  },
};

describe('generate', () => {
  it('writes the ON/OFF cement Block exactly as the golden file', () => {
    expect(generate(onOffCement, library, { toolVersion: 'test' }).text).toBe(
      golden('onoff_cement'),
    );
  });

  it('is deterministic: equal models give identical text and checksum, whatever their key order', () => {
    const reordered: BlockModel = JSON.parse(
      JSON.stringify({ slots: onOffCement.slots, properties: onOffCement.properties }),
    );
    const first = generate(onOffCement, library).text;
    expect(generate(onOffCement, library).text).toBe(first);
    expect(generate(reordered, library).text).toBe(first);
  });

  it('chains else-if branches and stacks both inside offsets on the Inside Slot', () => {
    const model: BlockModel = {
      ...onOffCement,
      slots: {
        marioBottom: [
          {
            type: 'if',
            branches: [
              { condition: { type: 'condition', piece: onOff(0) }, body: [actAs(0x130)] },
              { condition: { type: 'condition', piece: onOff(1) }, body: [actAs(0x25)] },
            ],
          },
        ],
        marioInside: [actAs(0x25)],
      },
    };
    const code = generate(model, library).text.split(
      'JMP TopCorner : JMP BodyInside : JMP HeadInside\n\n',
    )[1];
    expect(code).toBe(
      [
        'MarioBelow:',
        '\tLDA $14AF|!addr',
        '\tBNE bc1_branch2',
        '\tLDY #$01',
        '\tLDA #$30',
        '\tSTA $1693|!addr',
        '\tBRA bc1_end',
        'bc1_branch2:',
        '\tLDA $14AF|!addr',
        '\tBEQ bc1_end',
        '\tLDY #$00',
        '\tLDA #$25',
        '\tSTA $1693|!addr',
        'bc1_end:',
        '\tRTL',
        '',
        'BodyInside:',
        'HeadInside:',
        '\tLDY #$00',
        '\tLDA #$25',
        '\tSTA $1693|!addr',
        '\tRTL',
        '',
        'MarioAbove:',
        'MarioSide:',
        'SpriteV:',
        'SpriteH:',
        'MarioCape:',
        'MarioFireball:',
        'TopCorner:',
        '\tRTL',
        '',
        'print "Mario can stand on it only while the switch is ON."',
        '',
      ].join('\n'),
    );
  });
});

describe('lineMap', () => {
  const { text, lineMap } = generate(onOffCement, library);
  const lines = text.split('\n');
  const originOf = (line: string) => lineMap.get(lines.indexOf(line) + 1);

  it('maps each generated line to its Slot and statement path', () => {
    expect(originOf('\tBNE bc1_else')).toEqual({
      slot: 'marioTop',
      path: '/0/branches/0/condition',
    });
    expect(originOf('\tLDY #$01')).toEqual({ slot: 'marioTop', path: '/0/branches/0/body/0' });
    expect(originOf('\tBRA bc1_end')).toEqual({ slot: 'marioTop', path: '/0' });
    expect(originOf('\tLDY #$00')).toEqual({ slot: 'marioTop', path: '/0/else/0' });
  });

  it('leaves headers, the jump table and offset labels unmapped', () => {
    expect(originOf(';@bc-format 1')).toBeUndefined();
    expect(originOf('db $42')).toBeUndefined();
    expect(originOf('MarioAbove:')).toBeUndefined();
  });
});

describe('errors', () => {
  const withTop = (statements: Statement[]): BlockModel => ({
    ...onOffCement,
    slots: { marioTop: statements },
  });

  it('names Slot and path of a Piece that is not in the Library', () => {
    const model = withTop([
      actAs(0x25),
      { type: 'action', piece: { id: 'teleport', version: 1, params: {} } },
    ]);
    expect(() => generate(model, library)).toThrow(
      new GenerateError("Piece 'teleport' is not in the Library", { slot: 'marioTop', path: '/1' }),
    );
  });

  it('rejects an Action used as a Condition', () => {
    const model = withTop([
      {
        type: 'if',
        branches: [
          {
            condition: { type: 'condition', piece: { id: 'act_as', version: 1, params: {} } },
            body: [],
          },
        ],
      },
    ]);
    expect(() => generate(model, library)).toThrow(
      "marioTop /0/branches/0/condition: Piece 'act_as' is an Action, not a Condition",
    );
  });

  it('reports parameter values the template rejects', () => {
    expect(() => generate(withTop([actAs(0x10000)]), library)).toThrow(
      "marioTop /0: Piece 'act_as': line 1: 'tile' = 65536 does not fit in 16 bits",
    );
  });

  it('keeps line breaks in name and author inside the comment header', () => {
    const model: BlockModel = {
      ...onOffCement,
      properties: { ...onOffCement.properties, name: 'two\nlines', author: 'me\r\nyou' },
    };
    const text = generate(model, library, { toolVersion: 'test' }).text;
    expect(text).toContain('\n; two lines\n');
    expect(text).toContain('\n; Author: me you\n');
  });

  it('fills parameters the model lacks with the Piece defaults', () => {
    const model = withTop([{ type: 'action', piece: { id: 'act_as', version: 1, params: {} } }]);
    expect(generate(model, library).text).toContain('\tLDY #$01\n\tLDA #$30\n');
  });
});
