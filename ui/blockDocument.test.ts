import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Library } from '../core/library';
import type { PieceRef } from '../core/model';
import { builtInLibrary } from '../core/testing/library';
import { HAND_EDIT_WARNING, openBlock, saveBlock, type FileAccess } from './blockDocument';

const library = builtInLibrary();
const golden = readFileSync(
  join(import.meta.dirname, '..', 'core', 'generator', 'golden', 'onoff_cement.asm'),
  'utf8',
);

/** In-memory files; `choose` answers the next file dialog, `answers` the next confirmations. */
function fakeFiles(initial: Record<string, string> = {}) {
  const disk = new Map(Object.entries(initial));
  const asked: string[] = [];
  const state = { choose: null as string | null, answers: [] as boolean[] };
  const files: FileAccess = {
    chooseOpenPath: async () => state.choose,
    chooseSavePath: async () => state.choose,
    exists: async (path) => disk.has(path),
    read: async (path) => {
      const text = disk.get(path);
      if (text === undefined) throw new Error(`${path} not found`);
      return text;
    },
    write: async (path, text) => void disk.set(path, text),
    confirm: async (message) => {
      asked.push(message);
      return state.answers.shift() ?? false;
    },
  };
  return { files, disk, asked, state };
}

const doc = { path: undefined, name: 'onoff_cement', text: golden, problems: [] };

/** The part of the golden Block's model the tests change: if ON { act as 130 } else { act as 025 }. */
interface GoldenModel {
  slots: {
    marioTop: [{ branches: [{ body: [{ piece: PieceRef }] }]; else: [{ piece: PieceRef }] }];
  };
}

describe('openBlock', () => {
  it('opens a Block and reports it unedited', async () => {
    const { files, state } = fakeFiles({ 'C:/blocks/onoff_cement.asm': golden });
    state.choose = 'C:/blocks/onoff_cement.asm';
    expect(await openBlock(files, { library })).toMatchObject({
      kind: 'opened',
      path: 'C:/blocks/onoff_cement.asm',
      handEdited: false,
      model: { properties: { name: 'onoff_cement' } },
    });
  });

  it('flags a Block that was edited by hand', async () => {
    const edited = golden.replace('\tLDA #$30\n', '\tLDA #$2F\n');
    const { files, state } = fakeFiles({ 'b.asm': edited });
    state.choose = 'b.asm';
    expect(await openBlock(files, { library })).toMatchObject({ kind: 'opened', handEdited: true });
  });

  it('explains why a file cannot be opened', async () => {
    const { files, state } = fakeFiles({ 'foreign.asm': 'db $42\nRTL\n' });
    state.choose = 'foreign.asm';
    expect(await openBlock(files, { library })).toEqual({
      kind: 'failed',
      message: 'Not a BlockCreator block.',
    });
    state.choose = 'missing.asm';
    expect(await openBlock(files, { library })).toEqual({
      kind: 'failed',
      message: 'Could not read missing.asm: missing.asm not found',
    });
  });

  it('does nothing when the dialog is cancelled', async () => {
    expect(await openBlock(fakeFiles().files, { library })).toEqual({ kind: 'cancelled' });
  });
});

describe('saveBlock', () => {
  it('asks for a path the first time, suggesting the Block name, and writes the file', async () => {
    const { files, disk, state } = fakeFiles();
    const suggested: string[] = [];
    files.chooseSavePath = async (name) => {
      suggested.push(name);
      return state.choose;
    };
    state.choose = 'C:/blocks/onoff_cement.asm';
    expect(await saveBlock(files, doc)).toEqual({
      kind: 'saved',
      path: 'C:/blocks/onoff_cement.asm',
    });
    expect(suggested).toEqual(['onoff_cement.asm']);
    expect(disk.get('C:/blocks/onoff_cement.asm')).toBe(golden);
  });

  it('saves to the known path without asking, unless "Save as" is used', async () => {
    const { files, disk, state } = fakeFiles({ 'a.asm': golden });
    state.choose = 'b.asm';
    await saveBlock(files, { ...doc, path: 'a.asm', text: golden + '; v2\n' });
    expect(disk.get('a.asm')).toBe(golden + '; v2\n');
    await saveBlock(files, { ...doc, path: 'a.asm' }, { saveAs: true });
    expect(disk.has('b.asm')).toBe(true);
  });

  it('requires confirmation before overwriting a file edited by hand', async () => {
    const edited = golden.replace('\tLDA #$30\n', '\tLDA #$2F\n');
    const { files, disk, asked, state } = fakeFiles({ 'a.asm': edited });
    const current = { ...doc, path: 'a.asm' };

    state.answers = [false];
    expect(await saveBlock(files, current)).toEqual({ kind: 'cancelled' });
    expect(disk.get('a.asm')).toBe(edited);

    state.answers = [true];
    expect(await saveBlock(files, current)).toEqual({ kind: 'saved', path: 'a.asm' });
    expect(disk.get('a.asm')).toBe(golden);
    expect(asked).toEqual([
      `${HAND_EDIT_WARNING} Save anyway?`,
      `${HAND_EDIT_WARNING} Save anyway?`,
    ]);
  });

  it('asks before replacing a file that BlockCreator did not make', async () => {
    const { files, disk, asked, state } = fakeFiles({ 'muncher.asm': 'db $42\n' });
    state.choose = 'muncher.asm';
    state.answers = [false];
    expect(await saveBlock(files, doc)).toEqual({ kind: 'cancelled' });
    expect(asked).toEqual(['muncher.asm was not made by BlockCreator. Replace it?']);
    expect(disk.get('muncher.asm')).toBe('db $42\n');
  });

  it('refuses to save while logic would be lost', async () => {
    const { files, disk } = fakeFiles();
    const blocked = { ...doc, problems: ['An if has a branch without a Condition.'] };
    expect(await saveBlock(files, blocked)).toEqual({
      kind: 'blocked',
      message: 'Fix this before saving:\n- An if has a branch without a Condition.',
    });
    expect(disk.size).toBe(0);
  });

  it('turns characters Windows does not allow in file names into _', async () => {
    const { files, state } = fakeFiles();
    const suggested: string[] = [];
    files.chooseSavePath = async (name) => (suggested.push(name), state.choose);
    await saveBlock(files, { ...doc, name: 'on/off: "cement"?' });
    expect(suggested).toEqual(['on_off_ _cement__.asm']);
  });
});

describe('openBlock checks', () => {
  /** The golden Block with its model changed, as a file (the checksum no longer matches). */
  function changed(edit: (model: GoldenModel) => void): string {
    const model = JSON.parse(golden.split('\n')[1]!.replace(/^;@?bc-model /, '')) as GoldenModel;
    edit(model);
    return golden.replace(/^;@?bc-model .*$/m, `;bc-model ${JSON.stringify(model)}`);
  }
  const open = async (text: string, lib: Library = library) => {
    const { files, state } = fakeFiles({ 'b.asm': text });
    state.choose = 'b.asm';
    return openBlock(files, { library: lib });
  };
  /** The Library with one Piece made over: another version, other parameters. */
  function reworked(id: string, version: number, params?: unknown[]): Library {
    const piece = library.pieces.get(id)!;
    const manifest = { ...piece.manifest, version, ...(params && { params: params as never }) };
    return { ...library, pieces: new Map([...library.pieces, [id, { ...piece, manifest }]]) };
  }

  it('opens a Block that uses Pieces this Library does not have, keeps them and says which', async () => {
    const text = changed((model) => {
      model.slots.marioTop[0].else[0].piece.id = 'time_machine';
    });
    const outcome = await open(text);
    expect(outcome).toMatchObject({ kind: 'opened', missing: ['time_machine'], upgraded: [] });
    const opened = outcome as Extract<typeof outcome, { kind: 'opened' }>;
    expect(opened.model.slots.marioTop![0]).toMatchObject({
      else: [{ piece: { id: 'time_machine', version: 1 } }],
    });
  });

  it('still refuses a Block whose Pieces are used wrongly, even with Pieces missing', async () => {
    const text = changed((model) => {
      model.slots.marioTop[0].else[0].piece.id = 'time_machine';
      model.slots.marioTop[0].branches[0].body[0].piece.params.tile = 'cement';
    });
    expect(await open(text)).toEqual({
      kind: 'failed',
      message:
        'b.asm cannot be opened:\n- marioTop /0/branches/0/body/0: \'tile\' = "cement" is not a valid Map16 number.',
    });
  });

  it('brings Pieces up to the version of the Library and says what became of their values', async () => {
    const outcome = await open(golden, reworked('act_as', 2));
    expect(outcome).toMatchObject({
      kind: 'opened',
      missing: [],
      ahead: [],
      upgraded: [{ id: 'act_as', name: 'Act as', from: 1, to: 2, dropped: [], reset: [] }],
    });
    const opened = outcome as Extract<typeof outcome, { kind: 'opened' }>;
    const [rule] = opened.model.slots.marioTop!;
    expect(rule).toMatchObject({
      branches: [
        {
          condition: { piece: { id: 'c_onoff', version: 1 } },
          body: [{ piece: { id: 'act_as', version: 2, params: { tile: 304 } } }],
        },
      ],
      else: [{ piece: { id: 'act_as', version: 2, params: { tile: 37 } } }],
    });
  });

  it('opens an older Piece whose values no longer fit, with the default in their place', async () => {
    const narrower = [
      { name: 'tile', label: 'Tile', type: 'number', min: 0, max: 0x100, default: 0x25 },
    ];
    const outcome = await open(golden, reworked('act_as', 2, narrower));
    expect(outcome).toMatchObject({
      kind: 'opened',
      upgraded: [{ id: 'act_as', from: 1, to: 2, dropped: [], reset: ['tile'] }],
    });
  });

  it('names the Pieces that are newer in the Block than in this Library, and leaves them', async () => {
    const text = changed((model) => {
      model.slots.marioTop[0].branches[0].body[0].piece.version = 3;
    });
    expect(await open(text)).toMatchObject({
      kind: 'opened',
      upgraded: [],
      ahead: [{ id: 'act_as', name: 'Act as', recorded: 3, installed: 1 }],
    });
  });
  it('asks before discarding unsaved changes, and stops when told no', async () => {
    const { files, asked, state } = fakeFiles({ 'a.asm': golden });
    state.choose = 'a.asm';
    state.answers = [false];
    expect(await openBlock(files, { library, unsavedChanges: true })).toEqual({
      kind: 'cancelled',
    });
    expect(asked).toEqual(['Discard unsaved changes to the current Block?']);
  });
});

describe('saveBlock over a newer Block', () => {
  it('says the file is from a newer BlockCreator instead of calling it foreign', async () => {
    const newer = golden.replace(/^;@?bc-format 1/m, ';bc-format 2');
    const { files, asked, state } = fakeFiles({ 'a.asm': newer });
    state.answers = [false];
    await saveBlock(files, { ...doc, path: 'a.asm' });
    expect(asked).toEqual([
      'a.asm was made with a newer BlockCreator. Replace it with this older format?',
    ]);
  });
});
