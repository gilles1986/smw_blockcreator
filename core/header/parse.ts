// Reading side of the machine header (ADR 1): only the `;@bc-*` lines are read; the code below
// them is always regenerated.

import { MODEL_FORMAT, type BlockModel } from '../model';
import { checkModel } from '../model/schema';
import { describeFieldError } from '../validation';
import { bodyChecksum, HEADER } from './write';

export type ParseResult =
  | {
      ok: true;
      model: BlockModel;
      /** False when the text below the header was edited by hand. */
      checksumOk: boolean;
    }
  | { ok: false; reason: 'not-blockcreator' | 'newer-format' | 'invalid'; message: string };

/**
 * Migrations from older formats, keyed by the format they upgrade from. Format 1 is the first,
 * so the table is empty; add `1: (json) => …` when format 2 changes the model.
 */
const MIGRATIONS: Readonly<Record<number, (json: unknown) => unknown>> = {};

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

export function parse(text: string): ParseResult {
  // Editors may add a byte-order mark.
  const withoutBom = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const lines = withoutBom.split('\n');
  const line = (i: number) => (lines[i] ?? '').replace(/\r$/, '');
  const format = headerValue(line(0), HEADER.format, /^\d+$/);
  // [\s\S], not `.`: JSON leaves U+2028 / U+2029 unescaped, and `.` does not match them.
  const model = headerValue(line(1), HEADER.model, /^[\s\S]*$/);
  const checksum = headerValue(line(2), HEADER.checksum, /^[0-9a-f]{8}$/);
  if (format === undefined || model === undefined || checksum === undefined) {
    return { ok: false, reason: 'not-blockcreator', message: 'Not a BlockCreator block.' };
  }
  const version = Number(format);
  if (version > MODEL_FORMAT) {
    return {
      ok: false,
      reason: 'newer-format',
      message: `This Block was made with a newer BlockCreator (format ${version}). Update BlockCreator to open it.`,
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(model);
  } catch (error) {
    return invalid(`The ;@bc-model header is not valid JSON: ${(error as Error).message}`);
  }
  for (let from = version; from < MODEL_FORMAT; from++) {
    const migrate = MIGRATIONS[from];
    if (!migrate) return invalid(`BlockCreator cannot read format ${version} any more.`);
    json = migrate(json);
  }
  const [problem] = checkModel(json);
  if (problem) {
    return invalid(`The ;@bc-model header is not a valid Block: ${describeFieldError(problem)}`);
  }
  const body = lines.slice(3).join('\n');
  return { ok: true, model: json as BlockModel, checksumOk: bodyChecksum(body) === checksum };
}

/** The value after `prefix` when `line` starts with it and the value has the expected shape. */
function headerValue(line: string, prefix: string, shape: RegExp): string | undefined {
  if (!line.startsWith(prefix)) return undefined;
  const value = line.slice(prefix.length);
  return shape.test(value) ? value : undefined;
}

function invalid(message: string): ParseResult {
  return { ok: false, reason: 'invalid', message };
}
