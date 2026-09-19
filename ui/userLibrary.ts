// The desktop app's side of the user's own Pieces (src-tauri/src/userlibrary.rs): a folder under
// the app's data dir with the same layout as the built-in Library. In a plain browser there are
// no user Pieces.

import { invoke, isTauri } from '@tauri-apps/api/core';
import { loadLibrary, type Library } from '../core/library';

/** Whether user Pieces can be loaded, written and shared (the desktop app). */
export const userLibrarySupported = isTauri();

/** Reads the user's Piece folder and builds its Library; an absent folder is an empty Library. */
export async function loadUserLibrary(): Promise<Library> {
  const entries = await invoke<[string, string][]>('user_pieces_read_all');
  return loadLibrary(Object.fromEntries(entries), 'user');
}

/** Where the user's Pieces are, for showing it in the UI. */
export const userPiecesDir = () => invoke<string>('user_pieces_dir');

/**
 * Writes one file of a user Piece: `path` is `actions/<id>/piece.json` or
 * `conditions/<id>/code.asm`; the folders are made on the way.
 */
export const writeUserPieceFile = (path: string, text: string) =>
  invoke<void>('user_piece_write', { path, text });

/** Deletes a whole user Piece; `path` is `actions/<id>` or `conditions/<id>`. */
export const deleteUserPiece = (path: string) => invoke<void>('user_piece_delete', { path });

/** Reads a dialog-picked .zip of Pieces as bytes. */
export const readArchive = async (path: string) =>
  new Uint8Array(await invoke<number[]>('archive_read', { path }));

/** Writes a .zip of Pieces to a dialog-picked path. */
export const writeArchive = (path: string, bytes: Uint8Array) =>
  invoke<void>('archive_write', { path, bytes: Array.from(bytes) });
