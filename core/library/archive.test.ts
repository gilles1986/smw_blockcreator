import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ArchiveError, packPieces, unpackPieces } from './archive';

const GIVE_LIFE = {
  'actions/give_life/piece.json': '{ "id": "give_life" }',
  'actions/give_life/code.asm': 'INC $0DBE|!addr\n',
};

describe('packPieces / unpackPieces', () => {
  it('round-trips Piece files', () => {
    expect(unpackPieces(packPieces(GIVE_LIFE))).toEqual(GIVE_LIFE);
  });

  it('keeps only Piece files when packing', () => {
    const packed = packPieces({
      ...GIVE_LIFE,
      'routines/bc_helper.asm': 'RTL\n',
      'README.md': 'hi',
    });
    expect(unpackPieces(packed)).toEqual(GIVE_LIFE);
  });

  it('skips anything that is not a Piece file when unpacking', () => {
    // packPieces would never emit these, so craft an archive that has them.
    const dirty = zipSync({
      ...unzipSync(packPieces(GIVE_LIFE)),
      '../evil.asm': strToU8('x'),
      'actions/UPPER/piece.json': strToU8('{}'),
      'actions/ok/extra.txt': strToU8('x'),
    });
    expect(unpackPieces(dirty)).toEqual(GIVE_LIFE);
  });

  it('throws ArchiveError on bytes that are not a zip', () => {
    expect(() => unpackPieces(new Uint8Array([1, 2, 3]))).toThrow(ArchiveError);
  });
});
