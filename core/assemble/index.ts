// Checking a generated Block with Asar (ADR 4): the pure part. A runner (Tauri in the app,
// node + koffi in tests) writes the files, adds the project's `defines.asm`, loads the
// project's `asar.dll` and returns Asar's messages.

import type { LineOrigin } from '../generator';

/** File names inside the check directory; the runner adds the project's `defines.asm`. */
export const HARNESS_FILE = 'harness.asm';
export const BLOCK_FILE = 'block.asm';

/** One Asar error or warning, with a 1-based line. */
export interface AsarMessage {
  /** File name without directory, e.g. `block.asm`. */
  file: string;
  line: number;
  message: string;
}

/** What a runner reports for one assembly. */
export interface AsarReport {
  errors: AsarMessage[];
  warnings: AsarMessage[];
}

/** Assembles the files in `files` starting at `entry`, with the project's defines next to them. */
export type AsarRunner = (files: Record<string, string>, entry: string) => Promise<AsarReport>;

/** An Asar message placed on the Slot and statement it comes from, where the line tells. */
export interface CheckProblem {
  message: string;
  /** Line in the generated Block file. */
  line?: number;
  origin?: LineOrigin;
}

const MACRO_NAME = /^[A-Za-z_]\w*$/;

/**
 * Asar input around a Block, the way GPS builds it: the project's defines, the routines as
 * macros (stubs here: a check needs their names, not their code), then the Block.
 */
export function buildHarness(routines: readonly string[]): string {
  const names = [...new Set(routines)].filter((name) => MACRO_NAME.test(name)).sort();
  return [
    '; BlockCreator check harness, not part of the Block',
    'lorom',
    'incsrc "defines.asm"',
    ...names.flatMap((name) => [`macro ${name}()`, '\tJSL BlockCreatorRoutineStub', 'endmacro']),
    'org $108000',
    'BlockCreatorRoutineStub:',
    '\tRTL',
    `incsrc "${BLOCK_FILE}"`,
    '',
  ].join('\n');
}

/** Places Asar's messages on Slots and statements via the generator's line map. */
export function mapAsarMessages(
  messages: readonly AsarMessage[],
  lineMap: ReadonlyMap<number, LineOrigin>,
): CheckProblem[] {
  return messages.map(({ file, line, message }) => {
    if (file !== BLOCK_FILE) return { message: `${file} line ${line}: ${message}` };
    const origin = lineMap.get(line);
    return origin ? { message, line, origin } : { message, line };
  });
}

/** Generates nothing itself: assembles `text` (a generated Block) and maps the errors. */
export async function checkBlock(
  generated: { text: string; lineMap: ReadonlyMap<number, LineOrigin> },
  routines: readonly string[],
  run: AsarRunner,
): Promise<CheckProblem[]> {
  const report = await run(
    { [HARNESS_FILE]: buildHarness(routines), [BLOCK_FILE]: generated.text },
    HARNESS_FILE,
  );
  return mapAsarMessages(report.errors, generated.lineMap);
}
