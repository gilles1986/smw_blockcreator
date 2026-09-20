import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../testing/library';
import { searchPieces } from './search';

const library = builtInLibrary();
const ids = (query: string, options?: Parameters<typeof searchPieces>[2]) =>
  searchPieces(library, query, options).map(({ manifest }) => manifest.id);

describe('searchPieces', () => {
  it.each([...library.pieces.values()].map((piece) => [piece.manifest.name, piece] as const))(
    'finds "%s" by its name, and first',
    (name, piece) => {
      expect(ids(name)[0]).toBe(piece.manifest.id);
    },
  );

  it('finds a Piece by its id, with or without the underscores, and whatever the case', () => {
    expect(ids('spawn_sprite')[0]).toBe('spawn_sprite');
    expect(ids('SPAWN SPRITE')[0]).toBe('spawn_sprite');
    expect(ids('c_lives')[0]).toBe('c_lives');
  });

  it('finds a Piece by a part of its name, the ones that start with it first', () => {
    const found = ids('sprite');
    expect(found).toEqual(expect.arrayContaining(['spawn_sprite', 'push_sprite', 'c_sprite_id']));
    // A name that starts with the word comes before one that only has it inside.
    expect(found.indexOf('c_sprite_state')).toBeGreaterThan(-1);
    const names = searchPieces(library, 'sprite').map(({ manifest }) => manifest.name);
    const starts = names.filter((name) => name.toLowerCase().startsWith('sprite'));
    expect(names.slice(0, starts.length)).toEqual(starts);
  });

  it('wants every word of the query', () => {
    expect(ids('kill sprite')).toContain('kill_touching_sprite');
    expect(ids('kill sprite')).not.toContain('give_coins');
    expect(ids('zzz nothing')).toEqual([]);
  });

  it('finds by what the description says, after the names', () => {
    // 'P-meter' is in the name; 'flashing' only in the description of blink_invulnerability.
    expect(ids('flashing')).toContain('blink_invulnerability');
    expect(ids('sublevel')[0]).toBe('teleport');
  });

  it('gives nothing for an empty query', () => {
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it('leaves out the Pieces a kind of Slot cannot take', () => {
    expect(ids('sprite', { slotKind: 'mario' })).not.toContain('push_sprite');
    expect(ids('sprite', { slotKind: 'mario' })).toContain('spawn_sprite');
    expect(ids('mario', { slotKind: 'sprite' })).not.toContain('boost_mario');
    expect(ids('sprite', { slotKind: 'sprite' })).toContain('push_sprite');
  });

  it('lists a Piece once, in an order that does not depend on the Library order', () => {
    const found = ids('block');
    expect(new Set(found).size).toBe(found.length);
    expect(ids('block')).toEqual(found);
  });
});
