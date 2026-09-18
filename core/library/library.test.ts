import { describe, expect, it } from 'vitest';
import { loadLibrary, mergeLibraries } from './index';

const actAs = {
  id: 'act_as',
  version: 1,
  kind: 'action',
  category: 'physics',
  name: 'Act as',
  description: 'Makes the Block behave like another tile.',
  author: 'BlockCreator',
  slots: 'any',
  params: [{ name: 'tile', label: 'Tile', type: 'map16', default: 0x130 }],
  clobbers: ['A'],
};

function files(entries: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries).map(([path, content]) => [
      path,
      typeof content === 'string' ? content : JSON.stringify(content),
    ]),
  );
}

describe('loadLibrary', () => {
  it('loads a Piece from its manifest and template', () => {
    const library = loadLibrary(
      files({
        'actions/act_as/piece.json': actAs,
        'actions/act_as/code.asm': 'LDY #{{hi tile}}\nLDA #{{lo tile}}\nSTA $1693|!addr\n',
      }),
      'builtin',
    );
    expect(library.errors).toEqual([]);
    const piece = library.pieces.get('act_as');
    expect(piece?.manifest.name).toBe('Act as');
    expect(piece?.origin).toBe('builtin');
    expect(piece?.template).toBe('LDY #{{hi tile}}\nLDA #{{lo tile}}\nSTA $1693|!addr\n');
  });

  describe('invalid manifests', () => {
    const file = 'actions/act_as/piece.json';

    function errorsFor(manifest: unknown) {
      const library = loadLibrary(
        files({
          [file]: manifest,
          'actions/act_as/code.asm': 'LDY #{{hi tile}}',
          'actions/ok/piece.json': { ...actAs, id: 'ok', params: [] },
          'actions/ok/code.asm': 'NOP',
        }),
        'builtin',
      );
      expect(library.pieces.has('act_as')).toBe(false);
      expect(library.pieces.has('ok')).toBe(true);
      return library.errors;
    }

    const withoutName: Partial<typeof actAs> = { ...actAs };
    delete withoutName.name;
    const cases: [string, unknown, { field: string; message: string }][] = [
      ['a missing field', withoutName, { field: 'name', message: 'is required' }],
      [
        'a value outside an enum',
        { ...actAs, kind: 'acton' },
        { field: 'kind', message: 'must be one of: action, condition' },
      ],
      [
        'a wrong type',
        { ...actAs, version: '1' },
        { field: 'version', message: 'must be an integer' },
      ],
      [
        'an unknown field',
        { ...actAs, removeBlock: true },
        { field: 'removeBlock', message: 'is not a known field' },
      ],
      [
        'a bad nested field',
        { ...actAs, params: [{ ...actAs.params[0], type: 'tile' }] },
        {
          field: 'params[0].type',
          message: 'must be one of: number, enum, bool, map16, sprite, sound, text, multiline',
        },
      ],
    ];

    it.each(cases)('reports %s with file and field', (_, manifest, expected) => {
      expect(errorsFor(manifest)).toEqual([{ origin: 'builtin', file, ...expected }]);
    });

    const number = { name: 'speed', label: 'Speed', type: 'number', min: 0, max: 127, default: 64 };
    const onOff = {
      name: 'state',
      label: 'State',
      type: 'enum',
      options: [
        { value: 0, label: 'ON' },
        { value: 1, label: 'OFF' },
      ],
      default: 0,
    };
    const crossFieldCases: [string, unknown, { field: string; message: string }][] = [
      [
        'an id that differs from the folder',
        { ...actAs, id: 'act_like' },
        { field: 'id', message: "must match the folder name 'act_as'" },
      ],
      [
        'a kind that differs from the folder',
        { ...actAs, kind: 'condition' },
        { field: 'kind', message: "must be 'action' for a Piece in actions/" },
      ],
      [
        'a number default out of range',
        { ...actAs, params: [{ ...number, default: 200 }] },
        { field: 'params[0].default', message: 'must be between 0 and 127' },
      ],
      [
        'min above max',
        { ...actAs, params: [{ ...number, min: 10, max: 5, default: 7 }] },
        { field: 'params[0].max', message: 'must not be below min (10)' },
      ],
      [
        'an enum default that is no option',
        { ...actAs, params: [{ ...onOff, default: 2 }] },
        { field: 'params[0].default', message: 'must be one of the option values: 0, 1' },
      ],
      [
        'a reserved param name',
        { ...actAs, params: [{ ...number, name: 'hex' }] },
        { field: 'params[0].name', message: "'hex' is reserved in templates" },
      ],
      [
        'a repeated param name',
        { ...actAs, params: [number, { ...number, label: 'Other' }] },
        { field: 'params[1].name', message: "'speed' is already used by params[0]" },
      ],
    ];

    it.each(crossFieldCases)('reports %s', (_, manifest, expected) => {
      expect(errorsFor(manifest)).toEqual([{ origin: 'builtin', file, ...expected }]);
    });

    it('reports a manifest that is not JSON', () => {
      expect(errorsFor('{ "id": "act_as", }')).toEqual([
        { origin: 'builtin', file, message: expect.stringMatching(/^is not valid JSON: /) },
      ]);
    });

    it('requires clobbers, so a forgotten register list cannot silently skip register saves', () => {
      const withoutClobbers: Partial<typeof actAs> = { ...actAs };
      delete withoutClobbers.clobbers;
      expect(errorsFor(withoutClobbers)).toEqual([
        { origin: 'builtin', file, field: 'clobbers', message: 'is required' },
      ]);
    });

    it('bounds map16, sprite and sound defaults', () => {
      const tile = { ...actAs.params[0], default: 0x10000 };
      expect(errorsFor({ ...actAs, params: [tile] })).toEqual([
        { origin: 'builtin', file, field: 'params[0].default', message: 'must be <= 65535' },
      ]);
    });
  });

  it('accepts categories beyond the built-in ones, for community Pieces', () => {
    const library = loadLibrary(
      files({
        'actions/act_as/piece.json': { ...actAs, category: 'kaizo_tricks' },
        'actions/act_as/code.asm': 'LDY #{{hi tile}}',
      }),
      'user',
    );
    expect(library.errors).toEqual([]);
  });

  it('reports an Action and a Condition that share an id instead of keeping one silently', () => {
    const library = loadLibrary(
      files({
        'actions/act_as/piece.json': actAs,
        'actions/act_as/code.asm': 'LDY #{{hi tile}}',
        'conditions/act_as/piece.json': { ...actAs, kind: 'condition', category: 'conditions' },
        'conditions/act_as/code.asm': 'BNE {{false}}',
      }),
      'builtin',
    );
    expect(library.pieces.has('act_as')).toBe(false);
    expect(library.errors).toEqual([
      {
        origin: 'builtin',
        file: 'conditions/act_as/piece.json',
        field: 'id',
        message: "'act_as' is already used by actions/act_as",
      },
    ]);
  });

  describe('templates', () => {
    function load(extra: Record<string, unknown>) {
      return loadLibrary(files({ 'actions/act_as/piece.json': actAs, ...extra }), 'builtin');
    }

    it('reports a Piece without code.asm', () => {
      const library = load({});
      expect(library.errors).toEqual([
        { origin: 'builtin', file: 'actions/act_as/code.asm', message: 'is missing' },
      ]);
      expect(library.pieces.has('act_as')).toBe(false);
    });

    it('reports template errors with their line, rendering with the default params', () => {
      const library = load({ 'actions/act_as/code.asm': 'LDY #{{hi tile}}\nLDA #{{lo tiel}}' });
      expect(library.errors).toEqual([
        {
          origin: 'builtin',
          file: 'actions/act_as/code.asm',
          message: "line 2: unknown parameter 'tiel'",
        },
      ]);
      expect(library.pieces.has('act_as')).toBe(false);
    });

    it('lets Conditions use {{false}} but not Actions', () => {
      const condition = {
        ...actAs,
        id: 'c_test',
        kind: 'condition',
        category: 'conditions',
        params: [],
      };
      const library = loadLibrary(
        files({
          'conditions/c_test/piece.json': condition,
          'conditions/c_test/code.asm': 'LDA $14AF|!addr\nBNE {{false}}',
          'actions/act_as/piece.json': actAs,
          'actions/act_as/code.asm': 'BRA {{false}}',
        }),
        'builtin',
      );
      expect(library.pieces.has('c_test')).toBe(true);
      expect(library.errors).toEqual([
        {
          origin: 'builtin',
          file: 'actions/act_as/code.asm',
          message: 'line 1: {{false}} is only available in Conditions',
        },
      ]);
    });
  });
});

describe('routines and presets', () => {
  it('collects routines/bc_*.asm and presets/*.asm by name', () => {
    const library = loadLibrary(
      files({
        'routines/bc_holding_sprite.asm': '?main:\nRTL',
        'presets/muncher_when_on.asm': ';@bc-format 1',
        'README.md': 'ignored',
      }),
      'user',
    );
    expect(library.errors).toEqual([]);
    expect(library.routines.get('bc_holding_sprite')).toEqual({
      text: '?main:\nRTL',
      origin: 'user',
    });
    expect(library.presets.get('muncher_when_on')).toEqual({
      text: ';@bc-format 1',
      origin: 'user',
    });
  });

  it('reports routine files that do not follow the bc_ naming rule', () => {
    const library = loadLibrary(files({ 'routines/kill_sprite.asm': 'RTL' }), 'builtin');
    expect(library.errors).toEqual([
      {
        origin: 'builtin',
        file: 'routines/kill_sprite.asm',
        message: 'routine files must be named bc_<name>.asm (lower-case letters, digits, _)',
      },
    ]);
    expect(library.routines.size).toBe(0);
  });
});

describe('mergeLibraries', () => {
  const builtIn = loadLibrary(
    files({
      'actions/act_as/piece.json': actAs,
      'actions/act_as/code.asm': 'LDY #{{hi tile}}\nLDA #{{lo tile}}\nSTA $1693|!addr',
      'actions/nop/piece.json': { ...actAs, id: 'nop', name: 'Nothing', params: [] },
      'actions/nop/code.asm': 'NOP',
      'routines/bc_shared.asm': 'built-in',
      'presets/solid.asm': 'built-in',
    }),
    'builtin',
  );

  it('lets a user Piece with the same id replace the built-in one', () => {
    const user = loadLibrary(
      files({
        'actions/act_as/piece.json': { ...actAs, name: 'My act as', version: 2 },
        'actions/act_as/code.asm': 'LDY #{{hi tile}}\nLDA #{{lo tile}}\nSTA $1693|!addr ; mine',
      }),
      'user',
    );
    const merged = mergeLibraries(builtIn, user);
    expect(merged.pieces.get('act_as')?.manifest.name).toBe('My act as');
    expect(merged.pieces.get('act_as')?.origin).toBe('user');
    expect(merged.pieces.get('nop')?.origin).toBe('builtin');
  });

  it('lets user routines and presets replace built-in ones by name', () => {
    const user = loadLibrary(
      files({ 'routines/bc_shared.asm': 'mine', 'presets/solid.asm': 'mine' }),
      'user',
    );
    const merged = mergeLibraries(builtIn, user);
    expect(merged.routines.get('bc_shared')).toEqual({ text: 'mine', origin: 'user' });
    expect(merged.presets.get('solid')).toEqual({ text: 'mine', origin: 'user' });
  });

  it('keeps the errors of both Libraries, each with its origin', () => {
    const brokenBuiltIn = loadLibrary(files({ 'routines/bad.asm': '' }), 'builtin');
    const brokenUser = loadLibrary(files({ 'routines/bad.asm': '' }), 'user');
    expect(mergeLibraries(brokenBuiltIn, brokenUser).errors.map((e) => e.origin)).toEqual([
      'builtin',
      'user',
    ]);
  });

  it('drops a Piece whose routine is in neither Library', () => {
    const user = loadLibrary(
      files({
        'actions/kill/piece.json': {
          ...actAs,
          id: 'kill',
          params: [],
          routines: ['bc_shared', 'bc_kill'],
        },
        'actions/kill/code.asm': '%bc_kill()',
      }),
      'user',
    );
    const merged = mergeLibraries(builtIn, user);
    expect(merged.pieces.has('kill')).toBe(false);
    expect(merged.errors).toEqual([
      {
        origin: 'user',
        file: 'actions/kill/piece.json',
        field: 'routines[1]',
        message: "'bc_kill' is in neither the built-in nor the user Library",
      },
    ]);
  });
});

it('reports a manifest that is not an object without a field', () => {
  const library = loadLibrary(
    { 'actions/act_as/piece.json': '[]', 'actions/act_as/code.asm': '' },
    'builtin',
  );
  expect(library.errors).toEqual([
    { origin: 'builtin', file: 'actions/act_as/piece.json', message: 'must be an object' },
  ]);
});
