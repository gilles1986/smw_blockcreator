import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../generator';
import { parse } from '../header';
import { checkPieces, type BlockModel, type PieceRef, type SlotId, type Statement } from '../model';
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

/** A Piece use as one line: `act_as tile=304`, the parameters by name. */
function line(ref: PieceRef): string {
  const params = Object.entries(ref.params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`);
  return [ref.id, ...params].join(' ');
}

/** What a Slot does, as lines: `if c_onoff position=0 { act_as tile=304 } else { act_as tile=37 }`. */
function outline(statements: Statement[] | undefined): string[] {
  return (statements ?? []).map((statement) => {
    if (statement.type === 'action') return line(statement.piece);
    if (statement.type !== 'if') throw new Error('the Presets only use Actions and if / else');
    const braces = (body: Statement[]) => `{ ${outline(body).join('; ')} }`;
    const [first] = statement.branches;
    if (statement.branches.length !== 1 || first?.condition.type !== 'condition') {
      throw new Error('the Presets only use a plain if / else');
    }
    return (
      `if ${line(first.condition.piece)} ${braces(first.body)}` +
      (statement.else ? ` else ${braces(statement.else)}` : '')
    );
  });
}

/** The Slots of a Preset that hold statements, as lines, and the links between Slots. */
function shape(model: BlockModel): { slots: Partial<Record<SlotId, string[]>>; links: object } {
  return {
    slots: Object.fromEntries(
      Object.entries(model.slots)
        .filter(([, statements]) => statements.length > 0)
        .map(([slot, statements]) => [slot, outline(statements)]),
    ),
    links: model.slotLinks ?? {},
  };
}

const AIR = 'act_as tile=37';
const SOLID = 'act_as tile=304';
const USED_BLOCK = 'change_to_tile tile=306';

describe('the Presets of ticket 18', () => {
  it('are these, each named as its file, with a description and a default act as', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([
      'bonus_star_goal',
      'boost_away',
      'brick_block',
      'coin_once',
      'death_block',
      'key_lock',
      'kicked_shell_spawner',
      'lava_bounce',
      'mario_passable',
      'midway_block',
      'muncher',
      'muncher_sprite_killer',
      'no_yoshi',
      'note_block',
      'one_way',
      'onoff_solid',
      'question_block_coin',
      'question_block_powerup',
      'sprite_passable',
      'sticky_ceiling',
      'toll_block',
      'water_toggle',
      'yoshi_coin_gate',
    ]);
    for (const [name, model] of Object.entries(PRESETS)) {
      expect(model.properties.name, name).toBe(name);
      expect(model.properties.description.length, name).toBeGreaterThan(20);
      expect(model.properties.defaultActAs, name).toBe(0x130);
    }
  });

  it('never leave a one-shot Action to run again while Mario touches the block', () => {
    const check = (statements: Statement[], where: string) => {
      const pieces = statements.flatMap((s) => (s.type === 'action' ? [s.piece.id] : []));
      const manifests = pieces.map((id) => library.pieces.get(id)!.manifest);
      const once = manifests.filter((m) => m.once).map((m) => m.id);
      const removes = manifests.some((m) => m.removesBlock);
      expect(
        once.length === 0 || removes,
        `${where}: ${once.join(', ')} needs a Piece that removes the block`,
      ).toBe(true);
      for (const s of statements) {
        if (s.type !== 'if') continue;
        for (const branch of s.branches) check(branch.body, where);
        if (s.else) check(s.else, where);
      }
    };
    for (const [name, model] of Object.entries(PRESETS)) {
      for (const [slot, statements] of Object.entries(model.slots))
        check(statements, `${name} ${slot}`);
    }
  });

  it('onoff_solid: solid while the switch is ON, air while it is OFF, for Mario and for sprites', () => {
    const rule = `if c_onoff position=0 { ${SOLID} } else { ${AIR} }`;
    expect(shape(PRESETS.onoff_solid!)).toEqual({
      slots: {
        marioTop: [rule],
        marioBottom: [rule],
        marioLeft: [rule],
        spriteTop: [rule],
        spriteBottom: [rule],
        spriteLeft: [rule],
      },
      links: { marioRight: 'marioLeft', spriteRight: 'spriteLeft' },
    });
  });

  it('mario_passable: air for Mario on every side, and solid for sprites', () => {
    expect(shape(PRESETS.mario_passable!)).toEqual({
      slots: {
        marioTop: [AIR],
        marioBottom: [AIR],
        marioLeft: [AIR],
        marioInside: [AIR],
      },
      links: { marioRight: 'marioLeft' },
    });
  });

  it('sprite_passable: air for sprites on every side, and solid for Mario', () => {
    expect(shape(PRESETS.sprite_passable!)).toEqual({
      slots: { spriteTop: [AIR], spriteBottom: [AIR], spriteLeft: [AIR] },
      links: { spriteRight: 'spriteLeft' },
    });
  });

  it('one_way: solid from above only, when Mario really stands on it; sprites too', () => {
    expect(shape(PRESETS.one_way!)).toEqual({
      slots: {
        marioTop: [`if c_really_on_top { ${SOLID} } else { ${AIR} }`],
        marioBottom: [AIR],
        marioLeft: [AIR],
        marioInside: [AIR],
        spriteTop: [SOLID],
        spriteBottom: [AIR],
        spriteLeft: [AIR],
      },
      links: { marioRight: 'marioLeft', spriteRight: 'spriteLeft' },
    });
  });

  it('boost_away: pushes Mario away from the side he touches, one Piece for every side', () => {
    const boost =
      'boost_mario mode=0 x_direction=away x_strength=48 y_direction=away y_strength=96';
    expect(shape(PRESETS.boost_away!)).toEqual({
      slots: { marioTop: [boost], marioBottom: [boost], marioLeft: [boost] },
      links: { marioRight: 'marioLeft' },
    });
  });

  it('kicked_shell_spawner: a green shell flies off up and to the right, the block is used up', () => {
    const [spawn, used] = PRESETS.kicked_shell_spawner!.slots.marioBottom!;
    expect(spawn).toMatchObject({
      type: 'action',
      piece: {
        id: 'spawn_sprite',
        params: {
          custom: false,
          sprite_number: 0xda,
          position: 'above',
          state: 0x0a,
          x_speed: 32,
          y_speed: -48,
          facing: 'right',
        },
      },
    });
    expect(outline([used!])).toEqual([USED_BLOCK]);
    expect(Object.keys(shape(PRESETS.kicked_shell_spawner!).slots)).toEqual(['marioBottom']);
  });

  it('coin_once: one coin from below, then a used block', () => {
    expect(shape(PRESETS.coin_once!)).toEqual({
      slots: { marioBottom: ['give_coins amount=1', USED_BLOCK] },
      links: {},
    });
  });

  it('water_toggle: pressing Up on top flips the water flag, once per press', () => {
    expect(shape(PRESETS.water_toggle!)).toEqual({
      slots: {
        marioTop: [
          'if c_button button=up mode=pressed { ' +
            'if c_ram address=133 comparison=equal value=0 { write_ram address=133 value=1 } ' +
            'else { write_ram address=133 value=0 } }',
        ],
      },
      links: {},
    });
  });

  it('muncher_sprite_killer: hurts Mario like the muncher, and every sprite that touches it dies', () => {
    const muncher = shape(PRESETS.muncher!);
    const killer = shape(PRESETS.muncher_sprite_killer!);
    expect(killer.slots).toEqual({
      ...muncher.slots,
      spriteTop: ['kill_touching_sprite style=0'],
    });
    expect(killer.links).toEqual({
      ...muncher.links,
      spriteBottom: 'spriteTop',
      spriteLeft: 'spriteTop',
      spriteRight: 'spriteTop',
    });
  });
});
