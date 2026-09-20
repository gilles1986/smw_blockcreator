import { beforeEach, describe, expect, it, vi } from 'vitest';

// A backend that keeps the Piece files of each place in memory, like userlibrary.rs keeps them in
// two folders.
const disk = vi.hoisted(() => ({
  files: { appData: new Map<string, string>(), exe: new Map<string, string>() } as Record<
    string,
    Map<string, string>
  >,
}));

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (command: string, args: Record<string, unknown>) => {
    const place = disk.files[args.location as string]!;
    if (command === 'user_pieces_read_all') return [...place.entries()].sort();
    if (command === 'user_pieces_dir') return `C:\\${args.location}\\pieces`;
    if (command === 'user_piece_write') place.set(args.path as string, args.text as string);
    else throw new Error(`unexpected command ${command}`);
  },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath: vi.fn() }));

const { countPieces, pieceFilesAt, switchPiecesLocation } = await import('./userLibrary');

const GIVE_LIFE = {
  'actions/give_life/piece.json': '{ "id": "give_life" }',
  'actions/give_life/code.asm': 'INC $0DBE|!addr\n',
  'conditions/c_ducking/piece.json': '{ "id": "c_ducking" }',
  'conditions/c_ducking/code.asm': 'LDA $73\n',
};

const put = (place: string, files: Record<string, string>) =>
  Object.entries(files).forEach(([path, text]) => disk.files[place]!.set(path, text));

describe('countPieces', () => {
  it('counts Piece folders, not files', () => {
    expect(countPieces(Object.entries(GIVE_LIFE))).toBe(2);
    expect(countPieces([])).toBe(0);
  });
});

describe('pieceFilesAt', () => {
  beforeEach(() => {
    disk.files.appData!.clear();
    disk.files.exe!.clear();
  });

  it('leaves out files that are not part of a Piece', () => {
    put('exe', { ...GIVE_LIFE, 'notes.json': '{}', 'actions/give_life/readme.asm': ';' });
    return expect(pieceFilesAt('exe').then((files) => Object.fromEntries(files))).resolves.toEqual(
      GIVE_LIFE,
    );
  });
});

describe('switchPiecesLocation', () => {
  beforeEach(() => {
    disk.files.appData!.clear();
    disk.files.exe!.clear();
  });

  it('copies the Pieces to an empty new place when the user says yes, and keeps the old ones', async () => {
    put('appData', GIVE_LIFE);
    const ask = vi.fn().mockResolvedValue(true);
    const result = await switchPiecesLocation('exe', 'appData', ask);
    expect(ask).toHaveBeenCalledWith(2, 'C:\\appData\\pieces', 'C:\\exe\\pieces');
    expect(result).toEqual({ copied: 2, alreadyThere: 0 });
    expect(Object.fromEntries(disk.files.exe!)).toEqual(GIVE_LIFE);
    expect(Object.fromEntries(disk.files.appData!)).toEqual(GIVE_LIFE);
  });

  it('copies nothing when the user says no', async () => {
    put('appData', GIVE_LIFE);
    const result = await switchPiecesLocation('exe', 'appData', async () => false);
    expect(result).toEqual({ copied: 0, alreadyThere: 0 });
    expect(disk.files.exe!.size).toBe(0);
  });

  it('does not ask, and does not touch anything, when the new place has Pieces already', async () => {
    put('appData', GIVE_LIFE);
    put('exe', { 'actions/give_life/piece.json': '{ "id": "give_life" }' });
    const ask = vi.fn();
    const result = await switchPiecesLocation('exe', 'appData', ask);
    expect(ask).not.toHaveBeenCalled();
    expect(result).toEqual({ copied: 0, alreadyThere: 1 });
    expect(disk.files.exe!.size).toBe(1);
  });

  it('does not ask when the old place has nothing to copy', async () => {
    const ask = vi.fn();
    expect(await switchPiecesLocation('exe', 'appData', ask)).toEqual({
      copied: 0,
      alreadyThere: 0,
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it('does nothing when the place stays the same', async () => {
    put('exe', GIVE_LIFE);
    const ask = vi.fn();
    expect(await switchPiecesLocation('exe', 'exe', ask)).toEqual({ copied: 0, alreadyThere: 2 });
    expect(ask).not.toHaveBeenCalled();
  });
});
