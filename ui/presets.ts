// The Presets of the Library for "New from preset…": ready-made Blocks (library/presets/*.asm)
// that open as a copy. They are read like any Block file, by their header.

import { parse } from '../core/header';
import type { Library } from '../core/library';
import { checkPieces, type BlockModel } from '../core/model';

export interface Preset {
  /** The file name without `.asm`. */
  id: string;
  name: string;
  description: string;
  model: BlockModel;
}

/**
 * The Library's Presets by name. A file that is not a BlockCreator Block, or that uses a Piece
 * this Library does not have, is left out rather than offered and then refused.
 */
export function presetList(library: Library): Preset[] {
  const presets: Preset[] = [];
  for (const [id, file] of library.presets) {
    const result = parse(file.text);
    if (!result.ok || checkPieces(result.model, library).length > 0) continue;
    const { name, description } = result.model.properties;
    presets.push({ id, name, description, model: result.model });
  }
  return presets.sort((a, b) => a.name.localeCompare(b.name));
}
