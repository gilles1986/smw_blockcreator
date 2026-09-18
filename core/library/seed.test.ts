import { describe, expect, it } from 'vitest';
import { render, type Value } from '../template';
import { builtInLibrary } from '../testing/library';
import type { Library } from './index';

function renderPiece(
  library: Library,
  id: string,
  params: Record<string, Value>,
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
    expect([...library.pieces.keys()].sort()).toEqual([
      'act_as',
      'blink_invulnerability',
      'boost_mario',
      'c_carrying',
      'c_ducking',
      'c_mario_powerup',
      'c_onoff',
      'c_pswitch',
      'c_ram',
      'c_spinjump',
      'c_sprite_id',
      'c_sprite_state',
      'c_star',
      'c_yoshi',
      'change_music',
      'change_sprite',
      'change_to_tile',
      'create_smoke',
      'custom_asm',
      'disable_buttons',
      'end_level',
      'erase_block',
      'give_coins',
      'glitter',
      'hurt_mario',
      'kill_mario',
      'kill_touching_sprite',
      'play_sound',
      'push_sprite',
      'scroll_lock',
      'set_brightness',
      'set_onoff',
      'set_powerup',
      'set_sprite_state',
      'set_timer',
      'shake_screen',
      'shatter',
      'spawn_sprite',
      'sprite_kicked',
      'star_power',
      'start_pswitch',
      'stun_mario',
      'turn_sprite_around',
      'water_slippery',
      'write_ram',
    ]);
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

  it('kill_mario calls KillMario and destroys A, X, Y', () => {
    expect(renderPiece(library, 'kill_mario', {})).toBe('JSL $00F606|!bank\n');
    expect(library.pieces.get('kill_mario')?.manifest.clobbers).toEqual(['A', 'X', 'Y']);
  });

  it('erase_block calls erase_block routine and removes block', () => {
    expect(renderPiece(library, 'erase_block', {})).toBe('%erase_block()\n');
    expect(library.pieces.get('erase_block')?.manifest.removesBlock).toBe(true);
  });

  it('c_onoff jumps to the false-target unless the switch is in the chosen position', () => {
    expect(renderPiece(library, 'c_onoff', { position: 0 }, 'L_else')).toBe(
      'LDA $14AF|!addr\nBNE L_else\n',
    );
    expect(renderPiece(library, 'c_onoff', { position: 1 }, 'L_else')).toBe(
      'LDA $14AF|!addr\nBEQ L_else\n',
    );
  });

  it('sprite_kicked tests horizontal, vertical or both directions', () => {
    expect(
      renderPiece(
        library,
        'sprite_kicked',
        { direction: 'horizontal' as unknown as number },
        'L_false',
      ),
    ).toBe('%check_sprite_kicked_horizontal()\nBCC L_false\n');
    expect(
      renderPiece(
        library,
        'sprite_kicked',
        { direction: 'vertical' as unknown as number },
        'L_false',
      ),
    ).toBe('%check_sprite_kicked_vertical()\nBCC L_false\n');
  });

  it('c_sprite_id tests vanilla and custom sprite numbers', () => {
    expect(
      renderPiece(
        library,
        'c_sprite_id',
        { sprite_number: 4, custom: false },
        'L_false',
      ),
    ).toBe('LDA !9E,x\nCMP #$04\nBNE L_false\n');

    // Lunar Magic shell ID DA maps to runtime $04
    expect(
      renderPiece(
        library,
        'c_sprite_id',
        { sprite_number: 0xda, custom: false },
        'L_false',
      ),
    ).toBe('LDA !9E,x\nCMP #$04\nBNE L_false\n');

    expect(
      renderPiece(
        library,
        'c_sprite_id',
        { sprite_number: 0xda, custom: true },
        'L_false',
      ),
    ).toBe('LDA !7FAB10,x\nAND #$08\nBEQ L_false\nLDA !7FAB9E,x\nCMP #$DA\nBNE L_false\n');
  });

  it('change_sprite replaces touching sprite at same coordinates', () => {
    const rendered = renderPiece(
      library,
      'change_sprite',
      { sprite_number: 4, custom: false, state: 8, x_speed: 0, y_speed: 0, smoke: true },
    );
    expect(rendered).toContain('PHY\nJSL $07FC3B|!bank\nPLY\n');
    expect(rendered).toContain('LDA !E4,x\nSTA $00\n');
    expect(rendered).toContain('%spawn_sprite()\n');
    expect(rendered).toContain('LDA $00\nSTA !E4,x\n');

    const renderedLunarMagicShell = renderPiece(
      library,
      'change_sprite',
      { sprite_number: 0xda, custom: false, state: 8, x_speed: 0, y_speed: 0, smoke: false },
    );
    expect(renderedLunarMagicShell).toContain('LDA #$04\nCLC\n%spawn_sprite()\n');
  });
});

