// PIXI's `list.txt`: which sprite number runs which file. Only the custom sprites of the `SPRITE:`
// section (the top of the file) are read, and named after their file; the other sections
// (extended, cluster, … sprites) and the per-level lines (`<level>:<number> <file>`) are not.

import type { NamedNumber } from '../names';

/** `SPRITE:`, `EXTENDED:`, … A list starts in the sprite section, before any of these. */
const SECTION = /^([A-Za-z]+):$/;
const SPRITE_LINE = /^([0-9a-f]{2})\s+(\S.*)$/i;

/** A sprite's file name without folders and extension: `a/b/ghost-shell.json` is `ghost-shell`. */
function nameOf(file: string): string {
  const base = file.slice(Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')) + 1);
  return base.replace(/\.(cfg|json|asm)$/i, '');
}

/** The custom sprites of a PIXI list, by number. A number listed twice keeps its last file. */
export function parsePixiSprites(text: string): NamedNumber[] {
  const sprites = new Map<number, string>();
  let section = 'SPRITE';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith(';')) continue;
    const header = SECTION.exec(line);
    if (header) {
      section = header[1]!.toUpperCase();
      continue;
    }
    if (section !== 'SPRITE') continue;
    const match = SPRITE_LINE.exec(line);
    if (match) sprites.set(parseInt(match[1]!, 16), nameOf(match[2]!.trim()));
  }
  return [...sprites].map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id);
}
