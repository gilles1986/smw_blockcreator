// A Block records the version of every Piece it was made with. The Library it is opened with can
// have other versions, or lack the Piece (ticket 16). This says which, and brings the older ones up
// to date: the generator uses the Library's template whatever the Block recorded, so what changes
// for the user is the parameters.

import type { Library, ParamSpec } from '../library';
import type { Value } from '../template';
import { valueProblem } from './check';
import { mapPieces } from './pieces';
import type { BlockModel, PieceRef } from './index';

/** A Piece the Block had in an older version than the Library has. */
export interface PieceUpgrade {
  id: string;
  name: string;
  from: number;
  to: number;
  /** Values the Block had for parameters the Piece does not have any more; they are gone. */
  dropped: string[];
  /** Parameters whose value no longer fits (out of range, an option that is gone): now the default. */
  reset: string[];
}

/** A Piece the Block has in a newer version than the Library has (made with a newer Library). */
export interface PieceAhead {
  id: string;
  name: string;
  recorded: number;
  installed: number;
}

export interface Upgraded {
  /** The Block with the older Pieces brought up to the Library's version; the input is untouched. */
  model: BlockModel;
  upgraded: PieceUpgrade[];
  ahead: PieceAhead[];
  /** Ids of Pieces the Library does not have, sorted. The model keeps them as they were. */
  missing: string[];
}

export function upgradePieces(model: BlockModel, library: Library): Upgraded {
  const upgraded = new Map<string, PieceUpgrade>();
  const ahead = new Map<string, PieceAhead>();
  const missing = new Set<string>();
  const next = mapPieces(model, (ref) => {
    const found = library.pieces.get(ref.id);
    if (!found) {
      missing.add(ref.id);
      return ref;
    }
    const { manifest } = found;
    if (ref.version === manifest.version) return ref;
    if (ref.version > manifest.version) {
      const known = ahead.get(ref.id);
      if (!known || known.recorded < ref.version) {
        ahead.set(ref.id, {
          id: ref.id,
          name: manifest.name,
          recorded: ref.version,
          installed: manifest.version,
        });
      }
      return ref;
    }
    const { piece, dropped, reset } = bringUp(ref, manifest.params, manifest.version);
    const key = `${ref.id}@${ref.version}`;
    const before = upgraded.get(key);
    upgraded.set(key, {
      id: ref.id,
      name: manifest.name,
      from: ref.version,
      to: manifest.version,
      dropped: union(before?.dropped, dropped),
      reset: union(before?.reset, reset),
    });
    return piece;
  });
  return {
    model: next,
    upgraded: [...upgraded.values()],
    ahead: [...ahead.values()],
    missing: [...missing].sort(),
  };
}

/** One use of an older Piece as its newer version wants it. */
function bringUp(
  ref: PieceRef,
  params: readonly ParamSpec[],
  version: number,
): { piece: PieceRef; dropped: string[]; reset: string[] } {
  const values: Record<string, Value> = {};
  const reset: string[] = [];
  for (const param of params) {
    const value = ref.params[param.name];
    if (value === undefined) {
      values[param.name] = param.default;
    } else if (valueProblem(param, value)) {
      values[param.name] = param.default;
      reset.push(param.name);
    } else {
      values[param.name] = value;
    }
  }
  const dropped = Object.keys(ref.params).filter((name) => !params.some((p) => p.name === name));
  return { piece: { id: ref.id, version, params: values }, dropped, reset };
}

function union(a: string[] = [], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}
