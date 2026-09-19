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
      routines: { copied: [], missing: [], kept: [] },
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

describe('saveToProject and the tool routines', () => {
  const routine = { name: 'bc_holding_sprite', text: 'LDA $1470|!addr\n\tRTL\n' };
  const other = { name: 'bc_other', text: 'RTL\n' };
  const withRoutines = { ...doc, routines: [routine, other] };
  const file = (name: string) => `routines/${name}.asm`;

  it('copies missing routines after one question naming them', async () => {
    const { project, disk, asked, state } = fakeProject();
    state.answers = [true];
    const outcome = await saveToProject(project, withRoutines);
    expect(outcome).toMatchObject({
      kind: 'saved',
      routines: { copied: ['bc_holding_sprite', 'bc_other'], missing: [], kept: [] },
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('bc_holding_sprite.asm, bc_other.asm');
    expect(disk.get(file('bc_holding_sprite'))).toBe(routine.text);
    expect(disk.get(file('bc_other'))).toBe(other.text);
  });

  it('still saves the Block when the user does not want the routines', async () => {
    const { project, disk } = fakeProject();
    const outcome = await saveToProject(project, withRoutines);
    expect(outcome).toMatchObject({
      kind: 'saved',
      routines: { copied: [], missing: ['bc_holding_sprite', 'bc_other'], kept: [] },
    });
    expect(disk.has('blocks/blockcreator/onoff_cement.asm')).toBe(true);
    expect(disk.has(file('bc_holding_sprite'))).toBe(false);
  });

  it('asks nothing when the routines are there and the same, whatever the line breaks', async () => {
    const { project, asked, writes } = fakeProject({
      'list.txt': list,
      [file('bc_holding_sprite')]: routine.text.replace(/\n/g, '\r\n'),
      [file('bc_other')]: other.text,
    });
    const outcome = await saveToProject(project, withRoutines);
    expect(outcome).toMatchObject({ routines: { copied: [], missing: [], kept: [] } });
    expect(asked).toEqual([]);
    expect(writes).toEqual(['blocks/blockcreator/onoff_cement.asm']);
  });

  it('asks separately before replacing a different routine, and keeps it on no', async () => {
    const mine = 'RTL ; my own version\n';
    const { project, disk, asked, state } = fakeProject({
      'list.txt': list,
      [file('bc_holding_sprite')]: mine,
      [file('bc_other')]: 'NOP\n',
    });
    state.answers = [true, false];
    const outcome = await saveToProject(project, withRoutines);
    expect(outcome).toMatchObject({
      routines: { copied: ['bc_holding_sprite'], missing: [], kept: ['bc_other'] },
    });
    expect(asked).toHaveLength(2);
    expect(asked[0]).toContain('routines/bc_holding_sprite.asm');
    expect(disk.get(file('bc_holding_sprite'))).toBe(routine.text);
    expect(disk.get(file('bc_other'))).toBe('NOP\n');
  });

  it('asks about the missing ones and the different ones, and about no others', async () => {
    const { project, asked, state } = fakeProject({
      'list.txt': list,
      [file('bc_other')]: 'NOP\n',
    });
    state.answers = [true, true];
    await saveToProject(project, withRoutines);
    expect(asked).toHaveLength(2);
    expect(asked[0]).toContain('does not have');
    expect(asked[1]).toContain('bc_other.asm');
  });

  it('does not look at the routines folder for a Block that needs none', async () => {
    const { project, asked } = fakeProject();
    await saveToProject(project, doc);
    expect(asked).toEqual([]);
  });
});
