// Ticket 24: the Pieces the survey of the SMWCentral block archive asked for
// (docs/research/piece-kandidaten.md). Each Piece is run on a small model of the game's RAM
// (core/testing/mini65816.ts), so a test says what the code does to the RAM, not how it is spelled.
// The addresses were looked up in the SMWCentral RAM map and the SMW disassembly; each test names
// the fact it rests on.
import { describe, expect, it } from 'vitest';
import { render, type Value } from '../template';
import { run, type Machine } from '../testing/mini65816';
import { builtInLibrary } from '../testing/library';

const library = builtInLibrary();
const FALSE = 'FALSE';

/** The code of a Piece with its parameters (what is not given is the default). */
function code(id: string, params: Record<string, Value> = {}): string {
  const piece = library.pieces.get(id);
  if (!piece) throw new Error(`Piece '${id}' not loaded`);
  const defaults = Object.fromEntries(piece.manifest.params.map((p) => [p.name, p.default]));
  return render(piece.template, {
    params: { ...defaults, ...params },
    label: (name) => name,
    slot: 'marioTop',
    ...(piece.manifest.kind === 'condition' && { falseLabel: FALSE }),
  });
}

const exec = (id: string, params: Record<string, Value>, machine: Machine = {}) =>
  run(code(id, params), { falseLabel: FALSE, ...machine });

describe('Take coins', () => {
  // $0DBF is the current player's coin count.
  it('takes the coins from the counter', () => {
    expect(exec('take_coins', { amount: 3 }, { ram: { 0x0dbf: 10 } }).ram[0x0dbf]).toBe(7);
    expect(exec('take_coins', { amount: 5 }, { ram: { 0x0dbf: 5 } }).ram[0x0dbf]).toBe(0);
  });

  it('sets the counter to 0 when there are fewer, or leaves it alone', () => {
    expect(
      exec('take_coins', { amount: 5, if_short: 'zero' }, { ram: { 0x0dbf: 2 } }).ram[0x0dbf],
    ).toBe(0);
    expect(
      exec('take_coins', { amount: 5, if_short: 'keep' }, { ram: { 0x0dbf: 2 } }).ram[0x0dbf],
    ).toBe(2);
  });

  it('is a one-shot Action', () => {
    expect(library.pieces.get('take_coins')!.manifest.once).toBe(true);
  });
});

describe('Give lives and Take lives', () => {
  // $18E4 is the life counter of the game: it gives one life every 35 frames with the 1-Up sound
  // (bank 02, CODE_028AB1). $0DBE holds the lives minus one.
  it('adds to the pending lives, and stops at 255 pending', () => {
    expect(exec('add_lives', { amount: 3 }, { ram: { 0x18e4: 0 } }).ram[0x18e4]).toBe(3);
    expect(exec('add_lives', { amount: 3 }, { ram: { 0x18e4: 2 } }).ram[0x18e4]).toBe(5);
    expect(exec('add_lives', { amount: 20 }, { ram: { 0x18e4: 250 } }).ram[0x18e4]).toBe(255);
  });

  it('takes lives, and leaves Mario at least one', () => {
    // $0DBE = 4 is five lives: taking 3 leaves two, taking 4 leaves one, taking 5 is too many.
    expect(exec('take_lives', { amount: 3 }, { ram: { 0x0dbe: 4 } }).ram[0x0dbe]).toBe(1);
    expect(exec('take_lives', { amount: 4 }, { ram: { 0x0dbe: 4 } }).ram[0x0dbe]).toBe(0);
    const tooMany = exec('take_lives', { amount: 5, if_short: 'keep' }, { ram: { 0x0dbe: 4 } });
    expect(tooMany.ram[0x0dbe]).toBe(4);
    expect(tooMany.calls).toEqual([]);
  });

  it('can end the game when he has too few: 0 lives and KillMario', () => {
    const over = exec('take_lives', { amount: 5, if_short: 'game_over' }, { ram: { 0x0dbe: 4 } });
    expect(over.ram[0x0dbe]).toBe(0xff);
    expect(over.calls).toEqual(['JSL $00F606']);
    // Enough lives: nothing dies.
    const fine = exec('take_lives', { amount: 2, if_short: 'game_over' }, { ram: { 0x0dbe: 4 } });
    expect(fine.ram[0x0dbe]).toBe(2);
    expect(fine.calls).toEqual([]);
  });
});

describe('Add time and Time left is', () => {
  // $0F31, $0F32 and $0F33 are the hundreds, tens and ones digit of the timer.
  const timerRam = (time: number) => ({
    0x0f31: Math.floor(time / 100),
    0x0f32: Math.floor(time / 10) % 10,
    0x0f33: time % 10,
  });
  const digits = (ram: Record<number, number>) =>
    (ram[0x0f31] ?? 0) * 100 + (ram[0x0f32] ?? 0) * 10 + (ram[0x0f33] ?? 0);
  const parts = (time: number) => ({
    hundreds: Math.floor(time / 100),
    tens: Math.floor(time / 10) % 10,
    ones: time % 10,
  });

  it('adds like a decimal number, with the carry, and stops at 999', () => {
    const times = [0, 1, 9, 10, 19, 45, 89, 90, 99, 100, 101, 199, 555, 899, 909, 990, 998, 999];
    for (const now of times) {
      for (const add of times) {
        const { ram } = exec('add_time', parts(add), { ram: timerRam(now) });
        expect(digits(ram), `${now} + ${add}`).toBe(Math.min(999, now + add));
        // Every digit stays a digit.
        for (const address of [0x0f31, 0x0f32, 0x0f33]) expect(ram[address]).toBeLessThan(10);
      }
    }
  });

  it('compares the time left, digit by digit, like a number', () => {
    const times = [0, 1, 9, 10, 11, 19, 90, 99, 100, 101, 109, 110, 199, 200, 555, 999];
    for (const left of times) {
      for (const value of times) {
        const test = (comparison: string) =>
          !exec('c_timer', { comparison, ...parts(value) }, { ram: timerRam(left) }).falseTaken;
        expect(test('greater_equal'), `${left} >= ${value}`).toBe(left >= value);
        expect(test('less'), `${left} < ${value}`).toBe(left < value);
        expect(test('equal'), `${left} == ${value}`).toBe(left === value);
      }
    }
  });
});

describe('Bonus stars', () => {
  // $0F48 is Mario's bonus stars and $0F49 Luigi's; $0DB3 says which of them is playing.
  it("adds to the current player's count and stops at 99, below the bonus game", () => {
    expect(
      exec('add_bonus_stars', { amount: 5 }, { ram: { 0x0db3: 0, 0x0f48: 10 } }).ram[0x0f48],
    ).toBe(15);
    expect(
      exec('add_bonus_stars', { amount: 5 }, { ram: { 0x0db3: 1, 0x0f49: 10 } }).ram[0x0f49],
    ).toBe(15);
    expect(
      exec('add_bonus_stars', { amount: 5 }, { ram: { 0x0db3: 1, 0x0f48: 10 } }).ram[0x0f48],
    ).toBe(10);
    expect(exec('add_bonus_stars', { amount: 5 }, { ram: { 0x0f48: 97 } }).ram[0x0f48]).toBe(99);
  });

  it("compares the current player's count", () => {
    for (const [stars, value] of [
      [0, 0],
      [10, 10],
      [10, 11],
      [11, 10],
      [99, 50],
    ] as const) {
      const test = (comparison: string, player = 0) =>
        !exec(
          'c_bonus_stars',
          { comparison, value },
          { ram: { 0x0db3: player, [0x0f48 + player]: stars } },
        ).falseTaken;
      expect(test('equal')).toBe(stars === value);
      expect(test('not_equal')).toBe(stars !== value);
      expect(test('less')).toBe(stars < value);
      expect(test('greater_equal')).toBe(stars >= value);
      expect(test('greater_equal', 1)).toBe(stars >= value);
    }
  });
});

describe('Yoshi coins', () => {
  // $1420 counts the Yoshi coins of this attempt. $1F2F-$1F3A holds one bit per level (level n is
  // bit 7-(n AND 7) of byte n/8), set once its five coins were collected; $13BF is the level number.
  const BITS = {
    0x0da8a6: 0x80,
    0x0da8a7: 0x40,
    0x0da8a8: 0x20,
    0x0da8a9: 0x10,
    0x0da8aa: 0x08,
    0x0da8ab: 0x04,
    0x0da8ac: 0x02,
    0x0da8ad: 0x01,
  };

  it('counts the coins collected so far, at least', () => {
    for (const [collected, needed] of [
      [0, 0],
      [4, 5],
      [5, 5],
      [6, 5],
      [3, 1],
    ] as const) {
      const holds = !exec(
        'c_yoshi_coins',
        { source: 'this_attempt', count: needed },
        { ram: { 0x1420: collected } },
      ).falseTaken;
      expect(holds).toBe(collected >= needed);
    }
  });

  it('finds the flag of the level it is in, and no other', () => {
    for (const level of [0, 1, 7, 8, 0x24, 0x5f]) {
      const ram = { 0x13bf: level, [0x1f2f + (level >> 3)]: 0x80 >> (level & 7) };
      const holds = (inLevel: number) =>
        !exec('c_yoshi_coins', { source: 'saved' }, { ram: { ...ram, 0x13bf: inLevel }, rom: BITS })
          .falseTaken;
      expect(holds(level), `level ${level}`).toBe(true);
      for (const other of [0, 1, 2, 8, 9, 0x25]) {
        if (other !== level) expect(holds(other), `${other} is not ${level}`).toBe(false);
      }
    }
  });
});

describe('Events, switch palaces and level flags', () => {
  it('compares the events passed ($1F2E)', () => {
    for (const [events, value] of [
      [0, 0],
      [0, 1],
      [1, 1],
      [5, 3],
      [3, 5],
    ] as const) {
      const test = (comparison: string) =>
        !exec('c_events_passed', { comparison, value }, { ram: { 0x1f2e: events } }).falseTaken;
      expect(test('equal')).toBe(events === value);
      expect(test('not_equal')).toBe(events !== value);
      expect(test('less')).toBe(events < value);
      expect(test('greater_equal')).toBe(events >= value);
    }
  });

  it('reads the flag of each switch palace: $1F27 green, $1F28 yellow, $1F29 blue, $1F2A red', () => {
    const at = { green: 0x1f27, yellow: 0x1f28, blue: 0x1f29, red: 0x1f2a } as const;
    for (const [palace, address] of Object.entries(at)) {
      const pressed = (only: number, is: boolean) =>
        !exec('c_switch_palace', { palace, pressed: is }, { ram: { [only]: 1 } }).falseTaken;
      expect(pressed(address, true), palace).toBe(true);
      expect(pressed(address, false), palace).toBe(false);
      for (const other of Object.values(at).filter((a) => a !== address)) {
        expect(pressed(other, true), `${palace} while only ${other.toString(16)} is pressed`).toBe(
          false,
        );
      }
    }
  });

  it('"all four" needs every palace, and its "not pressed" is true while one is missing', () => {
    const all = { 0x1f27: 1, 0x1f28: 1, 0x1f29: 1, 0x1f2a: 1 };
    const test = (ram: Record<number, number>, pressed: boolean) =>
      !exec('c_switch_palace', { palace: 'all', pressed }, { ram }).falseTaken;
    expect(test(all, true)).toBe(true);
    expect(test(all, false)).toBe(false);
    for (const missing of [0x1f27, 0x1f28, 0x1f29, 0x1f2a]) {
      expect(test({ ...all, [missing]: 0 }, true)).toBe(false);
      expect(test({ ...all, [missing]: 0 }, false)).toBe(true);
    }
    expect(test({}, false)).toBe(true);
  });

  it('reads bit 7 (beaten) or bit 6 (midway passed) of the level in $1EA2', () => {
    // Format bmesudlr: b = level is beaten, m = midway point has been passed.
    for (const level of [0, 1, 0x24, 0x5f]) {
      const test = (flag: string, byte: number, is_set = true) =>
        !exec('c_level_beaten', { level, flag, is_set }, { ram: { [0x1ea2 + level]: byte } })
          .falseTaken;
      expect(test('beaten', 0x80)).toBe(true);
      expect(test('beaten', 0x40)).toBe(false);
      expect(test('midway', 0x40)).toBe(true);
      expect(test('midway', 0x80)).toBe(false);
      expect(test('beaten', 0x3f, false)).toBe(true);
      expect(test('beaten', 0x80, false)).toBe(false);
    }
    // Another level's byte does not count.
    const other = exec(
      'c_level_beaten',
      { level: 3, flag: 'beaten', is_set: true },
      { ram: { [0x1ea2 + 4]: 0x80 } },
    );
    expect(other.falseTaken).toBe(true);
  });
});

describe('Chance', () => {
  // GetRand ($01ACF9) leaves its number in $148D. The condition is true when it is below the chance.
  it('is true for exactly `chance` of the 256 numbers', () => {
    const options = library.pieces
      .get('c_random')!
      .manifest.params[0]!.options!.map((o) => o.value as number);
    for (const chance of options) {
      let trues = 0;
      for (let number = 0; number < 256; number++) {
        const outcome = exec('c_random', { chance }, { random: number });
        expect(outcome.calls).toEqual(['JSL $01ACF9']);
        if (!outcome.falseTaken) trues++;
        expect(!outcome.falseTaken).toBe(number < chance);
      }
      expect(trues).toBe(chance);
    }
  });
});

describe('Sprites on screen', () => {
  // !14C8 is the sprite status table: 0 is an empty slot, 8 and more is a living sprite.
  const slots = (statuses: number[]) => Object.fromEntries(statuses.map((s, i) => [0x14c8 + i, s]));
  const holds = (state: string, statuses: number[]) =>
    !exec('c_sprites_alive', { state }, { ram: slots(statuses) }).falseTaken;

  it('is true for "none" when every slot is empty or only dying', () => {
    expect(holds('none', [])).toBe(true);
    expect(holds('none', [0, 0, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(holds('none', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8])).toBe(false);
    expect(holds('none', [9])).toBe(false);
  });

  it('is true for "some" when a slot, whichever one, holds a living sprite', () => {
    expect(holds('some', [])).toBe(false);
    expect(holds('some', [0, 0, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
    for (let slot = 0; slot < 12; slot++) {
      const statuses = new Array<number>(12).fill(0);
      statuses[slot] = 0x0b;
      expect(holds('some', statuses), `slot ${slot}`).toBe(true);
      expect(holds('none', statuses), `slot ${slot}`).toBe(false);
    }
  });
});

describe('Remove carried item', () => {
  // !14C8 is the sprite status table; status $0B is "carried". $1470 and $148F flag that Mario
  // carries something. $15 is the controller: bit 6 is the run / pick-up button (X or Y).
  const carrying = { [0x14c8 + 3]: 0x0b, [0x14c8 + 5]: 0x08, 0x1470: 1, 0x148f: 1 };

  it('deletes the carried sprite and only that one, and clears the carrying flags', () => {
    const { ram } = exec('remove_carried', { mode: 'delete' }, { ram: carrying });
    expect(ram[0x14c8 + 3]).toBe(0);
    expect(ram[0x14c8 + 5]).toBe(8);
    expect(ram[0x1470]).toBe(0);
    expect(ram[0x148f]).toBe(0);
  });

  it('leaves everything alone when nothing is carried', () => {
    const idle = { [0x14c8 + 2]: 0x09, [0x14c8 + 7]: 0x08 };
    const { ram } = exec('remove_carried', { mode: 'delete' }, { ram: idle });
    expect(ram[0x14c8 + 2]).toBe(9);
    expect(ram[0x14c8 + 7]).toBe(8);
  });

  it('can only let go of it: the run button and left / right are released for a frame', () => {
    const { ram } = exec('remove_carried', { mode: 'drop' }, { ram: { ...carrying, 0x15: 0xff } });
    expect(ram[0x15]).toBe(0xff & ~0x40 & ~0x03);
    // The sprite stays, and so do the flags: the game does the dropping.
    expect(ram[0x14c8 + 3]).toBe(0x0b);
    expect(ram[0x1470]).toBe(1);
  });
});

describe('Bounce block', () => {
  // GPS's spawn_bounce_sprite takes A = bounce sprite type ($1699), X = the block it turns into
  // ($9C) and Y = direction (index into BlockBounceSpeedX / Y: 0 up, 1 right, 2 left, 3 down).
  it('calls the routine with the type, the block and the direction in A, X and Y', () => {
    const out = exec('bounce_block', { bounce: 3, becomes: 13, direction: 0 });
    expect(out.calls).toEqual(['%spawn_bounce_sprite()']);
    expect([out.a, out.x, out.y]).toEqual([3, 13, 0]);
    const note = exec('bounce_block', { bounce: 2, becomes: 14, direction: 3 });
    expect([note.a, note.x, note.y]).toEqual([2, 14, 3]);
  });

  it('is a one-shot Action that changes the block', () => {
    const { manifest } = library.pieces.get('bounce_block')!;
    expect([manifest.once, manifest.removesBlock]).toEqual([true, true]);
  });

  it('only offers the bounce sprites and blocks of the clean game', () => {
    // Values from $1C up need the Custom Bounce Block Sprites patch (see the routine's header).
    const { params } = library.pieces.get('bounce_block')!.manifest;
    for (const param of params) {
      if (!param.options) continue;
      for (const option of param.options) {
        if (typeof option.value === 'number') {
          expect(option.value).toBeLessThan(0x1c);
        }
      }
    }
  });
});

describe('Give points', () => {
  it('calls the routine once per 10 points asked for', () => {
    for (const amount of [1, 2, 10, 255]) {
      const out = exec('give_points', { amount });
      expect(out.calls).toEqual(new Array(amount).fill('%give_points()'));
    }
  });
});

describe('Yoshi', () => {
  // $187A is 1 while Mario rides Yoshi, $18E2 is Yoshi's slot plus one, !15F6 a sprite's palette.
  it('paints the Yoshi Mario rides, and nothing when he is not on Yoshi', () => {
    const riding = exec('set_yoshi_color', { color: 12 }, { ram: { 0x187a: 1, 0x18e2: 4 } });
    expect(riding.ram[0x15f6 + 3]).toBe(12);
    const walking = exec('set_yoshi_color', { color: 12 }, { ram: { 0x187a: 0, 0x18e2: 4 } });
    expect(walking.ram[0x15f6 + 3]).toBeUndefined();
    const noYoshi = exec('set_yoshi_color', { color: 12 }, { ram: { 0x187a: 1, 0x18e2: 0 } });
    expect(noYoshi.ram[0x15f6 + 3]).toBeUndefined();
  });

  it('offers the four Yoshi colors of the game: $0A yellow, $0B blue, $0C red, $0D green', () => {
    const options = library.pieces.get('set_yoshi_color')!.manifest.params[0]!.options!;
    expect(options.map((o) => [o.label, o.value])).toEqual([
      ['Green', 0x0d],
      ['Red', 0x0c],
      ['Blue', 0x0b],
      ['Yellow', 0x0a],
    ]);
  });

  it('destroys Yoshi only when Mario rides him, and gets Mario off', () => {
    const text = code('kill_yoshi', { sound: true });
    // Nothing to do without a rider or without a Yoshi slot.
    expect(text.split('\n').slice(0, 4)).toEqual([
      'LDA $187A|!addr',
      'BEQ done',
      'LDA $18E2|!addr',
      'BEQ done',
    ]);
    // Mario is put on the ground, Yoshi turns into a puff of smoke (status 4) with the stars.
    for (const line of ['STZ $187A|!addr', 'STA !14C8,x', 'JSL $07FC3B|!bank', 'STX $15E9|!addr']) {
      expect(text).toContain(line);
    }
    expect(text).toContain('LDA #$08\nSTA $1DF9|!addr');
    expect(code('kill_yoshi', { sound: false })).not.toContain('$1DF9');
  });
});

describe('Limit sprite speed', () => {
  // !B6 is the sprite's X speed and !AA its Y speed, signed bytes: $80 and up move left / up.
  const signed = (byte: number) => (byte > 127 ? byte - 256 : byte);
  const limited = (axis: string, max: number, speed: number) => {
    const address = axis === 'down' ? 0xaa : 0xb6;
    return signed(
      exec('limit_sprite_speed', { axis, max }, { x: 3, ram: { [address + 3]: speed & 0xff } }).ram[
        address + 3
      ]!,
    );
  };

  it('clamps the horizontal speed to the maximum in both directions, and leaves slower ones', () => {
    for (const max of [0, 1, 35, 127]) {
      for (let speed = -128; speed <= 127; speed++) {
        expect(limited('horizontal', max, speed), `${speed} against ${max}`).toBe(
          Math.max(-max, Math.min(max, speed)) + 0,
        );
      }
    }
  });

  it('clamps only the downward speed, and leaves a sprite that moves up alone', () => {
    for (const max of [0, 25, 127]) {
      for (let speed = -128; speed <= 127; speed++) {
        expect(limited('down', max, speed), `${speed} against ${max}`).toBe(
          speed < 0 ? speed : Math.min(max, speed),
        );
      }
    }
  });

  it('only works in a sprite Slot', () => {
    expect(library.pieces.get('limit_sprite_speed')!.manifest.slots).toBe('sprite');
  });
});

describe('Behind the scenery', () => {
  it('writes the graphics priority of Mario ($13F9)', () => {
    expect(exec('behind_scenery', { layer: 1 }).ram[0x13f9]).toBe(1);
    expect(exec('behind_scenery', { layer: 0 }, { ram: { 0x13f9: 1 } }).ram[0x13f9]).toBe(0);
  });

  it('does not offer the priorities that switch off the interaction with sprites', () => {
    // $13F9 = 2 and 3 are used when entering pipes and on the overworld, and disable sprites.
    const options = library.pieces.get('behind_scenery')!.manifest.params[0]!.options!;
    expect(options.map((o) => o.value).sort()).toEqual([0, 1]);
  });
});

describe('Extended Pieces', () => {
  it('End level adds to the overworld event ($1DEA), but not to "no event" ($FF)', () => {
    const offset = (now: number, event_offset: number) =>
      exec('end_level', { event_offset }, { ram: { 0x1dea: now } }).ram;
    expect(offset(3, 2)[0x1dea]).toBe(5);
    expect(offset(3, 0)[0x1dea]).toBe(3);
    expect(offset(0xff, 2)[0x1dea]).toBe(0xff);
    // The level still ends, secret or not.
    expect(offset(3, 2)[0x1493]).toBe(0xff);
    expect(exec('end_level', { secret: true }).ram[0x141c]).toBe(1);
    expect(exec('end_level', { secret: false }).ram[0x141c]).toBe(0);
  });

  it('Scroll lock locks and unlocks $1411 (horizontal) and $1412 (vertical)', () => {
    const scroll = (locked: boolean, axis: string) =>
      exec('scroll_lock', { locked, axis }, { ram: { 0x1411: 1, 0x1412: 1 } }).ram;
    expect([scroll(true, 'horizontal')[0x1411], scroll(true, 'horizontal')[0x1412]]).toEqual([
      0, 1,
    ]);
    expect([scroll(true, 'vertical')[0x1411], scroll(true, 'vertical')[0x1412]]).toEqual([1, 0]);
    expect([scroll(true, 'both')[0x1411], scroll(true, 'both')[0x1412]]).toEqual([0, 0]);
    const open = (axis: string) =>
      exec('scroll_lock', { locked: false, axis }, { ram: { 0x1411: 0, 0x1412: 0 } }).ram;
    expect([open('horizontal')[0x1411], open('horizontal')[0x1412]]).toEqual([1, 0]);
    expect([open('vertical')[0x1411], open('vertical')[0x1412]]).toEqual([0, 1]);
    expect([open('both')[0x1411], open('both')[0x1412]]).toEqual([1, 1]);
  });

  it('Boost Mario pushes the way Mario faces ($76: 0 left, 1 right), setting or adding', () => {
    const boost = (facing: number, mode: number, speed = 0x10) =>
      exec(
        'boost_mario',
        { x_direction: 'facing', x_strength: 0x20, y_direction: 'none', mode },
        { ram: { 0x76: facing, 0x7b: speed } },
      ).ram[0x7b];
    expect(boost(1, 0)).toBe(0x20);
    expect(boost(0, 0)).toBe(0xe0);
    expect(boost(1, 1)).toBe(0x30);
    expect(boost(0, 1)).toBe(0xf0);
  });

  it('Side exit sets or clears $1B96', () => {
    expect(exec('set_side_exit', { enabled: 'on' }).ram[0x1b96]).toBe(1);
    expect(exec('set_side_exit', { enabled: 'off' }, { ram: { 0x1b96: 1 } }).ram[0x1b96]).toBe(0);
  });
});

describe('Midway point', () => {
  // $13CE is the midway flag; the Midway Point Blocks of the archive play $05 on $1DF9.
  it('sets the flag, with or without the sound', () => {
    const withSound = exec('set_midway', { state: 'set', sound: true });
    expect(withSound.ram[0x13ce]).toBe(1);
    expect(withSound.ram[0x1df9]).toBe(5);
    const silent = exec('set_midway', { state: 'set', sound: false });
    expect(silent.ram[0x13ce]).toBe(1);
    expect(silent.ram[0x1df9]).toBeUndefined();
  });

  it('clears the flag', () => {
    expect(exec('set_midway', { state: 'clear' }, { ram: { 0x13ce: 1 } }).ram[0x13ce]).toBe(0);
  });
});

describe('Cooldown', () => {
  // $14 is SMW's effective frame counter. Cooldown uses 8-bit modular subtraction:
  // ($14 - last_hit_time) >= frames.
  it('allows execution and saves current frame when cooldown has elapsed', () => {
    const result = exec('c_cooldown', { frames: 20 }, { ram: { 0x14: 30, 0x0f3a: 0 } });
    expect(result.falseTaken).toBe(false);
    expect(result.ram[0x0f3a]).toBe(30);
  });

  it('branches to false and preserves RAM when within cooldown period', () => {
    const result = exec('c_cooldown', { frames: 20 }, { ram: { 0x14: 35, 0x0f3a: 30 } });
    expect(result.falseTaken).toBe(true);
    expect(result.ram[0x0f3a]).toBe(30);
  });

  it('correctly handles 8-bit frame counter wrap-around across $FF to $00', () => {
    const duringCooldown = exec('c_cooldown', { frames: 20 }, { ram: { 0x14: 5, 0x0f3a: 250 } });
    expect(duringCooldown.falseTaken).toBe(true);
    expect(duringCooldown.ram[0x0f3a]).toBe(250);

    const afterCooldown = exec('c_cooldown', { frames: 20 }, { ram: { 0x14: 20, 0x0f3a: 250 } });
    expect(afterCooldown.falseTaken).toBe(false);
    expect(afterCooldown.ram[0x0f3a]).toBe(20);
  });

  it('supports custom RAM addresses', () => {
    const result = exec(
      'c_cooldown',
      { frames: 15, address: 'custom', custom_address: 0x7fa400 },
      { ram: { 0x14: 50, 0x7fa400: 0 } },
    );
    expect(result.falseTaken).toBe(false);
    expect(result.ram[0x7fa400]).toBe(50);
  });
});

