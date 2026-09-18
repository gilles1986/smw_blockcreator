import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generate } from '../generator';
import { model } from '../testing/arbitraries';
import { builtInLibrary } from '../testing/library';
import { parse } from './index';

const library = builtInLibrary();
describe('generate → parse', () => {
  it('returns every valid model unchanged, with a matching checksum', () => {
    fc.assert(
      fc.property(model, (m) => {
        expect(parse(generate(m, library).text)).toEqual({ ok: true, model: m, checksumOk: true });
      }),
      { numRuns: 300 },
    );
  });
});
