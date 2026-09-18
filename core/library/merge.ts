import type { Library, LibraryError, Piece } from './load';

/**
 * Combines the built-in and the user Library. On the same Piece id, routine name or Preset name the
 * user's entry wins. A Piece whose routines are in neither Library is left out with an error.
 */
export function mergeLibraries(builtIn: Library, user: Library): Library {
  const routines = new Map([...builtIn.routines, ...user.routines]);
  const pieces = new Map<string, Piece>();
  const errors: LibraryError[] = [...builtIn.errors, ...user.errors];
  for (const [id, piece] of [...builtIn.pieces, ...user.pieces]) {
    pieces.set(id, piece);
  }
  for (const [id, piece] of pieces) {
    const missing = piece.manifest.routines.flatMap((name, i) =>
      routines.has(name) ? [] : [{ name, i }],
    );
    if (missing.length === 0) continue;
    pieces.delete(id);
    errors.push(
      ...missing.map(({ name, i }) => ({
        origin: piece.origin,
        file: `${piece.dir}/piece.json`,
        field: `routines[${i}]`,
        message: `'${name}' is in neither the built-in nor the user Library`,
      })),
    );
  }
  return { pieces, routines, presets: new Map([...builtIn.presets, ...user.presets]), errors };
}
