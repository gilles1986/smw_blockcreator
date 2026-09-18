// Writing side of the machine header (ADR 1); ticket 06 adds `parse` next to it.
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

/** Prepends the machine header to `body`, the generated text below it. */
export function writeBlockFile(model: BlockModel, body: string): string {
  const header = [
    `;@bc-format ${MODEL_FORMAT}`,
    `;@bc-model ${canonicalJson(model)}`,
    `;@bc-checksum ${bodyChecksum(body)}`,
  ];
  return header.map((line) => line + '\n').join('') + body;
}
