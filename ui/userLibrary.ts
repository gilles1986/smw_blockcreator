// The desktop app's side of the user's own Pieces (src-tauri/src/userlibrary.rs): a folder with
// the same layout as the built-in Library, in the app's data dir or next to the .exe as the user
// chose (settings.ts). In a plain browser there are no user Pieces.

import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  isPieceFile,
  loadLibrary,
  packPieces,
  unpackPieces,
  type KindFolder,
  type Library,
  type Piece,
} from '../core/library';
import { getPiecesLocation, type PiecesLocation } from './settings';

/** Whether user Pieces can be loaded, written and shared (the desktop app). */
export const userLibrarySupported = isTauri();

/** The Piece files (`/`-separated relative path, text) in the folder at `location`. */
export async function pieceFilesAt(location: PiecesLocation): Promise<[string, string][]> {
  const entries = await invoke<[string, string][]>('user_pieces_read_all', { location });
  return entries.filter(([path]) => isPieceFile(path));
}

/** Reads the user's Piece folder and builds its Library; an absent folder is an empty Library. */
export async function loadUserLibrary(): Promise<Library> {
  const entries = await invoke<[string, string][]>('user_pieces_read_all', {
    location: getPiecesLocation(),
  });
  return loadLibrary(Object.fromEntries(entries), 'user');
}

/** Where the user's Pieces are, for showing it in the UI. */
export const userPiecesDir = (location: PiecesLocation = getPiecesLocation()) =>
  invoke<string>('user_pieces_dir', { location });

/** Whether Pieces can be saved at `location`: next to a program in `C:\Program Files`, no. */
export const userPiecesWritable = (location: PiecesLocation = getPiecesLocation()) =>
  invoke<boolean>('user_pieces_writable', { location });

/**
 * Writes one file of a user Piece: `path` is `actions/<id>/piece.json` or
 * `conditions/<id>/code.asm`; the folders are made on the way.
 */
export const writeUserPieceFile = (
  path: string,
  text: string,
  location: PiecesLocation = getPiecesLocation(),
) => invoke<void>('user_piece_write', { location, path, text });

/** Deletes a whole user Piece; `path` is `actions/<id>` or `conditions/<id>`. */
export const deleteUserPiece = (path: string) =>
  invoke<void>('user_piece_delete', { location: getPiecesLocation(), path });

/** How many Pieces (folders) a list of Piece files makes up. */
export const countPieces = (files: readonly (readonly [string, string])[]): number =>
  new Set(files.map(([path]) => path.split('/').slice(0, 2).join('/'))).size;

/** What switching to another place did to the user's Pieces. */
export interface LocationSwitch {
  /** The Pieces that were copied over from the old place: 0 when none were. */
  copied: number;
  /** The Pieces already at the new place, which are used as they are. */
  alreadyThere: number;
}

/**
 * Makes `next` the place of the user's Pieces. When the new place has none and the old one has,
 * `askCopy` is asked whether to copy them over (they stay in the old place too); when both have
 * some, nothing is touched and the ones at the new place are the ones in use.
 */
export async function switchPiecesLocation(
  next: PiecesLocation,
  previous: PiecesLocation,
  askCopy: (count: number, from: string, to: string) => Promise<boolean>,
): Promise<LocationSwitch> {
  const [there, before] = await Promise.all([pieceFilesAt(next), pieceFilesAt(previous)]);
  if (next === previous || there.length > 0 || before.length === 0) {
    return { copied: 0, alreadyThere: countPieces(there) };
  }
  const [from, to] = await Promise.all([userPiecesDir(previous), userPiecesDir(next)]);
  const count = countPieces(before);
  if (!(await askCopy(count, from, to))) return { copied: 0, alreadyThere: 0 };
  for (const [path, text] of before) await writeUserPieceFile(path, text, next);
  return { copied: count, alreadyThere: 0 };
}

/** Reads a dialog-picked .zip of Pieces as bytes. */
export const readArchive = async (path: string) =>
  new Uint8Array(await invoke<number[]>('archive_read', { path }));

/** Writes a .zip of Pieces to a dialog-picked path. */
export const writeArchive = (path: string, bytes: Uint8Array) =>
  invoke<void>('archive_write', { path, bytes: Array.from(bytes) });

/** Opens the user's Pieces directory in Windows Explorer, making it first if it is not there. */
export async function openUserPiecesFolder(): Promise<void> {
  if (!isTauri()) return;
  const dir = await invoke<string>('user_pieces_make_dir', { location: getPiecesLocation() });
  await openPath(dir);
}

/** Exports pieces to a .zip archive chosen via native save dialog. */
export async function exportPiecesZip(
  pieces: readonly Piece[],
  defaultName = 'pieces.zip',
): Promise<boolean> {
  if (!isTauri() || pieces.length === 0) return false;
  const target = await save({
    defaultPath: defaultName,
    filters: [{ name: 'Pieces Archive', extensions: ['zip'] }],
  });
  if (!target) return false;

  const files: Record<string, string> = {};
  for (const piece of pieces) {
    const kindFolder = piece.manifest.kind === 'action' ? 'actions' : 'conditions';
    const jsonPath = `${kindFolder}/${piece.manifest.id}/piece.json`;
    const asmPath = `${kindFolder}/${piece.manifest.id}/code.asm`;
    files[jsonPath] = JSON.stringify(piece.manifest, null, 2);
    files[asmPath] = piece.template;
  }
  const bytes = packPieces(files);
  await writeArchive(target, bytes);
  return true;
}

export interface ImportResult {
  importedCount: number;
  ids: string[];
}

/** Imports pieces from a user-selected .zip archive into the user Library. */
export async function importPiecesZip(): Promise<ImportResult | null> {
  if (!isTauri()) return null;
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Pieces Archive', extensions: ['zip'] }],
  });
  if (typeof path !== 'string') return null;

  const bytes = await readArchive(path);
  const files = unpackPieces(bytes);
  const importedIds = new Set<string>();

  for (const [relPath, content] of Object.entries(files)) {
    await writeUserPieceFile(relPath, content);
    const match = /^(actions|conditions)\/([^/]+)\//.exec(relPath);
    if (match) importedIds.add(match[2]!);
  }

  return {
    importedCount: importedIds.size,
    ids: Array.from(importedIds),
  };
}

/** Saves a custom Piece (manifest + template) and deletes the old folder if renamed. */
export async function saveCustomPiece(
  kindFolder: KindFolder,
  id: string,
  manifestJson: string,
  template: string,
  oldDir?: string,
): Promise<void> {
  if (oldDir && oldDir !== `${kindFolder}/${id}`) {
    await deleteUserPiece(oldDir);
  }
  await writeUserPieceFile(`${kindFolder}/${id}/piece.json`, manifestJson);
  await writeUserPieceFile(`${kindFolder}/${id}/code.asm`, template);
}

/** Deletes a custom Piece. */
export async function deleteCustomPiece(kindFolder: KindFolder, id: string): Promise<void> {
  await deleteUserPiece(`${kindFolder}/${id}`);
}
