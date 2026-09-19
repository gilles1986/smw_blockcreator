// Piece search: what the editor's search box asks to fill the "Search" category of the toolbox.
// Pure and framework-free, so the ranking is testable and the UI only has to show the result.

import type { Library, Piece } from './load';

export interface SearchOptions {
  /** Only the Pieces a Slot of this kind can take: a Mario Slot takes 'mario' and 'any' Pieces. */
  slotKind?: 'mario' | 'sprite';
}

/**
 * The Pieces that match every word of the query, best first: the exact name (or id), then names
 * that start with the query, names that hold all the words, then ids and categories, and last the
 * description. Case, underscores and extra spaces do not matter. An empty query finds nothing.
 */
export function searchPieces(
  library: Library,
  query: string,
  options: SearchOptions = {},
): Piece[] {
  const wanted = normalize(query);
  if (wanted === '') return [];
  const words = wanted.split(' ');
  return [...library.pieces.values()]
    .filter(({ manifest }) => fits(manifest.slots, options.slotKind))
    .map((piece) => ({ piece, tier: tierOf(piece, wanted, words) }))
    .filter(({ tier }) => tier > 0)
    .sort(
      (a, b) =>
        b.tier - a.tier ||
        a.piece.manifest.name.localeCompare(b.piece.manifest.name) ||
        a.piece.manifest.id.localeCompare(b.piece.manifest.id),
    )
    .map(({ piece }) => piece);
}

function fits(slots: Piece['manifest']['slots'], kind: SearchOptions['slotKind']): boolean {
  return kind === undefined || slots === 'any' || slots === kind;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/** How well a Piece matches: 0 not at all, up to 6 for its exact name or id. */
function tierOf({ manifest }: Piece, wanted: string, words: string[]): number {
  const name = normalize(manifest.name);
  const id = normalize(manifest.id);
  if (name === wanted || id === wanted) return 6;
  if (name.startsWith(wanted)) return 5;
  if (name.split(' ').some((word) => word.startsWith(wanted))) return 4;
  const hits = (text: string) => words.every((word) => text.includes(word));
  if (hits(name)) return 3;
  const label = `${name} ${id}`;
  if (hits(label)) return 2;
  const anywhere = `${label} ${normalize(manifest.category)} ${normalize(manifest.description)}`;
  return hits(anywhere) ? 1 : 0;
}
