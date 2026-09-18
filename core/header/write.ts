// Writing side of the machine header (ADR 1); ./parse.ts reads it.
//
//   ;@bc-format <n>
//   ;@bc-model <canonical JSON of the Block model>
//   ;@bc-checksum <bodyChecksum of everything below this line>

import { MODEL_FORMAT, type BlockModel } from '../model';
import { checksum } from './checksum';
import { canonicalJson } from './json';

/**
 * Checksum of the text below the machine header. Line endings and trailing newlines are
 * normalised first: a CRLF conversion by git or an editor is not a hand edit.
 */
export function bodyChecksum(body: string): string {
  return checksum(body.replace(/\r\n/g, '\n').replace(/\n*$/, '\n'));
}

/** Line prefixes of the machine header, in order; shared with ./parse.ts. */
export const HEADER = {
  format: ';@bc-format ',
  model: ';@bc-model ',
  checksum: ';@bc-checksum ',
} as const;

/** Prepends the machine header to `body`, the generated text below it. */
export function writeBlockFile(model: BlockModel, body: string): string {
  const header = [
    HEADER.format + MODEL_FORMAT,
    HEADER.model + canonicalJson(model),
    HEADER.checksum + bodyChecksum(body),
  ];
  return header.map((line) => line + '\n').join('') + body;
}
