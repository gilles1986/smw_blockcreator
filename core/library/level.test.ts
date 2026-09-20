// Ticket 14: the Level Actions, the Conditions and the advanced Pieces, checked against the RAM map
// (SMWCentral), the SMW disassembly (SMWDisX) and the archive's blocks. Each test names the fact
// it rests on, so a Piece that reads a wrong address cannot pass for long.
import { describe, expect, it } from 'vitest';
import { render, type Value } from '../template';
import { builtInLibrary } from '../testing/library';

const library = builtInLibrary();

function piece(id: string, params: Record<string, Value> = {}, falseLabel?: string): string {
  const found = library.pieces.get(id);
  if (!found) throw new Error(`Piece '${id}' not loaded`);
  // As the generator does: what is not given is the parameter's default.
  const defaults = Object.fromEntries(found.manifest.params.map((p) => [p.name, p.default]));
  return render(found.template, {
    params: { ...defaults, ...params },
    label: (name) => `L_${name}`,
    ...(falseLabel && { falseLabel }),
  });
}

const lines = (...text: string[]) => `${text.join('\n')}\n`;

describe('Level Actions', () => {
  it('scroll_lock: $1411 is the horizontal scroll flag, 0 stops the screen and 1 lets it scroll', () => {
    expect(piece('scroll_lock', { locked: true })).toBe(lines('STZ $1411|!addr'));
    expect(piece('scroll_lock', { locked: false })).toBe(lines('LDA #$01 : STA $1411|!addr'));
  });

  it('water_slippery: a slippery level is $80 in $86, the values 1 to 7F are only half slippery', () => {
    expect(piece('water_slippery', { water: true, slippery: true })).toBe(
      lines('LDA #$01 : STA $85', 'LDA #$80 : STA $86'),
    );
    expect(piece('water_slippery', { water: false, slippery: false })).toBe(
      lines('STZ $85', 'STZ $86'),
    );
  });

  describe('disable_buttons', () => {
    // $0DAA / $0DAC are the buttons the game takes as already held on the next frame, so the press
    // does not count as new ($16 / $18). Controller 1 is $0DAA / $0DAC, controller 2 the next byte.
    const face = { b: '$80', y: '$40', select: '$20', start: '$10' };
    const pad = { up: '$08', down: '$04', left: '$02', right: '$01' };
    const shoulder = { a: '$80', x: '$40', l: '$20', r: '$10' };
    const nothing = Object.fromEntries(
      [...Object.keys(face), ...Object.keys(pad), ...Object.keys(shoulder)].map((b) => [b, false]),
    );

    it.each(Object.entries({ ...face, ...pad }).map(([button, mask]) => [button, mask] as const))(
      '%s (mask %s) clears $15/$16 and sets mask $0DAA/$0DAB',
      (button, mask) => {
        expect(piece('disable_buttons', { ...nothing, [button]: true })).toBe(
          lines(`LDA #${mask}`, 'TRB $15', 'TRB $16', 'TSB $0DAA|!addr', 'TSB $0DAB|!addr'),
        );
      },
    );

    it('a (mask $80) clears $15/$17/$18 and sets mask $0DAC/$0DAD', () => {
      expect(piece('disable_buttons', { ...nothing, a: true })).toBe(
        lines('LDA #$80', 'TRB $15', 'TRB $17', 'TRB $18', 'TSB $0DAC|!addr', 'TSB $0DAD|!addr'),
      );
    });

    it('x (mask $40) clears $15/$16/$17/$18 and sets masks $0DAA-$0DAD', () => {
      expect(piece('disable_buttons', { ...nothing, x: true })).toBe(
        lines(
          'LDA #$40',
          'TRB $15',
          'TRB $16',
          'TRB $17',
          'TRB $18',
          'TSB $0DAA|!addr',
          'TSB $0DAB|!addr',
          'TSB $0DAC|!addr',
          'TSB $0DAD|!addr',
        ),
      );
    });

    it.each([
      ['l', '$20'],
      ['r', '$10'],
    ] as const)('%s (mask %s) clears $17/$18 and sets mask $0DAC/$0DAD', (button, mask) => {
      expect(piece('disable_buttons', { ...nothing, [button]: true })).toBe(
        lines(`LDA #${mask}`, 'TRB $17', 'TRB $18', 'TSB $0DAC|!addr', 'TSB $0DAD|!addr'),
      );
    });

    it('adds to what other code has masked, and writes nothing when no button is chosen', () => {
      expect(piece('disable_buttons', nothing)).toBe('');
      expect(library.pieces.get('disable_buttons')!.template).not.toMatch(/STA/);
    });

    it('starts as the jump buttons, B and A', () => {
      expect(piece('disable_buttons')).toBe(
        lines(
          'LDA #$80',
          'TRB $15',
          'TRB $16',
          'TSB $0DAA|!addr',
          'TSB $0DAB|!addr',
          'LDA #$80',
          'TRB $15',
          'TRB $17',
          'TRB $18',
          'TSB $0DAC|!addr',
          'TSB $0DAD|!addr',
        ),
      );
    });
  });
});

describe('Conditions', () => {
  it('c_lives compares the lives shown on the status bar: $0DBE holds one less', () => {
    expect(piece('c_lives', { comparison: 'equal', value: 3 }, 'L_false')).toBe(
      lines('LDA $0DBE|!addr', 'INC', 'CMP #$03', 'BNE L_false'),
    );
    expect(piece('c_lives', { comparison: 'greater_equal', value: 5 }, 'L_false')).toBe(
      lines('LDA $0DBE|!addr', 'INC', 'CMP #$05', 'BCC L_false'),
    );
  });

  describe('sprite numbers: a custom sprite acts like a vanilla one in !9E, so it has to be excluded', () => {
    const notCustom = ['LDA !7FAB10,x', 'AND #$08', 'BNE L_false'];

    it('c_sprite_id', () => {
      const is = (sprite_number: number, custom = false) =>
        piece('c_sprite_id', { sprite_number, custom }, 'L_false');
      expect(is(4)).toBe(lines(...notCustom, 'LDA !9E,x', 'CMP #$04', 'BNE L_false'));
      expect(is(0xda)).toContain('CMP #$04\n');
      expect(is(0x30, true)).toBe(
        lines(
          'LDA !7FAB10,x',
          'AND #$08',
          'BEQ L_false',
          'LDA !7FAB9E,x',
          'CMP #$30',
          'BNE L_false',
        ),
      );
    });

    it('c_holding_sprite_id', () => {
      expect(piece('c_holding_sprite_id', { sprite_number: 0x80, custom: false }, 'L_false')).toBe(
        lines(
          '%bc_holding_sprite()',
          'BCC L_false',
          ...notCustom,
          'LDA !9E,x',
          'CMP #$80',
          'BNE L_false',
        ),
      );
    });
  });

  it('c_sprite_state names the states as the game does: 1 is not initialised yet, 9 is stunned', () => {
    const options = library.pieces.get('c_sprite_state')!.manifest.params[0]!.options!;
    const label = (value: number) => options.find((o) => o.value === value)?.label;
    expect(label(1)).toMatch(/^Initial/);
    expect(label(9)).toMatch(/^Stunned/);
    expect(label(10)).toMatch(/^Kicked/);
    expect(label(3)).toMatch(/^Smushed/);
    expect(label(4)).toMatch(/^Spin/);
    expect(options.map((o) => o.value).sort((a, b) => Number(a) - Number(b))).toEqual([
      1, 2, 3, 4, 8, 9, 10, 11,
    ]);
  });

  describe('c_button reads B and Y from controller 1 itself: $15 / $16 mix A into B and X into Y', () => {
    it.each([
      ['b', 'held', '$0DA2', '$80'],
      ['b', 'pressed', '$0DA6', '$80'],
      ['y', 'held', '$0DA2', '$40'],
      ['y', 'pressed', '$0DA6', '$40'],
      ['a', 'held', '$17', '$80'],
      ['a', 'pressed', '$18', '$80'],
      ['x', 'held', '$17', '$40'],
      ['x', 'pressed', '$18', '$40'],
      ['start', 'held', '$15', '$10'],
      ['select', 'pressed', '$16', '$20'],
      ['up', 'held', '$15', '$08'],
      ['l', 'pressed', '$18', '$20'],
      ['r', 'held', '$17', '$10'],
    ])('%s %s', (button, mode, address, bit) => {
      const read = address.length === 5 ? `${address}|!addr` : address;
      expect(piece('c_button', { button, mode }, 'L_false')).toBe(
        lines(`LDA ${read}`, `BIT #${bit}`, 'BEQ L_false'),
      );
    });
  });
});

describe('Advanced Pieces address the game RAM so that SA-1 hacks work too', () => {
  it.each([
    [0x85, '$85'],
    [0x7e0085, '$85'],
    [0x0f44, '$0F44|!addr'],
    [0x7e0f44, '$0F44|!addr'],
    [0x1fff, '$1FFF|!addr'],
    [0x7f9c7b, '$7F9C7B'],
    [0x7e2000, '$7E2000'],
    [0x2000, '$002000'],
  ])('write_ram and c_ram at %i use %s', (address, operand) => {
    expect(piece('write_ram', { address, value: 0x12 })).toBe(lines('LDA #$12', `STA ${operand}`));
    expect(piece('c_ram', { address, comparison: 'equal', value: 1 }, 'L_false')).toBe(
      lines(`LDA ${operand}`, 'CMP #$01', 'BNE L_false'),
    );
  });
});
