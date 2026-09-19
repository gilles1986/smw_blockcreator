// Blockly toolbox (JSON) built from the Library: Logic first, then Piece categories.

import { searchPieces, type Library, type Manifest } from '../../core/library';
import { fitsSlot, type SlotKind } from '../../core/model';
import { pieceBlockType } from './blocks';
import { categoryColour, categoryName, KNOWN_CATEGORIES, type Colour } from './categories';
import { fieldCodec, type FieldValue } from './fields';

/** Blockly's built-in if / else if / else block. */
export const IF_BLOCK = 'controls_if';
/** Blockly's built-in AND / OR block and NOT block, with their input names. */
export const AND_OR_BLOCK = 'logic_operation';
export const AND_OR_INPUTS = ['A', 'B'] as const;
export const NOT_BLOCK = 'logic_negate';
export const NOT_INPUT = 'BOOL';

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
    // Ready-made else-if branches, so the block's gear (mutator) is not needed for the common cases.
    { kind: 'block', type: IF_BLOCK, extraState: { elseIfCount: 1 } },
    { kind: 'block', type: IF_BLOCK, extraState: { elseIfCount: 1, hasElse: true } },
    { kind: 'block', type: AND_OR_BLOCK, fields: { OP: 'AND' } },
    { kind: 'block', type: AND_OR_BLOCK, fields: { OP: 'OR' } },
    { kind: 'block', type: NOT_BLOCK },
  ],
};

/** The colour of the Search category, which stands out from the Piece categories. */
const SEARCH_COLOUR = '#f2b233';

/** A Piece as a toolbox block, with its default values in place. */
function pieceToolboxBlock(manifest: Manifest): ToolboxBlock {
  // Explicit defaults: a dropdown would otherwise start on its first option.
  const fields = Object.fromEntries(
    manifest.params.map((param) => [param.name, fieldCodec(param).toField(param.default)]),
  );
  return {
    kind: 'block',
    type: pieceBlockType(manifest.id),
    ...(manifest.params.length > 0 && { fields }),
  };
}

/**
 * The toolbox for a Slot of the given kind: Pieces for the other kind are left out. With a search
 * query, the Pieces it finds (`searchPieces`, best first) are a category on top of the others.
 */
export function toolbox(library: Library, kind: SlotKind, query = ''): Toolbox {
  const byCategory = new Map<string, { name: string; block: ToolboxBlock }[]>();
  for (const { manifest } of library.pieces.values()) {
    if (!fitsSlot(manifest.slots, kind)) continue;
    const blocks = byCategory.get(manifest.category) ?? [];
    blocks.push({ name: manifest.name, block: pieceToolboxBlock(manifest) });
    byCategory.set(manifest.category, blocks);
  }
  const found = query.trim() === '' ? undefined : searchPieces(library, query, { slotKind: kind });
  const search: ToolboxCategory[] = found
    ? [
        {
          kind: 'category',
          name: found.length > 0 ? `Search: ${found.length} found` : 'Search: nothing found',
          colour: SEARCH_COLOUR,
          contents: found.map(({ manifest }) => pieceToolboxBlock(manifest)),
        },
      ]
    : [];
  const known = Object.keys(KNOWN_CATEGORIES);
  const order = (category: string) => {
    const index = known.indexOf(category);
    return index >= 0 ? index : known.length;
  };
  const categories = [...byCategory.keys()].sort((a, b) => order(a) - order(b) || byText(a, b));
  return {
    kind: 'categoryToolbox',
    contents: [
      ...search,
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
