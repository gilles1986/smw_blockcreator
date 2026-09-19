import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseList } from '../core/listtxt';
import { HAND_EDIT_WARNING } from './blockDocument';
import { listFile, saveToProject, type ProjectFiles } from './projectSave';

const golden = readFileSync(
  join(import.meta.dirname, '..', 'core', 'generator', 'golden', 'onoff_cement.asm'),
  'utf8',
);
const list = readFileSync(
  join(import.meta.dirname, '..', 'core', 'listtxt', 'fixtures', 'gps-list.txt'),
  'utf8',
);

/** In-memory GPS folder; `answers` are the replies to the next confirmations. */
function fakeProject(initial: Record<string, string> = { 'list.txt': list }) {
  const disk = new Map(Object.entries(initial));
  const asked: string[] = [];
  const writes: string[] = [];
  const state = { answers: [] as boolean[] };
  const project: ProjectFiles = {
    read: async (path) => disk.get(path) ?? null,
    write: async (path, text) => {
      writes.push(path);
      disk.set(path, text);
    },
    confirm: async (message) => {
      asked.push(message);
      return state.answers.shift() ?? false;
    },
  };
  return { project, disk, asked, writes, state };
}

const doc = { name: 'onoff_cement', text: golden, problems: [] };
const choice = { tile: 0x406, actAs: 0x130 };

describe('saveToProject', () => {
  it('writes the Block into blocks/blockcreator/', async () => {
    const { project, disk } = fakeProject();
    expect(await saveToProject(project, doc)).toEqual({
      kind: 'saved',
      path: 'blocks/blockcreator/onoff_cement.asm',
      listUpdated: false,
    });
    expect(disk.get('blocks/blockcreator/onoff_cement.asm')).toBe(golden);
    expect(disk.get('list.txt')).toBe(list);
  });

  it('adds the Block to list.txt and keeps the old list as list.txt.bak', async () => {
    const { project, disk } = fakeProject();
    expect(await saveToProject(project, doc, choice)).toMatchObject({
      kind: 'saved',
      listUpdated: true,
    });
    expect(disk.get('list.txt.bak')).toBe(list);
    const entry = parseList(disk.get('list.txt')!).find((e) => e.file === listFile('onoff_cement'));
    expect(entry).toMatchObject({ tiles: [0x406], actAs: 0x130 });
  });

  it('updates the entry when the same Block is saved again', async () => {
    const { project, disk } = fakeProject();
    await saveToProject(project, doc, choice);
    const once = disk.get('list.txt')!;
    // Nothing to change: the list is left alone, the Block file is rewritten (it is ours).
    const again = fakeProject({ ...Object.fromEntries(disk), 'list.txt.bak': list });
    expect(await saveToProject(again.project, doc, choice)).toMatchObject({ listUpdated: false });
    expect(again.writes).toEqual(['blocks/blockcreator/onoff_cement.asm']);
    await saveToProject(project, doc, { tile: 0x407, actAs: 0x25 });
    const moved = parseList(disk.get('list.txt')!).filter(
      (e) => e.file === listFile('onoff_cement'),
    );
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ tiles: [0x407], actAs: 0x25 });
    expect(disk.get('list.txt.bak')).toBe(once);
  });

  it('writes nothing when another file holds the tile', async () => {
    const { project, writes } = fakeProject();
    const outcome = await saveToProject(project, doc, { ...choice, tile: 0x290 });
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'Tile 290 is already used by global/mario_passable.asm.',
    });
    expect(writes).toEqual([]);
  });

  it('fails clearly when the GPS folder has no list.txt', async () => {
    const { project, writes } = fakeProject({});
    expect(await saveToProject(project, doc, choice)).toEqual({
      kind: 'failed',
      message: 'The GPS folder has no list.txt.',
    });
    expect(writes).toEqual([]);
  });

  it('is refused while logic would be lost', async () => {
    const { project, writes } = fakeProject();
    const outcome = await saveToProject(project, { ...doc, problems: ['a Piece is missing'] });
    expect(outcome).toMatchObject({ kind: 'blocked' });
    expect(writes).toEqual([]);
  });

  it('asks before replacing a hand-edited or foreign file, and stops on no', async () => {
    const edited = golden.replace('\tLDA #$30\n', '\tLDA #$2F\n');
    const path = 'blocks/blockcreator/onoff_cement.asm';
    const hand = fakeProject({ 'list.txt': list, [path]: edited });
    expect(await saveToProject(hand.project, doc, choice)).toEqual({ kind: 'cancelled' });
    expect(hand.asked).toEqual([`${HAND_EDIT_WARNING} Save anyway?`]);
    expect(hand.disk.get(path)).toBe(edited);
    expect(hand.disk.get('list.txt')).toBe(list);

    const foreign = fakeProject({ 'list.txt': list, [path]: 'db $42\nRTL\n' });
    foreign.state.answers = [true];
    expect(await saveToProject(foreign.project, doc)).toMatchObject({ kind: 'saved' });
    expect(foreign.asked[0]).toContain('was not made by BlockCreator');
    expect(foreign.disk.get(path)).toBe(golden);
  });

  it('turns characters Windows forbids in the name into underscores', async () => {
    const { project, disk } = fakeProject();
    await saveToProject(project, { ...doc, name: 'a/b:c' });
    expect(disk.has('blocks/blockcreator/a_b_c.asm')).toBe(true);
  });
});
