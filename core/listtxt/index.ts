// GPS's `list.txt`: which Map16 tile runs which Block file (GPS README, "The list format").
// BlockCreator understands the block lines only; comments, blank lines and everything after
// `@dsc` are kept byte for byte, so editing the list never disturbs the rest of it.

/** One block line: `<tile>[-<tile>][:<act as>] <file>`, or the same with an `R` in front. */
export interface ListEntry {
  /** 0-based line in the file. */
  line: number;
  /** `A-B` is a run of tiles, `RA-B` a rectangle of the page's 16-wide grid. */
  kind: 'single' | 'range' | 'rectangle';
  /** Every tile number the line assigns. */
  tiles: number[];
  actAs?: number;
  /** Relative to GPS's `blocks/` folder, as written in the list. */
  file: string;
}

/** A tile that cannot be given to a Block, or a list that cannot take the entry. */
export class ListError extends Error {}

const ENTRY =
  /^\s*(?<rect>R?)(?<from>[0-9a-f]{1,5})(?:-(?<to>[0-9a-f]{1,5}))?(?::(?<actAs>[0-9a-f]{1,4}))?[ \t]+(?<file>\S.*?)\s*$/i;
/** GPS stops reading the list here; what follows are tile descriptions for Lunar Magic. */
const DSC = /^\s*@dsc\s*$/i;

/** Tiles of a rectangle: the rows and columns between the two corners, on 16 tiles per row. */
function rectangle(from: number, to: number): number[] {
  const [firstRow, lastRow] = [from >> 4, to >> 4];
  const [firstCol, lastCol] = [from & 15, to & 15];
  const tiles: number[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) tiles.push((row << 4) | col);
  }
  return tiles;
}

function run(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/** The block lines of a list, up to `@dsc`. */
export function parseList(text: string): ListEntry[] {
  const entries: ListEntry[] = [];
  const lines = text.split('\n');
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line]!.replace(/\r$/, '');
    if (DSC.test(raw)) break;
    if (raw.trim() === '' || raw.trim().startsWith(';')) continue;
    const found = ENTRY.exec(raw)?.groups;
    if (!found) continue;
    const from = parseInt(found.from!, 16);
    const to = found.to === undefined ? from : parseInt(found.to, 16);
    const isRectangle = found.rect !== '';
    entries.push({
      line,
      kind: isRectangle ? 'rectangle' : found.to === undefined ? 'single' : 'range',
      tiles: isRectangle ? rectangle(from, to) : run(from, to),
      ...(found.actAs !== undefined && { actAs: parseInt(found.actAs, 16) }),
      file: found.file!,
    });
  }
  return entries;
}

/** The entry that holds each tile; when two lines assign a tile, the later one wins as in GPS. */
export function occupancy(entries: readonly ListEntry[]): Map<number, ListEntry> {
  const byTile = new Map<number, ListEntry>();
  for (const entry of entries) for (const tile of entry.tiles) byTile.set(tile, entry);
  return byTile;
}

/** Same file, ignoring the case and the kind of slash. */
export function sameFile(a: string, b: string): boolean {
  const normal = (file: string) => file.replace(/\\/g, '/').toLowerCase();
  return normal(a) === normal(b);
}

/** The single-tile line a Block file already has, which saving it again updates. */
export function entryOf(entries: readonly ListEntry[], file: string): ListEntry | undefined {
  return entries.find((entry) => entry.kind === 'single' && sameFile(entry.file, file));
}

const hex = (value: number, digits: number) =>
  value.toString(16).toUpperCase().padStart(digits, '0');

export interface BlockEntry {
  tile: number;
  actAs: number;
  file: string;
}

/**
 * The list with `file` assigned to `tile`, acting as `actAs`. A file that already has a
 * single-tile line gets that line updated; otherwise a line is added after the last block
 * line, or before `@dsc` when there is none. Nothing else in the text changes.
 * Throws a `ListError` when another file already holds the tile.
 */
export function withBlockEntry(text: string, { tile, actAs, file }: BlockEntry): string {
  const entries = parseList(text);
  const holder = occupancy(entries).get(tile);
  if (holder && !sameFile(holder.file, file)) {
    throw new ListError(`Tile ${hex(tile, 3)} is already used by ${holder.file}.`);
  }
  const lines = text.split('\n');
  const eol = /\r\n/.test(text) ? '\r' : '';
  const line = `${hex(tile, 4)}:${hex(actAs, 4)} ${file}${eol}`;

  const existing = entryOf(entries, file);
  if (existing) {
    lines[existing.line] = line;
    return lines.join('\n');
  }
  const last = entries.at(-1);
  let at: number;
  if (last) {
    at = last.line + 1;
  } else {
    const dsc = lines.findIndex((raw) => DSC.test(raw.replace(/\r$/, '')));
    // Before the blank lines that lead up to `@dsc`, or before the final line break.
    at = dsc >= 0 ? dsc : lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    while (dsc >= 0 && at > 0 && lines[at - 1]!.trim() === '') at--;
  }
  lines.splice(at, 0, line);
  return lines.join('\n');
}
