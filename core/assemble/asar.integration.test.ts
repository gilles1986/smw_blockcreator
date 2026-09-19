// Assembles generated code with the GPS project's real asar.dll. Skipped where there is none
// (set BLOCKCREATOR_GPS to a GPS folder). `npm run check:asar` runs just this file.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../generator';
import { SLOT_IDS, slotKind, type BlockModel, type Statement } from '../model';
import { findGpsFolder, gpsRoutines, nodeAsarRunner } from '../testing/asar';
import { builtInLibrary } from '../testing/library';
import { checkBlock } from './index';

const gps = findGpsFolder();
const goldenDir = join(import.meta.dirname, '..', 'generator', 'golden');

// Every Piece in every Slot is a few thousand assemblies, which takes a while.
describe.skipIf(!gps)('Asar (GPS project asar.dll)', { timeout: 120_000 }, () => {
  const run = nodeAsarRunner(gps!);
  const library = builtInLibrary();
  const routines = [...gpsRoutines(gps!), ...[...library.routines.keys()]];
  const properties = { name: 'check', description: '', author: '', defaultActAs: 0x130 };

  it.each(readdirSync(goldenDir).filter((name) => name.endsWith('.asm')))(
    'assembles golden %s',
    async (name) => {
      const text = readFileSync(join(goldenDir, name), 'utf8');
      expect(await checkBlock({ text, lineMap: new Map() }, routines, run)).toEqual([]);
    },
  );

  it.each([...library.presets.keys()])('assembles preset %s', async (name) => {
    const text = library.presets.get(name)!.text;
    expect(await checkBlock({ text, lineMap: new Map() }, routines, run)).toEqual([]);
  });

  it('places a typo on the Slot and statement it comes from', async () => {
    const base = library.pieces.get('act_as')!;
    const typo = {
      ...base,
      manifest: { ...base.manifest, id: 'typo', params: [] },
      template: 'LDAX #$30\n',
    };
    const withTypo = { ...library, pieces: new Map([...library.pieces, ['typo', typo]]) };
    const model: BlockModel = {
      properties,
      slots: {
        marioTop: [
          { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
          { type: 'action', piece: { id: 'typo', version: 1, params: {} } },
        ],
      },
    };
    const generated = generate(model, withTypo);
    const problems = await checkBlock(generated, routines, run);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ origin: { slot: 'marioTop', path: '/1' } });
    expect(generated.text.split('\n')[problems[0]!.line! - 1]).toBe('\tLDAX #$30');
  });

  it('puts a typo in a Custom ASM Action on that Action, whichever of its lines it is on', async () => {
    const model: BlockModel = {
      properties,
      slots: {
        spriteLeft: [
          { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
          {
            type: 'action',
            piece: { id: 'custom_asm', version: 1, params: { code: '; fine\nLDAX #$30' } },
          },
        ],
      },
    };
    const generated = generate(model, library);
    const problems = await checkBlock(generated, routines, run);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ origin: { slot: 'spriteLeft', path: '/1' } });
    expect(generated.text.split('\n')[problems[0]!.line! - 1]).toBe('\tLDAX #$30');
  });

  it('assembles every Library Piece with its defaults in every Slot it allows', async () => {
    const failures: string[] = [];
    for (const { manifest } of library.pieces.values()) {
      const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
      const piece = { id: manifest.id, version: manifest.version, params };
      const statement: Statement =
        manifest.kind === 'action'
          ? { type: 'action', piece }
          : { type: 'if', branches: [{ condition: { type: 'condition', piece }, body: [] }] };
      for (const slot of SLOT_IDS) {
        if (manifest.slots !== 'any' && manifest.slots !== slotKind(slot)) continue;
        const generated = generate({ properties, slots: { [slot]: [statement] } }, library);
        for (const problem of await checkBlock(generated, routines, run)) {
          failures.push(`${manifest.id} in ${slot}: ${problem.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('assembles every option of the Pieces of tickets 13, 14 and 23, and what each Piece calls', async () => {
    // Ticket 14: every Level Action, Condition and advanced Piece.
    const ticket14 = [...library.pieces.values()]
      .filter(({ manifest }) => ['level', 'conditions', 'advanced'].includes(manifest.category))
      .map(({ manifest }) => manifest.id);
    const ids = new Set([
      ...ticket14,
      // Ticket 23: the neighbour Pieces (the rest of its Pieces are Level Actions and Conditions).
      'change_adjacent_block',
      'erase_adjacent_block',
      // Ticket 13: the sprite Pieces.
      'spawn_sprite',
      'change_sprite',
      'push_sprite',
      'set_sprite_state',
      'turn_sprite_around',
      'kill_touching_sprite',
    ]);
    const failures: string[] = [];
    for (const id of ids) {
      const { manifest } = library.pieces.get(id)!;
      const defaults = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
      // The defaults, then each option of each choice and switch on its own.
      const variants = [defaults];
      for (const param of manifest.params) {
        const options =
          param.type === 'enum'
            ? param.options!.map((o) => o.value)
            : param.type === 'bool'
              ? [false, true]
              : param.type === 'number' && param.max !== undefined
                ? [param.min ?? 0, param.max]
                : [];
        for (const value of options) variants.push({ ...defaults, [param.name]: value });
      }
      for (const params of variants) {
        const piece = { id, version: manifest.version, params };
        const statement: Statement =
          manifest.kind === 'action'
            ? { type: 'action', piece }
            : { type: 'if', branches: [{ condition: { type: 'condition', piece }, body: [] }] };
        for (const slot of ['marioTop', 'spriteTop'] as const) {
          if (manifest.slots !== 'any' && manifest.slots !== slotKind(slot)) continue;
          const generated = generate({ properties, slots: { [slot]: [statement] } }, library);
          for (const problem of await checkBlock(generated, routines, run)) {
            failures.push(`${id} ${JSON.stringify(params)} in ${slot}: ${problem.message}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('assembles Write RAM and RAM check at every kind of RAM address', async () => {
    const failures: string[] = [];
    // Direct page, absolute, the bank $7E mirror, free RAM in bank $7F, and 24-bit addresses that
    // are none of these: each kind is written another way (see the ram helper of the templates).
    const addresses = [
      0x00, 0x85, 0xff, 0x100, 0x0f44, 0x1fff, 0x2000, 0x7e0019, 0x7e1497, 0x7e2000, 0x7f9c7b,
      0x400000, 0xffffff,
    ];
    for (const address of addresses) {
      const write: Statement = {
        type: 'action',
        piece: { id: 'write_ram', version: 2, params: { address, value: 0x12 } },
      };
      const check: Statement = {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'condition',
              piece: {
                id: 'c_ram',
                version: 2,
                params: { address, comparison: 'equal', value: 1 },
              },
            },
            body: [],
          },
        ],
      };
      for (const statement of [write, check]) {
        for (const slot of ['marioTop', 'spriteTop'] as const) {
          const generated = generate({ properties, slots: { [slot]: [statement] } }, library);
          for (const problem of await checkBlock(generated, routines, run)) {
            failures.push(`$${address.toString(16)} in ${slot}: ${problem.message}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('assembles Spawn sprite with its options together, in a Mario and in a sprite Slot', async () => {
    const together = {
      custom: true,
      sprite_number: 0x30,
      extra_bit: true,
      extra_byte_1: 1,
      extra_byte_2: 2,
      extra_byte_3: 3,
      extra_byte_4: 4,
      x_speed: 16,
      y_speed: -32,
    };
    const failures: string[] = [];
    for (const position of ['inside', 'above', 'below', 'left', 'right', 'offset']) {
      for (const facing of ['keep', 'right', 'left', 'like_mario', 'away']) {
        for (const custom of [true, false]) {
          const params = { ...together, custom, position, facing, x_offset: -8, y_offset: 24 };
          const statement: Statement = {
            type: 'action',
            piece: { id: 'spawn_sprite', version: 2, params },
          };
          for (const slot of ['marioTop', 'spriteTop'] as const) {
            const generated = generate({ properties, slots: { [slot]: [statement] } }, library);
            for (const problem of await checkBlock(generated, routines, run)) {
              failures.push(
                `${position} ${facing} custom=${custom} in ${slot}: ${problem.message}`,
              );
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it.each([...library.routines].map(([name, file]) => [name, file.text] as const))(
    'assembles the tool routine %s, the way GPS wraps a routine into a macro',
    async (name, text) => {
      const main = [
        'lorom',
        'incsrc "defines.asm"',
        `macro ${name}()`,
        text,
        'endmacro',
        'org $108000',
        'Routine:',
        `%${name}()`,
        '',
      ].join('\n');
      const report = await run({ 'main.asm': main }, 'main.asm');
      expect(report.errors).toEqual([]);
    },
  );

  it('assembles the muncher hitbox of Hurt and Kill Mario in the Slots it is meant for', async () => {
    const failures: string[] = [];
    for (const id of ['hurt_mario', 'kill_mario']) {
      const piece = { id, version: 2, params: { side_hitbox: true } };
      const statement: Statement = { type: 'action', piece };
      for (const slot of ['marioLeft', 'marioRight', 'marioInside', 'marioTopCorner'] as const) {
        const generated = generate({ properties, slots: { [slot]: [statement] } }, library);
        for (const problem of await checkBlock(generated, routines, run)) {
          failures.push(`${id} in ${slot}: ${problem.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
