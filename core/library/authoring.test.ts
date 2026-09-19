// Ticket 21: docs/piece-authoring.md and its worked example. The example is a real Library folder
// (docs/examples/piece-authoring), so the guide can be followed for real; these tests keep the
// guide, the example and the code from drifting apart.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../generator';
import { SLOT_IDS, type BlockModel } from '../model';
import { render, RESERVED_NAMES } from '../template';
import { builtInLibrary, libraryFolder, readFolder } from '../testing/library';
import { mergeLibraries } from './merge';

const root = join(import.meta.dirname, '..', '..');
const guide = readFileSync(join(root, 'docs', 'piece-authoring.md'), 'utf8').replace(/\r\n/g, '\n');
const exampleDir = join(root, 'docs', 'examples', 'piece-authoring');
const schema = JSON.parse(readFileSync(join(root, 'core', 'library', 'piece.schema.json'), 'utf8'));

const example = libraryFolder(exampleDir);
const library = mergeLibraries(builtInLibrary(), example);

describe('the worked example of the guide', () => {
  it('is a Library folder that loads without errors, next to the built-in Library', () => {
    expect(example.errors).toEqual([]);
    expect([...example.pieces.keys()]).toEqual(['c_yoshi_ducking']);
    expect(library.errors).toEqual([]);
    expect(library.pieces.has('act_as')).toBe(true);
    expect(library.pieces.get('c_yoshi_ducking')?.origin).toBe('user');
  });

  it('tests for riding Yoshi first, then for ducking or not ducking', () => {
    const { manifest, template } = library.pieces.get('c_yoshi_ducking')!;
    expect(manifest.params.map((p) => p.name)).toEqual(['ducking']);
    const test = (ducking: boolean) =>
      render(template, { params: { ducking }, label: (name) => name, falseLabel: 'no' });
    expect(test(true)).toBe('LDA $187A|!addr\nBEQ no\nLDA $73\nBEQ no\n');
    expect(test(false)).toBe('LDA $187A|!addr\nBEQ no\nLDA $73\nBNE no\n');
  });

  it('can be used in a Block, like a Piece of the built-in Library', () => {
    const model: BlockModel = {
      properties: { name: 'yoshi_duck', description: '', author: '', defaultActAs: 0x130 },
      slots: {
        marioTop: [
          {
            type: 'if',
            branches: [
              {
                condition: {
                  type: 'condition',
                  piece: { id: 'c_yoshi_ducking', version: 1, params: { ducking: true } },
                },
                body: [
                  {
                    type: 'action',
                    piece: { id: 'act_as', version: 1, params: { tile: 0x25 } },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const { text } = generate(model, library);
    expect(text).toContain('\tLDA $187A|!addr\n\tBEQ bc1_end\n\tLDA $73\n\tBEQ bc1_end\n');
  });
});

describe('the guide', () => {
  it('shows the files of the example exactly, and all of them', () => {
    const shown = new Map(
      [...guide.matchAll(/^```\w* file=(\S+)\n([\s\S]*?)^```/gm)].map((m) => [m[1]!, m[2]!]),
    );
    const files = readFolder(exampleDir);
    expect([...shown.keys()].sort()).toEqual(Object.keys(files).sort());
    for (const [path, text] of shown) {
      expect(text.trim(), path).toBe(files[path]!.replace(/\r\n/g, '\n').trim());
    }
  });

  it('shows the code the example makes in a Block as the generator writes it', () => {
    const shown = /^```asm\n(\tLDA \$187A[\s\S]*?)^```/m.exec(guide)?.[1];
    expect(shown).toBeDefined();
    const act: BlockModel['slots'] = {
      marioTop: [
        {
          type: 'if',
          branches: [
            {
              condition: {
                type: 'condition',
                piece: { id: 'c_yoshi_ducking', version: 1, params: { ducking: true } },
              },
              body: [
                { type: 'action', piece: { id: 'act_as', version: 1, params: { tile: 0x25 } } },
              ],
            },
          ],
        },
      ],
    };
    const properties = { name: 'x', description: '', author: '', defaultActAs: 0x130 };
    const { text } = generate({ properties, slots: act }, library);
    expect(text).toContain(shown!);
  });

  const named = (word: string) => guide.includes('`' + word + '`');

  it('names every field of the manifest, of a parameter, of an option and of showWhen', () => {
    const param = schema.definitions.param;
    const fields = [
      ...Object.keys(schema.properties),
      ...Object.keys(param.properties),
      ...Object.keys(param.properties.options.items.properties),
      ...Object.keys(param.properties.showWhen.properties),
    ].filter((name) => name !== '$schema');
    expect(fields.filter((name) => !named(name))).toEqual([]);
  });

  it('names every parameter type, Slot and reserved template word', () => {
    const types: string[] = schema.definitions.param.properties.type.enum;
    expect(types.filter((name) => !named(name))).toEqual([]);
    expect(SLOT_IDS.filter((slot) => !named(slot))).toEqual([]);
    expect(RESERVED_NAMES.filter((word) => !named(word))).toEqual([]);
  });

  it('shows every tag of the template language', () => {
    const tags = [
      '{{name}}',
      '{{hex ',
      '{{signed ',
      '{{lo ',
      '{{hi ',
      '{{ram ',
      '{{slot}}',
      '{{label "',
      '{{false}}',
      '{{#if ',
      '{{else}}',
      '{{/if}}',
      '{{#each ',
    ];
    expect(tags.filter((tag) => !guide.includes(tag))).toEqual([]);
  });

  it('is linked from the README', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('docs/piece-authoring.md');
  });
});
