import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BlockModel, PieceRef, Statement } from '../model';
import { builtInLibrary } from '../testing/library';
import { maxBytes } from './branches';
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

describe('generate and the tool routines', () => {
  const holds = (sprite: number): PieceRef => ({
    id: 'c_holding_sprite_id',
    version: 1,
    params: { sprite_number: sprite, custom: false },
  });
  const model = (...sprites: number[]): BlockModel => ({
    ...onOffCement,
    slots: {
      marioTop: sprites.map((sprite) => ({
        type: 'if',
        branches: [{ condition: { type: 'condition', piece: holds(sprite) }, body: [actAs(0x25)] }],
      })),
    },
  });

  it('names the routines the Pieces call, once each, in the result and in the header', () => {
    const result = generate(model(0x80, 0x0f), library, { toolVersion: 'test' });
    expect(result.routines).toEqual(['bc_holding_sprite']);
    expect(result.text).toContain('; Needs GPS routines: bc_holding_sprite\n');
  });

  it('names none for a Block whose Pieces call none', () => {
    expect(generate(onOffCement, library).routines).toEqual([]);
    expect(generate(onOffCement, library).text).not.toContain('Needs GPS routines');
  });
});

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
    expect(originOf(';bc-format 1')).toBeUndefined();
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
      { type: 'action', piece: { id: 'time_machine', version: 1, params: {} } },
    ]);
    expect(() => generate(model, library)).toThrow(
      new GenerateError("Piece 'time_machine' is not in the Library", {
        slot: 'marioTop',
        path: '/1',
      }),
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

  it('writes no raw line separators outside the model line (editors may break lines there)', () => {
    const separators = [0x0d, 0x2028, 0x2029, 0x85].map((code) => String.fromCharCode(code));
    const odd = separators.join('x');
    const model: BlockModel = {
      ...onOffCement,
      properties: { name: odd, description: `one${odd}two`, author: odd, defaultActAs: 0 },
    };
    const lines = generate(model, library).text.split('\n');
    const withoutModelLine = [lines[0], ...lines.slice(2)].join('\n');
    for (const separator of separators) expect(withoutModelLine).not.toContain(separator);
  });

  it('escapes ! in the tooltip, since Asar expands !defines inside print strings', () => {
    const model: BlockModel = {
      ...onOffCement,
      properties: { ...onOffCement.properties, description: 'Hurts! Uses !addr.' },
    };
    expect(generate(model, library).text).toContain('\nprint "Hurts\\! Uses \\!addr."\n');
  });

  it('fills parameters the model lacks with the Piece defaults', () => {
    const model = withTop([{ type: 'action', piece: { id: 'act_as', version: 1, params: {} } }]);
    expect(generate(model, library).text).toContain('\tLDY #$01\n\tLDA #$30\n');
  });
});

describe('all Slots', () => {
  const model = (name: string): BlockModel =>
    JSON.parse(
      golden(name)
        .split('\n')[1]!
        .replace(/^;@?bc-model /, ''),
    );

  it.each(['side_split', 'sprite_platform', 'wall_run'])(
    'writes %s exactly as its golden file',
    (name) => {
      expect(generate(model(name), library, { toolVersion: 'test' }).text).toBe(golden(name));
    },
  );

  const codeOf = (m: BlockModel) =>
    generate(m, library).text.split('JMP TopCorner : JMP BodyInside : JMP HeadInside\n\n')[1]!;
  const base = { properties: onOffCement.properties };

  it('lets a filled Head inside or Body inside Slot override Inside for its offset', () => {
    const code = codeOf({
      ...base,
      slots: { marioInside: [actAs(0x25)], marioHeadInside: [actAs(0x130)] },
    });
    expect(code).toContain(
      'BodyInside:\n\tLDY #$00\n\tLDA #$25\n\tSTA $1693|!addr\n\tRTL\n\nHeadInside:\n\tLDY #$01',
    );
  });

  it('keeps Top corner empty when it does not follow Top, and uses its own Slot when filled', () => {
    const unlinked = codeOf({
      ...base,
      slots: { marioTop: [actAs(0x130)] },
      topCornerFollowsTop: false,
    });
    expect(unlinked).toContain('MarioAbove:\n\tLDY');
    expect(unlinked).toContain('MarioFireball:\nTopCorner:\nBodyInside:');
    const own = codeOf({
      ...base,
      slots: { marioTop: [actAs(0x130)], marioTopCorner: [actAs(0x25)] },
    });
    expect(own).toContain('MarioAbove:\n\tLDY #$01');
    expect(own).toContain('TopCorner:\n\tLDY #$00');
  });

  it('refuses a Mario-only Piece in a Sprite Slot', () => {
    const boost: Statement = {
      type: 'action',
      piece: { id: 'boost_mario', version: 1, params: {} },
    };
    expect(() => generate({ ...base, slots: { spriteTop: [boost] } }, library)).toThrow(
      "spriteTop /0: Piece 'boost_mario' only works in Mario Slots",
    );
  });

  it('unifies split offset when left and right are linked, skipping direction check', () => {
    const model: BlockModel = {
      ...base,
      slots: { marioLeft: [actAs(0x130)] },
      slotLinks: { marioRight: 'marioLeft' },
    };
    const code = codeOf(model);
    expect(code).toContain('MarioSide:\n\tLDY #$01\n\tLDA #$30\n\tSTA $1693|!addr\n\tRTL');
    expect(code).not.toContain('LDA $93');
  });

  it('deduplicates code when multiple offsets share the same logic via links', () => {
    const erase: Statement = {
      type: 'action',
      piece: { id: 'erase_block', version: 1, params: {} },
    };
    const model: BlockModel = {
      ...base,
      slots: { spriteLeft: [erase] },
      slotLinks: {
        spriteRight: 'spriteLeft',
        spriteBottom: 'spriteLeft',
      },
    };
    const code = codeOf(model);
    // SpriteH should not split
    expect(code).not.toContain('LDA !B6,x');
    // SpriteV should branch directly to shared label
    expect(code).toContain(
      'SpriteV:\n\t%sprite_block_position()\n\tLDA !AA,x ; negative: moving up, touches the bottom\n\tBMI bc1_shared_spriteLeft\n\tRTL',
    );
    // SpriteH should be the home defining bc1_shared_spriteLeft
    expect(code).toContain(
      'SpriteH:\n\t%sprite_block_position()\nbc1_shared_spriteLeft:\n\tPHX\n\tPHY\n\t%erase_block()\n\tPLY\n\tPLX\n\tRTL',
    );
    // Only one instance of erase_block should be generated!
    const occurrences = (code.match(/%erase_block\(\)/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

describe('condition logic and long branches', () => {
  const modelOf = (name: string): BlockModel =>
    JSON.parse(
      golden(name)
        .split('\n')[1]!
        .replace(/^;@?bc-model /, ''),
    );

  it.each(['or_switch', 'not_switch', 'nested_if', 'long_body'])(
    'writes %s exactly as its golden file',
    (name) => {
      expect(generate(modelOf(name), library, { toolVersion: 'test' }).text).toBe(golden(name));
    },
  );
});

describe('register saves', () => {
  const base = { properties: onOffCement.properties };
  const hurt: Statement = { type: 'action', piece: { id: 'hurt_mario', version: 1, params: {} } };
  const sectionOf = (m: BlockModel, lib = library) => {
    const text = generate(m, lib).text;
    return text.slice(text.indexOf('\n\n', text.indexOf('JMP HeadInside')) + 2);
  };
  /** The seed Library with one Piece's clobbers replaced. */
  const withClobbers = (id: string, clobbers: ('A' | 'X' | 'Y')[]) => {
    const piece = library.pieces.get(id)!;
    const pieces = new Map(library.pieces);
    pieces.set(id, { ...piece, manifest: { ...piece.manifest, clobbers } });
    return { ...library, pieces };
  };

  it('keeps Y (the act-as high byte) around a Piece that destroys it', () => {
    expect(sectionOf({ ...base, slots: { marioBottom: [hurt] } })).toMatch(
      /^MarioBelow:\n\tPHY\n\tJSL \$00F5B7\|!bank\n\tPLY\n\tRTL\n/,
    );
  });

  it('also keeps X where it is the sprite index: Sprite and Fireball Slots', () => {
    const lib = withClobbers('act_as', ['A', 'X']);
    const act = actAs(0x130);
    expect(sectionOf({ ...base, slots: { marioFireball: [hurt] } })).toContain(
      'MarioFireball:\n\tPHX\n\tPHY\n\tJSL $00F5B7|!bank\n\tPLY\n\tPLX\n\tRTL\n',
    );
    expect(sectionOf({ ...base, slots: { spriteTop: [act] } }, lib)).toContain(
      '\tBMI bc1_bottom\n\tPHX\n\tLDY #$01\n\tLDA #$30\n\tSTA $1693|!addr\n\tPLX\n\tRTL\n',
    );
    expect(sectionOf({ ...base, slots: { marioBottom: [act] } }, lib)).toContain(
      'MarioBelow:\n\tLDY #$01',
    );
  });

  it('restores registers on both ways out of a Condition that destroys them', () => {
    const lib = withClobbers('c_onoff', ['A', 'Y']);
    const model: BlockModel = {
      ...base,
      slots: {
        marioBottom: [
          {
            type: 'if',
            branches: [{ condition: { type: 'condition', piece: onOff(0) }, body: [actAs(0x130)] }],
          },
        ],
      },
    };
    const expected = [
      'MarioBelow:',
      '\tPHY',
      '\tLDA $14AF|!addr',
      '\tBNE bc2_restore',
      '\tPLY',
      '\tBRA bc2_pass',
      'bc2_restore:',
      '\tPLY',
      '\tBRA bc1_end',
      'bc2_pass:',
      '\tLDY #$01',
    ].join('\n');
    expect(sectionOf(model, lib).startsWith(expected)).toBe(true);
  });
});

describe('long branches', () => {
  const base = { properties: onOffCement.properties };
  const codeOf = (m: BlockModel, lib = library) => generate(m, lib).text;

  it('widens a branch over code whose size is unknown (e.g. an assembler directive)', () => {
    const actAsPiece = library.pieces.get('act_as')!;
    const raw = {
      ...actAsPiece,
      manifest: { ...actAsPiece.manifest, id: 'raw', params: [] },
      template: 'rep 3 : NOP\n',
    };
    const lib = { ...library, pieces: new Map([...library.pieces, ['raw', raw]]) };
    const model: BlockModel = {
      ...base,
      slots: {
        marioBottom: [
          {
            type: 'if',
            branches: [
              {
                condition: { type: 'condition', piece: onOff(0) },
                body: [{ type: 'action', piece: { id: 'raw', version: 1, params: {} } }],
              },
            ],
          },
        ],
      },
    };
    expect(codeOf(model, lib)).toContain(
      '\tLDA $14AF|!addr\n\tBEQ bc4_skip\n\tJMP bc1_end\nbc4_skip:\n\trep 3 : NOP\nbc1_end:',
    );
  });

  it('widens the branch of a side split whose first half is long, and keeps lineMap in step', () => {
    const model: BlockModel = {
      ...base,
      slots: {
        marioLeft: Array.from({ length: 20 }, () => actAs(0x130)),
        marioRight: [actAs(0x25)],
      },
    };
    const { text, lineMap } = generate(model, library);
    expect(text).toContain(
      '\tLDA $93 ; 0: Mario is left of the block\n\tBEQ bc23_skip\n\tJMP bc1_right\nbc23_skip:\n',
    );
    const lines = text.split('\n');
    const lastRight = lines.lastIndexOf('\tLDY #$00') + 1;
    expect(lineMap.get(lastRight)).toEqual({ slot: 'marioRight', path: '/0' });
  });
});

describe('long branches around code of unknown size', () => {
  const base = { properties: onOffCement.properties };
  const withRaw = (template: string) => {
    const actAsPiece = library.pieces.get('act_as')!;
    const raw = {
      ...actAsPiece,
      manifest: { ...actAsPiece.manifest, id: 'raw', params: [] },
      template,
    };
    return { ...library, pieces: new Map([...library.pieces, ['raw', raw]]) };
  };
  const raw: Statement = { type: 'action', piece: { id: 'raw', version: 1, params: {} } };

  it('does not hang when unknown code comes before both a branch and its target', () => {
    const model: BlockModel = {
      ...base,
      slots: {
        marioBottom: [
          raw,
          {
            type: 'if',
            branches: [{ condition: { type: 'condition', piece: onOff(0) }, body: [actAs(0x130)] }],
          },
        ],
      },
    };
    expect(generate(model, withRaw('rep 3 : NOP\n')).text).toContain(
      '\trep 3 : NOP\n\tLDA $14AF|!addr\n\tBNE bc2_end\n',
    );
  });

  it('checks a branch in the middle of a line too', () => {
    const lib = withRaw('LDA $00 : BEQ {{label "x"}} : NOP\nrep 3 : NOP\n{{label "x"}}:\n');
    const text = generate({ ...base, slots: { marioBottom: [raw] } }, lib).text;
    expect(text).toContain(
      '\tLDA $00 : BNE bc2_skip\n\tJMP bc1_x\nbc2_skip:\n\tNOP\n\trep 3 : NOP\nbc1_x:\n',
    );
  });
});

describe('the Slot a Piece is rendered for', () => {
  const base = { properties: onOffCement.properties };
  const probeLibrary = () => {
    const actAsPiece = library.pieces.get('act_as')!;
    const probe = {
      ...actAsPiece,
      manifest: { ...actAsPiece.manifest, id: 'probe', params: [], slots: 'any' as const },
      template: '; in {{slot}}\n',
    };
    return { ...library, pieces: new Map([...library.pieces, ['probe', probe]]) };
  };
  const probe: Statement = { type: 'action', piece: { id: 'probe', version: 1, params: {} } };
  const condition: Statement = {
    type: 'if',
    branches: [{ condition: { type: 'condition', piece: onOff(0) }, body: [probe] }],
  };

  it('is handed to every Piece, in Mario and in sprite Slots, and in the branches of an if', () => {
    const model: BlockModel = {
      ...base,
      slots: { marioTop: [probe], marioBottom: [condition], spriteBottom: [probe] },
    };
    const text = generate(model, probeLibrary()).text;
    expect(text).toContain('\t; in marioTop\n');
    expect(text).toContain('\t; in marioBottom\n');
    expect(text).toContain('\t; in spriteBottom\n');
  });

  it('is the Slot whose code is written, so a Slot that others link to renders once, as itself', () => {
    const model: BlockModel = {
      ...base,
      slots: { marioLeft: [probe] },
      slotLinks: { marioRight: 'marioLeft', marioTopCorner: 'marioLeft' },
    };
    const text = generate(model, probeLibrary()).text;
    expect(text.match(/; in /g)).toHaveLength(1);
    expect(text).toContain('\t; in marioLeft\n');
  });
});

describe('maxBytes', () => {
  it.each([
    ['\tdb "' + 'x'.repeat(140) + '"', 140],
    ['\tdb $01, "AB", $02', 4],
    ['\tLDA $00|!dp', 3],
    ['\tSTA $1693|!addr', 3],
    ['\tJSL $00F5B7|!bank', 4],
    ['\tLDA $12+$3400', 4],
    ['\tdb ";;;;" ; comment', 4],
    ['bc1_x:', 0],
    ['\t; only a comment', 0],
  ])('%j is at most %i bytes', (line, bytes) => {
    expect(maxBytes(line)).toBeGreaterThanOrEqual(bytes);
    expect(maxBytes(line)).toBeLessThanOrEqual(Math.max(bytes, 4));
  });
});
