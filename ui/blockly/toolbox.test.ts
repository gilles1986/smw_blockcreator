import { describe, expect, it } from 'vitest';
import { builtInLibrary } from '../../core/testing/library';
import { toolbox } from './toolbox';

describe('toolbox', () => {
  it('starts with Logic, then one coloured category per Piece category in a fixed order', () => {
    const box = toolbox(builtInLibrary(), 'mario');
    expect(box.contents.map((c) => c.name)).toEqual([
      'Logic',
      'Conditions',
      'Physics',
      'Damage',
      'Effects',
      'Sound',
      'Sprites',
      'Level',
      'Advanced',
    ]);
    expect(box.contents[0]).toEqual({
      kind: 'category',
      name: 'Logic',
      colour: '#5b80a5',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        { kind: 'block', type: 'controls_if', extraState: { elseIfCount: 1 } },
        { kind: 'block', type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true } },
        { kind: 'block', type: 'logic_operation', fields: { OP: 'AND' } },
        { kind: 'block', type: 'logic_operation', fields: { OP: 'OR' } },
        { kind: 'block', type: 'logic_negate' },
      ],
    });
    expect(box.contents[1]?.colour).toBe(260);
    expect(box.contents[2]?.colour).toBe(210);
    expect(box.contents[3]?.colour).toBe(0);
    expect(box.contents[4]?.colour).toBe(40);
    expect(box.contents[5]?.colour).toBe(120);
    expect(box.contents[6]?.colour).toBe(290);
    expect(box.contents[7]?.colour).toBe(170);
    expect(box.contents[8]?.colour).toBe('#5b6770');
  });

  it('adds community categories after the built-in ones, blocks sorted by name', () => {
    const library = builtInLibrary();
    const base = library.pieces.get('act_as')!;
    const piece = (id: string, name: string, category: string) => ({
      ...base,
      manifest: { ...base.manifest, id, name, category },
    });
    const pieces = new Map([
      ['zz', piece('zz', 'Zap', 'kaizo_tricks')],
      ['aa', piece('aa', 'Anchor', 'kaizo_tricks')],
      ['bb', piece('bb', 'Bounce', 'physics')],
    ]);
    const categories = toolbox({ ...library, pieces }, 'mario').contents.map((c) => [
      c.name,
      c.contents.map((b) => b.type),
    ]);
    expect(categories).toEqual([
      [
        'Logic',
        [
          'controls_if',
          'controls_if',
          'controls_if',
          'controls_if',
          'logic_operation',
          'logic_operation',
          'logic_negate',
        ],
      ],
      ['Physics', ['piece_bb']],
      ['Kaizo tricks', ['piece_aa', 'piece_zz']],
    ]);
  });
});

describe('toolbox defaults', () => {
  it('presets every field with the manifest default, since a dropdown would start on its first option', () => {
    const library = builtInLibrary();
    const base = library.pieces.get('c_onoff')!;
    const offByDefault = {
      ...base,
      manifest: {
        ...base.manifest,
        params: [{ ...base.manifest.params[0]!, default: 1 }],
      },
    };
    const pieces = new Map([
      ['c_onoff', offByDefault],
      ['act_as', library.pieces.get('act_as')!],
    ]);
    const blocks = toolbox({ ...library, pieces }, 'mario').contents.flatMap((c) => c.contents);
    expect(blocks.find((b) => b.type === 'piece_c_onoff')).toEqual({
      kind: 'block',
      type: 'piece_c_onoff',
      fields: { position: '1' },
    });
    expect(blocks.find((b) => b.type === 'piece_act_as')).toEqual({
      kind: 'block',
      type: 'piece_act_as',
      fields: { tile: '130' },
    });
  });
});

describe('toolbox per Slot kind', () => {
  const library = builtInLibrary();
  const types = (kind: 'mario' | 'sprite') =>
    toolbox(library, kind).contents.flatMap((c) => c.contents.map((b) => b.type));

  it('hides Mario-only Pieces in Sprite Slots (and drops categories left empty)', () => {
    expect(types('sprite')).not.toContain('piece_stick_to_ceiling');
    expect(types('sprite')).not.toContain('piece_reverse_direction');
    expect(types('sprite')).not.toContain('piece_boost_mario');
    // What only reads global state works from a sprite Slot too, as a Block that hurts Mario when
    // a sprite touches it needs (ticket 24).
    expect(types('sprite')).toContain('piece_hurt_mario');
    expect(types('sprite')).toContain('piece_kill_mario');
    expect(types('sprite')).toContain('piece_kill_touching_sprite');
    expect(types('sprite')).toContain('piece_push_sprite');

    // A category whose pieces only work in Mario slots is dropped in Sprite slots
    const marioOnlyCat = {
      ...library,
      pieces: new Map([
        [
          'mario_only',
          {
            ...library.pieces.get('hurt_mario')!,
            manifest: {
              ...library.pieces.get('hurt_mario')!.manifest,
              id: 'mario_only',
              category: 'exclusive',
              slots: 'mario' as const,
            },
          },
        ],
      ]),
    };
    expect(toolbox(marioOnlyCat, 'sprite').contents.map((c) => c.name)).toEqual(['Logic']);
    expect(toolbox(marioOnlyCat, 'mario').contents.map((c) => c.name)).toEqual([
      'Logic',
      'Exclusive',
    ]);
  });

  it('shows Mario-only and any-Slot Pieces in Mario Slots', () => {
    expect(types('mario')).toEqual(
      expect.arrayContaining(['piece_boost_mario', 'piece_act_as', 'piece_c_onoff']),
    );
  });

  it('hides Sprite-only Pieces in Mario Slots', () => {
    const base = library.pieces.get('act_as')!;
    const spriteOnly = {
      ...base,
      manifest: { ...base.manifest, id: 'turn', slots: 'sprite' as const },
    };
    const withTurn = { ...library, pieces: new Map([...library.pieces, ['turn', spriteOnly]]) };
    const typesIn = (kind: 'mario' | 'sprite') =>
      toolbox(withTurn, kind).contents.flatMap((c) => c.contents.map((b) => b.type));
    expect(typesIn('mario')).not.toContain('piece_turn');
    expect(typesIn('sprite')).toContain('piece_turn');
  });
});

describe('toolbox with a search', () => {
  const library = builtInLibrary();
  const types = (query: string, kind: 'mario' | 'sprite' = 'mario') =>
    toolbox(library, kind, query).contents[0]?.contents.map((block) => block.type);

  it('has no Search category without a query, or with a blank one', () => {
    expect(toolbox(library, 'mario', '').contents[0]?.name).toBe('Logic');
    expect(toolbox(library, 'mario', '   ').contents[0]?.name).toBe('Logic');
    expect(toolbox(library, 'mario').contents[0]?.name).toBe('Logic');
  });

  it('puts the Pieces that match first, as a category that says how many', () => {
    const box = toolbox(library, 'mario', 'flashing');
    const search = box.contents[0]!;
    expect(search.name).toBe(`Search: ${search.contents.length} found`);
    expect(search.contents.map((block) => block.type)).toContain('piece_blink_invulnerability');
    // The rest of the toolbox is where it was.
    expect(box.contents[1]?.name).toBe('Logic');
    expect(box.contents).toHaveLength(toolbox(library, 'mario').contents.length + 1);
  });

  it('finds a Piece by its name, first, with its default values already in the block', () => {
    const [first] = toolbox(library, 'mario', 'Act as').contents[0]!.contents;
    expect(first).toEqual(
      toolbox(library, 'mario')
        .contents.flatMap((category) => category.contents)
        .find((block) => block.type === 'piece_act_as'),
    );
  });

  it('only offers what the Slot takes', () => {
    expect(types('push sprite', 'sprite')).toContain('piece_push_sprite');
    expect(types('push sprite', 'mario')).not.toContain('piece_push_sprite');
    expect(types('boost', 'sprite') ?? []).not.toContain('piece_boost_mario');
  });

  it('says so when nothing matches, and keeps the category so the toolbox does not jump', () => {
    const search = toolbox(library, 'mario', 'zzz nothing').contents[0]!;
    expect(search.name).toBe('Search: nothing found');
    expect(search.contents).toEqual([]);
  });
});

describe('neighbour blocks in Effects category', () => {
  const library = builtInLibrary();

  it('puts at_neighbour in Effects and hides the replaced standalone pieces', () => {
    const effects = toolbox(library, 'mario').contents.find((c) => c.name === 'Effects')!;
    const types = effects.contents.map((b) => b.type);
    expect(types).toContain('at_neighbour');
    expect(types).not.toContain('piece_change_adjacent_block');
    expect(types).not.toContain('piece_erase_adjacent_block');
  });
});
