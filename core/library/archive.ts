// Packing Pieces into a .zip archive and back, for sharing user Pieces. Pure string/byte work;
// reading and writing the file is the caller's job (Tauri commands in the app).

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/** An archive entry: a Piece file, nothing else. */
const ENTRY_PATH = /^(actions|conditions)\/[a-z][a-z0-9_]*\/(piece\.json|code\.asm)$/;

/**
 * Packs Piece files (`actions/<id>/piece.json`, …) into a .zip. Paths that are not Piece files are
 * left out, so the archive cannot smuggle anything the Library loader would not read anyway.
 */
export function packPieces(files: Readonly<Record<string, string>>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, text] of Object.entries(files)) {
    if (ENTRY_PATH.test(path)) entries[path] = strToU8(text);
  }
  return zipSync(entries);
}

export class ArchiveError extends Error {}

/**
 * Unpacks a .zip back into Piece files. Anything that is not a Piece file (other paths, `..`,
 * nested folders) is skipped. Throws ArchiveError when the bytes are not a zip at all.
 */
export function unpackPieces(bytes: Uint8Array): Record<string, string> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (error) {
    throw new ArchiveError(`not a zip archive: ${(error as Error).message}`);
  }
  const files: Record<string, string> = {};
  for (const [name, data] of Object.entries(entries)) {
    const path = name.replace(/\\/g, '/');
    if (ENTRY_PATH.test(path)) files[path] = strFromU8(data);
  }
  return files;
}
