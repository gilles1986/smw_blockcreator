import { describe, expect, it } from 'vitest';
import { render } from '../template';
import { builtInLibrary } from '../testing/library';
import type { Library } from './index';

function renderPiece(
  library: Library,
  id: string,
  params: Record<string, number>,
  falseLabel?: string,
) {
  const piece = library.pieces.get(id);
  if (!piece) throw new Error(`Piece '${id}' not loaded`);
  return render(piece.template, {
    params,
    label: (name) => `L_${name}`,
    ...(falseLabel && { falseLabel }),
  });
}

describe('built-in Library seed Pieces', () => {
  const library = builtInLibrary();

  it('load without errors', () => {
    expect(library.errors).toEqual([]);
    expect([...library.pieces.keys()].sort()).toEqual(['act_as', 'c_onoff', 'hurt_mario']);
  });

  it('act_as sets $1693 and Y to the tile', () => {
    expect(renderPiece(library, 'act_as', { tile: 0x130 })).toBe(
      'LDY #$01\nLDA #$30\nSTA $1693|!addr\n',
    );
    expect(renderPiece(library, 'act_as', { tile: 0x25 })).toBe(
      'LDY #$00\nLDA #$25\nSTA $1693|!addr\n',
    );
  });

  it('hurt_mario calls HurtMario and declares that it destroys Y', () => {
    expect(renderPiece(library, 'hurt_mario', {})).toBe('JSL $00F5B7|!bank\n');
    expect(library.pieces.get('hurt_mario')?.manifest.clobbers).toContain('Y');
  });

  it('c_onoff jumps to the false-target unless the switch is in the chosen position', () => {
    expect(renderPiece(library, 'c_onoff', { position: 0 }, 'L_else')).toBe(
      'LDA $14AF|!addr\nBNE L_else\n',
    );
    expect(renderPiece(library, 'c_onoff', { position: 1 }, 'L_else')).toBe(
      'LDA $14AF|!addr\nBEQ L_else\n',
    );
  });
});
