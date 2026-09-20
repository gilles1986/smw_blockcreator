// The zip that build.bat makes (release/package.ps1) has the program next to README.txt and an
// AGENTS.md, and the guides an AI needs. These tests keep the files the two of them point at in
// the zip, so a renamed guide cannot leave them pointing at nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const slashes = (path: string) => path.replace(/\\/g, '/');

/** What package.ps1 puts into the zip: `Stage-File 'from' 'to'` and `Stage-Folder 'from' 'to'`. */
const staged = [
  ...read('release/package.ps1').matchAll(/Stage-(File|Folder) '([^']+)' '([^']+)'/g),
].map((m) => ({ folder: m[1] === 'Folder', from: slashes(m[2]!), to: slashes(m[3]!) }));
/** Files the script adds itself, not by `Stage-*`. */
const alsoInZip = ['BlockCreator.exe', 'README.txt'];

const inZip = (path: string) =>
  alsoInZip.includes(path) ||
  staged.some((item) => (item.folder ? path.startsWith(`${item.to}/`) : path === item.to));

describe('the release zip', () => {
  it('stages something for AI tools, and only files that are in the repository', () => {
    expect(staged.length).toBeGreaterThan(0);
    expect(staged.filter((item) => !existsSync(join(root, item.from)))).toEqual([]);
  });

  it('has README.txt, AGENTS.md and the guides they point to', () => {
    expect(inZip('AGENTS.md')).toBe(true);
    expect(inZip('docs/piece-authoring-for-ai.md')).toBe(true);
    expect(inZip('docs/piece-authoring.md')).toBe(true);
    expect(inZip('core/library/piece.schema.json')).toBe(true);
    expect(existsSync(join(root, 'release', 'README.txt'))).toBe(true);
    expect(existsSync(join(root, 'release', 'AGENTS.md'))).toBe(true);
  });

  it('has every file AGENTS.md names', () => {
    const named = [
      ...read('release/AGENTS.md').matchAll(/`((?:docs|core|library)\/[^`]+|CONTEXT\.md)`/g),
    ]
      .map((m) => m[1]!)
      // A folder is written with its `/`; a piece of the pattern (`bc_*.asm`) is not a path.
      .filter((path) => !path.includes('*'));
    expect(named.length).toBeGreaterThan(0);
    expect(
      named.filter((path) => !inZip(path.replace(/\/$/, '') + (path.endsWith('/') ? '/x' : ''))),
    ).toEqual([]);
  });

  it('has every file README.txt names', () => {
    const named = [
      ...read('release/README.txt').matchAll(
        /\b(?:docs|core|library)\\[\w\\.-]+|CONTEXT\.md|AGENTS\.md/g,
      ),
    ].map((m) => slashes(m[0]));
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((path) => !inZip(path))).toEqual([]);
  });

  it('points AI tools at the folder of the Pieces, wherever the user keeps them', () => {
    const agents = read('release/AGENTS.md');
    expect(agents).toContain('%APPDATA%\\com.saphros.blockcreator\\pieces');
    expect(agents).toContain('`pieces/`');
    expect(read('release/README.txt')).toContain('%APPDATA%\\com.saphros.blockcreator\\pieces');
  });
});
