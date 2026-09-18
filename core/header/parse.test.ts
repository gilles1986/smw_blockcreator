import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../generator';
import { builtInLibrary } from '../testing/library';
import { parse } from './index';

const golden = readFileSync(
  join(import.meta.dirname, '..', 'generator', 'golden', 'onoff_cement.asm'),
  'utf8',
);
const goldenModel = JSON.parse(golden.split('\n')[1]!.slice(';@bc-model '.length));

describe('parse', () => {
  it('reads the model of a generated file and confirms its checksum', () => {
    expect(parse(golden)).toEqual({ ok: true, model: goldenModel, checksumOk: true });
  });

  it('does not treat a line-ending conversion as a hand edit', () => {
    expect(parse(golden.replace(/\n/g, '\r\n'))).toMatchObject({ ok: true, checksumOk: true });
  });

  it('ignores a byte-order mark an editor put in front', () => {
    expect(parse(String.fromCharCode(0xfeff) + golden)).toMatchObject({
      ok: true,
      checksumOk: true,
    });
  });

  it('detects hand edits below the header', () => {
    const edited = golden.replace('\tLDA #$30\n', '\tLDA #$2F\n');
    expect(parse(edited)).toEqual({ ok: true, model: goldenModel, checksumOk: false });
  });

  it('rejects files without a BlockCreator header', () => {
    expect(parse('db $42\nJMP MarioBelow\n')).toEqual({
      ok: false,
      reason: 'not-blockcreator',
      message: 'Not a BlockCreator block.',
    });
  });

  it('rejects files from a newer BlockCreator', () => {
    expect(parse(golden.replace(';@bc-format 1', ';@bc-format 2'))).toEqual({
      ok: false,
      reason: 'newer-format',
      message:
        'This Block was made with a newer BlockCreator (format 2). Update BlockCreator to open it.',
    });
  });

  it('rejects a model header that is not JSON', () => {
    const broken = golden.replace(/^;@bc-model .*$/m, ';@bc-model {"properties":');
    expect(parse(broken)).toMatchObject({
      ok: false,
      reason: 'invalid',
      message: expect.stringMatching(/^The ;@bc-model header is not valid JSON: /),
    });
  });

  it('names the field of a model that does not fit the model schema', () => {
    const model = structuredClone(goldenModel);
    model.slots.marioTop[0].type = 'while';
    const broken = golden.replace(/^;@bc-model .*$/m, `;@bc-model ${JSON.stringify(model)}`);
    expect(parse(broken)).toEqual({
      ok: false,
      reason: 'invalid',
      message:
        'The ;@bc-model header is not a valid Block: slots.marioTop[0].type must be one of: action, if',
    });
  });
});

describe('parse of unusual text', () => {
  it('reads models whose strings contain line or paragraph separators (JSON leaves them raw)', () => {
    for (const code of [0x2028, 0x2029, 0x85]) {
      const odd = String.fromCharCode(code);
      const model = {
        properties: { name: `a${odd}b`, description: odd, author: odd, defaultActAs: 0 },
        slots: {},
      };
      expect(parse(generate(model, builtInLibrary()).text)).toEqual({
        ok: true,
        model,
        checksumOk: true,
      });
    }
  });
});
