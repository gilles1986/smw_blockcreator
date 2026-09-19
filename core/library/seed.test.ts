import { describe, expect, it } from 'vitest';
import { LEVEL_SHELLS } from '../names';
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
  // As the generator does: what is not given is the parameter's default.
  const defaults = Object.fromEntries(piece.manifest.params.map((p) => [p.name, p.default]));
  return render(piece.template, {
    params: { ...defaults, ...params },
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
      'c_adjacent_tile',
      'c_button',
      'c_carrying',
      'c_climbing',
      'c_coins',
      'c_ducking',
      'c_facing',
      'c_flying',
      'c_holding_sprite_id',
      'c_in_water',
      'c_item_box',
      'c_lives',
      'c_mario_powerup',
      'c_mario_speed',
      'c_on_ground',
      'c_onoff',
      'c_p_meter',
      'c_pswitch',
      'c_ram',
      'c_really_on_top',
      'c_silver_pswitch',
      'c_spinjump',
      'c_sprite_id',
      'c_sprite_state',
      'c_star',
      'c_wall',
      'c_yoshi',
      'change_adjacent_block',
      'change_music',
      'change_sprite',
      'change_to_tile',
      'create_smoke',
      'custom_asm',
      'disable_buttons',
      'drop_item_box',
      'end_level',
      'erase_adjacent_block',
      'erase_block',
      'give_coins',
      'glitter',
      'hurt_mario',
      'kill_mario',
      'kill_touching_sprite',
      'play_sound',
      'push_sprite',
      'save_block_collected',
      'scroll_lock',
      'set_brightness',
      'set_item_box',
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
      'teleport',
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
    expect(renderPiece(library, 'hurt_mario', { side_hitbox: false })).toBe('JSL $00F5B7|!bank\n');
    expect(library.pieces.get('hurt_mario')?.manifest.clobbers).toContain('Y');
  });

  it('kill_mario calls KillMario and destroys A, X, Y', () => {
    expect(renderPiece(library, 'kill_mario', { side_hitbox: false })).toBe('JSL $00F606|!bank\n');
    expect(library.pieces.get('kill_mario')?.manifest.clobbers).toEqual(['A', 'X', 'Y']);
  });

  it.each([
    ['hurt_mario', '$00F5B7'],
    ['kill_mario', '$00F606'],
  ])('%s with the muncher hitbox skips the hit on the edge pixel', (id, routine) => {
    // Mario's X in the tile ($94 & $0F) is 02 at the left edge and 0D at the right one, the
    // same test as GPS's hurt_death.asm and the muncher blocks of the archive.
    expect(renderPiece(library, id, { side_hitbox: true })).toBe(
      [
        '; Muncher hitbox: no hit when only the edge pixel touches. $93 = 0: Mario is left of the block, 1: right.',
        'LDA $94',
        'AND #$0F',
        'LDX $93',
        'BEQ L_left',
        'EOR #$0F',
        'L_left:',
        'CMP #$02',
        'BEQ L_safe',
        `JSL ${routine}|!bank`,
        'L_safe:',
        '',
      ].join('\n'),
    );
    expect(library.pieces.get(id)?.manifest.version).toBe(2);
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
      renderPiece(library, 'c_sprite_id', { sprite_number: 4, custom: false }, 'L_false'),
    ).toBe('LDA !9E,x\nCMP #$04\nBNE L_false\n');

    // Lunar Magic shell ID DA maps to runtime $04
    expect(
      renderPiece(library, 'c_sprite_id', { sprite_number: 0xda, custom: false }, 'L_false'),
    ).toBe('LDA !9E,x\nCMP #$04\nBNE L_false\n');

    expect(
      renderPiece(library, 'c_sprite_id', { sprite_number: 0xda, custom: true }, 'L_false'),
    ).toBe('LDA !7FAB10,x\nAND #$08\nBEQ L_false\nLDA !7FAB9E,x\nCMP #$DA\nBNE L_false\n');
  });

  it('maps every named Lunar Magic shell number to the sprite the game loads it as', () => {
    // Level sprite n >= DA is sprite n - DA + 4 (SMWDisX bank_02); DF is the two-bounce shell 09.
    const runtime: Record<number, string> = {
      0xda: '04',
      0xdb: '05',
      0xdc: '06',
      0xdd: '07',
      0xdf: '09',
    };
    expect(LEVEL_SHELLS.map((shell) => shell.id)).toEqual(Object.keys(runtime).map(Number));
    for (const [id, sprite] of Object.entries(runtime)) {
      const sprite_number = Number(id);
      expect(renderPiece(library, 'c_sprite_id', { sprite_number, custom: false }, 'L_false')).toBe(
        `LDA !9E,x\nCMP #$${sprite}\nBNE L_false\n`,
      );
      const change = { sprite_number, custom: false, state: 8, x_speed: 0, y_speed: 0 };
      expect(renderPiece(library, 'change_sprite', { ...change, smoke: false })).toContain(
        `LDA #$${sprite}\nCLC\n%spawn_sprite()\n`,
      );
      expect(renderPiece(library, 'spawn_sprite', { ...change, position: 'inside' })).toContain(
        `LDA #$${sprite}\nCLC\n%spawn_sprite()\n`,
      );
    }
  });

  it('change_sprite replaces touching sprite at same coordinates', () => {
    const rendered = renderPiece(library, 'change_sprite', {
      sprite_number: 4,
      custom: false,
      state: 8,
      x_speed: 0,
      y_speed: 0,
      smoke: true,
    });
    expect(rendered).toContain('PHY\nJSL $07FC3B|!bank\nPLY\n');
    expect(rendered).toContain('LDA !E4,x\nSTA $00\n');
    expect(rendered).toContain('%spawn_sprite()\n');
    expect(rendered).toContain('LDA $00\nSTA !E4,x\n');

    const renderedLunarMagicShell = renderPiece(library, 'change_sprite', {
      sprite_number: 0xda,
      custom: false,
      state: 8,
      x_speed: 0,
      y_speed: 0,
      smoke: false,
    });
    expect(renderedLunarMagicShell).toContain('LDA #$04\nCLC\n%spawn_sprite()\n');
  });

  describe('spawn_sprite (ticket 13)', () => {
    const spawn = (params: Record<string, Value> = {}) =>
      renderPiece(library, 'spawn_sprite', params);
    const lines = (...text: string[]) => `${text.join('\n')}\n`;
    const afterSpawn = ['%spawn_sprite()', 'BCS L_fail'];
    const state = ['LDA #$08 : STA !14C8,x', 'LDA #$00 : STA !B6,x', 'LDA #$00 : STA !AA,x'];

    it('still writes what a version 1 Block asked for', () => {
      // Only the parameters version 1 had: the new ones are at their defaults.
      expect(spawn()).toBe(
        lines(
          'LDA #$74',
          'CLC',
          ...afterSpawn,
          '%move_spawn_into_block()',
          ...state,
          'LDA #$10 : STA !154C,x',
          'L_fail:',
        ),
      );
    });

    it('spawns above, below, left, right or an offset away from the block', () => {
      expect(spawn({ position: 'above' })).toContain(
        lines(...afterSpawn, '%move_spawn_above_block()'),
      );
      expect(spawn({ position: 'below' })).toContain(
        lines(...afterSpawn, '%move_spawn_below_block()'),
      );
      const relative = (x: string, y: string) =>
        lines(...afterSpawn, `LDA #${x}`, 'STA $00', y, 'TXA', '%move_spawn_relative()');
      expect(spawn({ position: 'left' })).toContain(relative('$F0', 'STZ $01'));
      expect(spawn({ position: 'right' })).toContain(relative('$10', 'STZ $01'));
      expect(spawn({ position: 'offset', x_offset: 8, y_offset: -16 })).toContain(
        lines(
          ...afterSpawn,
          'LDA #$08',
          'STA $00',
          'LDA #$F0',
          'STA $01',
          'TXA',
          '%move_spawn_relative()',
        ),
      );
    });

    it('sets the extra bit and the four extra bytes of a custom sprite, and only of that', () => {
      const extras = {
        custom: true,
        extra_bit: true,
        extra_byte_1: 0x11,
        extra_byte_2: 0x22,
        extra_byte_3: 0x33,
        extra_byte_4: 0x44,
      };
      expect(spawn(extras)).toContain(
        lines(
          'LDA !7FAB10,x',
          'ORA #$04',
          'STA !7FAB10,x',
          'LDA #$11 : STA !7FAB40,x',
          'LDA #$22 : STA !7FAB4C,x',
          'LDA #$33 : STA !7FAB58,x',
          'LDA #$44 : STA !7FAB64,x',
        ),
      );
      // Off: the bit is left alone, but the bytes are set, so none is left over from another sprite.
      expect(spawn({ ...extras, extra_bit: false })).not.toContain('ORA #$04');
      expect(spawn({ ...extras, extra_bit: false })).toContain('STA !7FAB40,x');
      // A vanilla sprite has no extra bytes, whatever the hidden fields hold.
      expect(spawn({ ...extras, custom: false })).not.toContain('7FAB');
      // Custom sprites stay in status 1 (set by %spawn_sprite) so PIXI runs their INIT routine.
      expect(spawn(extras)).not.toContain('!14C8,x');
    });

    it('turns the sprite to face right, left, like Mario or away from him', () => {
      expect(spawn()).not.toContain('!157C');
      expect(spawn({ facing: 'right' })).toContain(lines('STZ !157C,x', 'L_fail:'));
      expect(spawn({ facing: 'left' })).toContain(lines('LDA #$01 : STA !157C,x', 'L_fail:'));
      // $76: 0 left, 1 right; !157C: 0 right, 1 left.
      expect(spawn({ facing: 'like_mario' })).toContain(
        lines('LDA $76', 'EOR #$01', 'STA !157C,x', 'L_fail:'),
      );
      expect(spawn({ facing: 'away' })).toContain(
        lines(
          'LDA !E4,x',
          'SEC',
          'SBC $94',
          'LDA !14E0,x',
          'SBC $95',
          'LDA #$00',
          'BCS L_right',
          'INC',
          'L_right:',
          'STA !157C,x',
          'L_fail:',
        ),
      );
    });
  });

  describe('extended Pieces (ticket 23)', () => {
    const render = (id: string, params: Record<string, Value>, falseLabel?: string) =>
      renderPiece(library, id, params, falseLabel);
    const lines = (...text: string[]) => `${text.join('\n')}\n`;

    it('the neighbour Pieces move the block position, and put it back', () => {
      const shift = {
        above: ['LDA $98', 'SEC', 'SBC #$0020', 'STA $98'],
        below: ['LDA $98', 'CLC', 'ADC #$0020', 'STA $98'],
        left: ['LDA $9A', 'SEC', 'SBC #$0020', 'STA $9A'],
        right: ['LDA $9A', 'CLC', 'ADC #$0020', 'STA $9A'],
      };
      for (const [direction, moved] of Object.entries(shift)) {
        const change = render('change_adjacent_block', { direction, distance: 32, tile: 0x130 });
        expect(change).toContain(lines('REP #$20', 'LDA $98', 'PHA', 'LDA $9A', 'PHA', ...moved));
        expect(change).toContain(
          lines(
            'REP #$10',
            'LDX #$0130',
            '%change_map16()',
            'SEP #$10',
            'REP #$20',
            'PLA',
            'STA $9A',
            'PLA',
            'STA $98',
            'SEP #$20',
          ),
        );
        const erase = render('erase_adjacent_block', { direction, distance: 32 });
        expect(erase).toContain(
          lines(...moved, 'SEP #$20', '%erase_block()', 'REP #$20', 'PLA', 'STA $9A'),
        );
      }
    });

    it('c_adjacent_tile puts the position back before it branches', () => {
      const back = ['PHP', 'LDA $00', 'STA $98', 'LDA $02', 'STA $9A', 'PLP', 'SEP #$20'];
      const params = { direction: 'above', distance: 16, tile: 0x25 };
      expect(render('c_adjacent_tile', { ...params, comparison: 'equal' }, 'L_false')).toContain(
        lines('%get_map16()', 'CMP #$0025', ...back, 'BNE L_false'),
      );
      expect(
        render('c_adjacent_tile', { ...params, comparison: 'different' }, 'L_false'),
      ).toContain(lines('%get_map16()', 'CMP #$0025', ...back, 'BEQ L_false'));
    });

    it('c_really_on_top is the donut lift test: not moving up, at most 4 pixels in', () => {
      expect(render('c_really_on_top', {}, 'L_false')).toContain(
        lines(
          'LDA $7D',
          'BMI L_false',
          'REP #$20',
          'LDA $98',
          'AND #$FFF0',
          'SEC',
          'SBC #$001C',
          'CMP $96',
          'SEP #$20',
          'BCC L_false',
        ),
      );
    });

    it.each([
      [{ direction: 'down', speed: 0 }, ['LDA $7D', 'BMI L_false']],
      [{ direction: 'down', speed: 8 }, ['LDA $7D', 'BMI L_false', 'CMP #$08', 'BCC L_false']],
      [{ direction: 'up', speed: 0 }, ['LDA $7D', 'BPL L_false']],
      [
        { direction: 'up', speed: 8 },
        ['LDA $7D', 'BPL L_false', 'EOR #$FF', 'INC', 'CMP #$08', 'BCC L_false'],
      ],
      [
        { direction: 'left', speed: 16 },
        ['LDA $7B', 'BPL L_false', 'EOR #$FF', 'INC', 'CMP #$10', 'BCC L_false'],
      ],
      [{ direction: 'right', speed: 0 }, ['LDA $7B', 'BEQ L_false', 'BMI L_false']],
    ])('c_mario_speed %j', (params, expected) => {
      expect(render('c_mario_speed', params, 'L_false')).toBe(lines(...expected));
    });

    it('c_p_meter compares $13E4 with the value, 112 being full', () => {
      expect(render('c_p_meter', { at_least: 112 }, 'L_false')).toBe(
        lines('LDA $13E4|!addr', 'CMP #$70', 'BCC L_false'),
      );
    });

    it("the item box Pieces use the RAM map values, and the game's own release", () => {
      expect(render('set_item_box', { item: 3 })).toBe(lines('LDA #$03', 'STA $0DC2|!addr'));
      const labels = library.pieces.get('set_item_box')!.manifest.params[0]!.options!;
      expect(labels.map((o) => [o.value, o.label])).toEqual([
        [0, 'Empty'],
        [1, 'Mushroom'],
        [2, 'Fire Flower'],
        [3, 'Starman'],
        [4, 'Cape Feather'],
      ]);
      expect(library.pieces.get('c_item_box')!.manifest.params[0]!.options!.slice(3)).toEqual([
        { value: 3, label: 'Starman' },
        { value: 4, label: 'Cape Feather' },
      ]);
      expect(render('drop_item_box', {})).toContain(lines('PLB', 'JSL $028008|!bank', 'PLB'));
    });

    it('teleport goes through the exit of the screen, or to a sublevel, instantly or not', () => {
      const params = { sublevel: 0x105, instant: true };
      expect(render('teleport', { ...params, mode: 'screen' })).toContain(
        lines('LDX #$00', '%teleport_direct()'),
      );
      expect(render('teleport', { ...params, mode: 'sublevel' })).toContain(
        lines(
          'REP #$20',
          'LDA #$0105',
          '; X < 0: a fixed destination, the level number in A.',
          'LDX #$FF',
          '%teleport_direct()',
        ),
      );
      const pipe = render('teleport', { ...params, mode: 'sublevel', instant: false });
      expect(pipe).toBe(lines('REP #$20', 'LDA #$0105', '%teleport()'));
    });

    it("save_block_collected uses GPS's item memory", () => {
      expect(render('save_block_collected', {})).toBe(lines('%set_item_memory()'));
    });

    it('c_holding_sprite_id asks the routine, then compares the sprite number', () => {
      const piece = library.pieces.get('c_holding_sprite_id')!;
      expect(piece.manifest.routines).toEqual(['bc_holding_sprite']);
      expect(library.routines.has('bc_holding_sprite')).toBe(true);
      const holds = (sprite_number: number, custom = false) =>
        render('c_holding_sprite_id', { sprite_number, custom }, 'L_false');
      expect(holds(0x80)).toBe(
        lines('%bc_holding_sprite()', 'BCC L_false', 'LDA !9E,x', 'CMP #$80', 'BNE L_false'),
      );
      // The Lunar Magic shell numbers, as in c_sprite_id.
      expect(holds(0xda)).toContain('CMP #$04\n');
      expect(holds(0xdf)).toContain('CMP #$09\n');
      expect(holds(0x05, true)).toContain(
        lines(
          'LDA !7FAB10,x',
          'AND #$08',
          'BEQ L_false',
          'LDA !7FAB9E,x',
          'CMP #$05',
          'BNE L_false',
        ),
      );
    });

    it('every Piece that calls a tool routine lists it', () => {
      for (const { manifest, template } of library.pieces.values()) {
        const called = [...template.matchAll(/%(bc_[a-z0-9_]+)\(\)/g)].map((match) => match[1]);
        expect(manifest.routines, manifest.id).toEqual(expect.arrayContaining(called));
        for (const name of manifest.routines) expect(library.routines.has(name), name).toBe(true);
      }
    });
  });
});
