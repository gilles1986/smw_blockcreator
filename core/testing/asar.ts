// Test support: runs the GPS project's asar.dll from Node (koffi), like the app does from Rust.
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import koffi from 'koffi';
import type { AsarMessage, AsarReport, AsarRunner } from '../assemble';

/** The GPS folder to check against: `BLOCKCREATOR_GPS`, else `../GPS` next to this repo. */
export function findGpsFolder(): string | undefined {
  const folder = process.env.BLOCKCREATOR_GPS ?? join(import.meta.dirname, '..', '..', '..', 'GPS');
  return existsSync(join(folder, 'asar.dll')) && existsSync(join(folder, 'defines.asm'))
    ? folder
    : undefined;
}

/** Routine names of the project (`routines/*.asm`), as GPS turns them into macros. */
export function gpsRoutines(gpsFolder: string): string[] {
  const dir = join(gpsFolder, 'routines');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.asm'))
    .map((name) => name.slice(0, -4));
}

interface AsarDll {
  patch: (path: string, rom: Buffer, buflen: number, romlen: number[]) => boolean;
  errors: () => AsarMessage[];
  warnings: () => AsarMessage[];
  maxRomSize: () => number;
}

const loaded = new Map<string, AsarDll>();

function loadAsar(dllPath: string): AsarDll {
  const known = loaded.get(dllPath);
  if (known) return known;
  const lib = koffi.load(dllPath);
  const errordata = koffi.struct(`asar_errordata_${loaded.size}`, {
    fullerrdata: 'const char *',
    rawerrdata: 'const char *',
    block: 'const char *',
    filename: 'const char *',
    line: 'int',
    callerfilename: 'const char *',
    callerline: 'int',
    errid: 'int',
  });
  const pointer = koffi.pointer(errordata);
  const patch = lib.func('asar_patch', 'bool', [
    'const char *',
    koffi.inout('uint8_t *'),
    'int',
    koffi.inout('int *'),
  ]);
  const list = (name: string) => {
    const get = lib.func(name, pointer, [koffi.out('int *')]);
    return (): AsarMessage[] => {
      const count = [0];
      const first = get(count);
      if (!count[0]) return [];
      const rows = koffi.decode(first, koffi.array(errordata, count[0])) as {
        rawerrdata: string;
        filename: string;
        line: number;
      }[];
      // Asar counts lines from 0.
      return rows.map((row) => ({
        file: basename(row.filename ?? ''),
        line: row.line + 1,
        message: row.rawerrdata,
      }));
    };
  };
  const dll: AsarDll = {
    patch,
    errors: list('asar_geterrors'),
    warnings: list('asar_getwarnings'),
    maxRomSize: lib.func('asar_maxromsize', 'int', []),
  };
  loaded.set(dllPath, dll);
  return dll;
}

/** An AsarRunner on the project's asar.dll and defines.asm, in a temporary folder. */
export function nodeAsarRunner(gpsFolder: string): AsarRunner {
  const asar = loadAsar(join(gpsFolder, 'asar.dll'));
  return async (files, entry): Promise<AsarReport> => {
    const dir = mkdtempSync(join(tmpdir(), 'blockcreator-check-'));
    try {
      copyFileSync(join(gpsFolder, 'defines.asm'), join(dir, 'defines.asm'));
      for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
      const rom = Buffer.alloc(asar.maxRomSize());
      asar.patch(join(dir, entry), rom, rom.length, [0x80000]);
      return { errors: asar.errors(), warnings: asar.warnings() };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
