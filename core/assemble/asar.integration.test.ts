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

describe.skipIf(!gps)('Asar (GPS project asar.dll)', () => {
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

  it('assembles every Library Piece with its defaults in each kind of Slot it allows', async () => {
    const failures: string[] = [];
    for (const { manifest } of library.pieces.values()) {
      const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
      const piece = { id: manifest.id, version: manifest.version, params };
      const statement: Statement =
        manifest.kind === 'action'
          ? { type: 'action', piece }
          : { type: 'if', branches: [{ condition: { type: 'condition', piece }, body: [] }] };
      for (const slot of SLOT_IDS.filter((s) => s === 'marioTop' || s === 'spriteTop')) {
        if (manifest.slots !== 'any' && manifest.slots !== slotKind(slot)) continue;
        const generated = generate({ properties, slots: { [slot]: [statement] } }, library);
        for (const problem of await checkBlock(generated, routines, run)) {
          failures.push(`${manifest.id} in ${slot}: ${problem.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
