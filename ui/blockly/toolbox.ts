// Blockly toolbox (JSON) built from the Library: Logic first, then Piece categories.

import type { Library } from '../../core/library';
import { fitsSlot, type SlotKind } from '../../core/model';
import { pieceBlockType } from './blocks';
import { categoryColour, categoryName, KNOWN_CATEGORIES, type Colour } from './categories';
import { fieldCodec, type FieldValue } from './fields';

/** Blockly's built-in if / else if / else block. */
export const IF_BLOCK = 'controls_if';

export interface ToolboxBlock {
  kind: 'block';
  type: string;
  extraState?: Record<string, unknown>;
  fields?: Record<string, FieldValue>;
}

export interface ToolboxCategory {
  kind: 'category';
  name: string;
  colour: Colour;
  contents: ToolboxBlock[];
}

export interface Toolbox {
  kind: 'categoryToolbox';
  contents: ToolboxCategory[];
}

const LOGIC: ToolboxCategory = {
  kind: 'category',
  name: 'Logic',
  colour: '#5b80a5',
  contents: [
    { kind: 'block', type: IF_BLOCK },
    { kind: 'block', type: IF_BLOCK, extraState: { hasElse: true } },
  ],
};

/** The toolbox for a Slot of the given kind: Pieces for the other kind are left out. */
export function toolbox(library: Library, kind: SlotKind): Toolbox {
  const byCategory = new Map<string, { name: string; block: ToolboxBlock }[]>();
  for (const { manifest } of library.pieces.values()) {
    if (!fitsSlot(manifest.slots, kind)) continue;
    const blocks = byCategory.get(manifest.category) ?? [];
    // Explicit defaults: a dropdown would otherwise start on its first option.
    const fields = Object.fromEntries(
      manifest.params.map((param) => [param.name, fieldCodec(param).toField(param.default)]),
    );
    blocks.push({
      name: manifest.name,
      block: {
        kind: 'block',
        type: pieceBlockType(manifest.id),
        ...(manifest.params.length > 0 && { fields }),
      },
    });
    byCategory.set(manifest.category, blocks);
  }
  const known = Object.keys(KNOWN_CATEGORIES);
  const order = (category: string) => {
    const index = known.indexOf(category);
    return index >= 0 ? index : known.length;
  };
  const categories = [...byCategory.keys()].sort((a, b) => order(a) - order(b) || byText(a, b));
  return {
    kind: 'categoryToolbox',
    contents: [
      LOGIC,
      ...categories.map((category) => ({
        kind: 'category' as const,
        name: categoryName(category),
        colour: categoryColour(category),
        contents: byCategory
          .get(category)!
          .sort((a, b) => byText(a.name, b.name))
          .map(({ block }) => block),
      })),
    ],
  };
}

/** Locale-independent string order, so the toolbox looks the same everywhere. */
function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
