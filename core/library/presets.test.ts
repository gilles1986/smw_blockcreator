import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../generator';
import { parse } from '../header';
import { checkPieces } from '../model';
import { builtInLibrary } from '../testing/library';
import { PRESET_TOOL_VERSION, PRESETS } from '../testing/presets';

const library = builtInLibrary();
const presetFile = (name: string) =>
  join(import.meta.dirname, '..', '..', 'library', 'presets', `${name}.asm`);

// `npm run presets` (vitest -u) writes library/presets/*.asm from the models in
// core/testing/presets.ts; a plain run checks that the files are exactly what they generate.
describe('Presets', () => {
  it.each(Object.entries(PRESETS))('%s is the generated file', async (name, model) => {
    const { text } = generate(model, library, { toolVersion: PRESET_TOOL_VERSION });
    await expect(text).toMatchFileSnapshot(presetFile(name));
  });

  it('are all in the built-in Library, and every file has a model', () => {
    expect([...library.presets.keys()].sort()).toEqual(Object.keys(PRESETS).sort());
  });

  it.each([...library.presets])('%s re-opens unedited, with Pieces the Library has', (_, file) => {
    const result = parse(file.text);
    expect(result.ok && result.checksumOk).toBe(true);
    if (result.ok) expect(checkPieces(result.model, library)).toEqual([]);
  });

  it.each([...library.presets])('%s regenerates byte-identically', (_, file) => {
    const result = parse(file.text);
    if (!result.ok) throw new Error(result.message);
    const again = generate(result.model, library, { toolVersion: PRESET_TOOL_VERSION });
    expect(again.text).toBe(file.text);
  });

  it('the muncher tests the edge pixel on the sides only', () => {
    const text = library.presets.get('muncher')!.text;
    // One shared section for Left, Right, Top corner and Inside, and a plain hurt for Top and Bottom.
    expect(text.match(/LDX \$93/g)).toHaveLength(1);
    expect(text.match(/JSL \$00F5B7\|!bank/g)).toHaveLength(3);
    expect(text).toContain(
      'MarioSide:\nTopCorner:\nBodyInside:\nHeadInside:\n\tPHY\n\t; Muncher hitbox',
    );
    // Top and Bottom hurt without it.
    expect(text).toContain('MarioBelow:\n\tPHY\n\tJSL $00F5B7|!bank\n');
    expect(text).toContain('MarioAbove:\n\tPHY\n\tJSL $00F5B7|!bank\n');
  });
});
