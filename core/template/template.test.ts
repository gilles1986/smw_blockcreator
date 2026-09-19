import { describe, expect, it } from 'vitest';
import {
  createLabelAllocator,
  render,
  RESERVED_NAMES,
  TemplateError,
  type RenderContext,
} from './index';

function ctx(
  params: RenderContext['params'] = {},
  extra: Partial<RenderContext> = {},
): RenderContext {
  return { params, label: (name) => `L_${name}`, ...extra };
}

describe('render', () => {
  it('substitutes number params as decimal and text params verbatim', () => {
    expect(render('LDA #{{amount}} ; {{note}}', ctx({ amount: 48, note: 'act as 130' }))).toBe(
      'LDA #48 ; act as 130',
    );
  });

  it('rejects an unknown param with its name and line', () => {
    const run = () => render('LDA #$30\nSTA {{adress}}', ctx({ address: 0x1693 }));
    expect(run).toThrow(TemplateError);
    expect(run).toThrow("line 2: unknown parameter 'adress'");
  });

  describe('hex', () => {
    it('formats with $ and an even number of upper-case digits', () => {
      const params = { sound: 0x1, tile: 0x130, ram: 0x7e0019 };
      expect(render('{{hex sound}} {{hex tile}} {{hex ram}}', ctx(params))).toBe(
        '$01 $0130 $7E0019',
      );
    });

    it('pads to a given digit count', () => {
      expect(render('STA {{hex addr 4}}', ctx({ addr: 0x19 }))).toBe('STA $0019');
    });

    it('rejects values that do not fit the digit count', () => {
      expect(() => render('{{hex addr 2}}', ctx({ addr: 0x100 }))).toThrow(
        "line 1: 'addr' = 256 does not fit in 2 hex digits",
      );
    });

    it('rejects negative, fractional and non-number values', () => {
      expect(() => render('{{hex v}}', ctx({ v: -1 }))).toThrow(
        "'v' must be a non-negative integer",
      );
      expect(() => render('{{hex v}}', ctx({ v: 1.5 }))).toThrow(
        "'v' must be a non-negative integer",
      );
      expect(() => render('{{hex v}}', ctx({ v: '12' }))).toThrow(
        "'v' must be a non-negative integer",
      );
    });
  });

  describe('signed', () => {
    it('formats -128..127 as a two’s-complement byte', () => {
      const params = { up: -16, right: 48, min: -128, max: 127 };
      expect(
        render('{{signed up}} {{signed right}} {{signed min}} {{signed max}}', ctx(params)),
      ).toBe('$F0 $30 $80 $7F');
    });

    it('rejects values outside -128..127', () => {
      expect(() => render('{{signed v}}', ctx({ v: 128 }))).toThrow(
        "line 1: 'v' = 128 is not a signed byte (-128..127)",
      );
      expect(() => render('{{signed v}}', ctx({ v: -129 }))).toThrow('is not a signed byte');
    });
  });

  describe('lo / hi', () => {
    it('splits a 16-bit value into its low and high byte', () => {
      expect(render('LDY #{{hi tile}} : LDA #{{lo tile}}', ctx({ tile: 0x130 }))).toBe(
        'LDY #$01 : LDA #$30',
      );
    });

    it('rejects values above $FFFF', () => {
      expect(() => render('{{lo v}}', ctx({ v: 0x10000 }))).toThrow(
        "'v' = 65536 does not fit in 16 bits",
      );
    });
  });

  describe('ram', () => {
    it('writes an address of the game RAM the way GPS code must, so it works on SA-1 too', () => {
      // $00-$FF is direct page and $0100-$1FFF absolute, both moved by the SA-1 patch; bank $7E
      // mirrors them, and the RAM maps give the addresses that way.
      const at = (address: number) => render('{{ram a}}', ctx({ a: address }));
      expect(at(0x85)).toBe('$85');
      expect(at(0x7e0085)).toBe('$85');
      expect(at(0x100)).toBe('$0100|!addr');
      expect(at(0x0f44)).toBe('$0F44|!addr');
      expect(at(0x7e0f44)).toBe('$0F44|!addr');
      expect(at(0x1fff)).toBe('$1FFF|!addr');
    });

    it('leaves every other address as a 24-bit one, which the author has to get right', () => {
      const at = (address: number) => render('{{ram a}}', ctx({ a: address }));
      expect(at(0x2000)).toBe('$002000');
      expect(at(0x7e2000)).toBe('$7E2000');
      expect(at(0x7fab10)).toBe('$7FAB10');
      expect(at(0x400000)).toBe('$400000');
    });

    it('rejects values that are no 24-bit address', () => {
      expect(() => render('{{ram v}}', ctx({ v: 0x1000000 }))).toThrow(
        "'v' = 16777216 does not fit in 24 bits",
      );
      expect(() => render('{{ram v}}', ctx({ v: -1 }))).toThrow(
        "'v' must be a non-negative integer",
      );
    });
  });

  describe('slot', () => {
    // The Slot the Piece is rendered for, given by the generator: Top or Bottom, Mario or sprite.
    it('is the Slot id, to print or to test', () => {
      const tpl = '{{slot}}: {{#if slot "marioTop" "marioBottom"}}up or down{{else}}beside{{/if}}';
      expect(render(tpl, ctx({}, { slot: 'marioTop' }))).toBe('marioTop: up or down');
      expect(render(tpl, ctx({}, { slot: 'marioLeft' }))).toBe('marioLeft: beside');
    });

    it('is not there when nothing renders the Piece for a Slot', () => {
      expect(() => render('{{slot}}', ctx())).toThrow(
        "line 1: 'slot' is only available when a Piece is rendered for a Slot",
      );
      expect(() => render('{{#if slot "marioTop"}}x{{/if}}', ctx())).toThrow(
        "'slot' is only available",
      );
    });

    it('is reserved, so a param cannot hide it', () => {
      expect(RESERVED_NAMES).toContain('slot');
    });
  });

  describe('#if with several values', () => {
    const tpl = '{{#if d "left" "right"}}sideways{{else}}vertical{{/if}}';

    it('is true when the param is any of them', () => {
      expect(render(tpl, ctx({ d: 'left' }))).toBe('sideways');
      expect(render(tpl, ctx({ d: 'right' }))).toBe('sideways');
      expect(render(tpl, ctx({ d: 'up' }))).toBe('vertical');
    });

    it('compares numbers and booleans as text, like a single value', () => {
      expect(render('{{#if n "1" "2"}}y{{else}}n{{/if}}', ctx({ n: 2 }))).toBe('y');
      expect(render('{{#if n "1" "2"}}y{{else}}n{{/if}}', ctx({ n: 3 }))).toBe('n');
    });
  });

  describe('#if', () => {
    const tpl = '{{#if add}}ADC{{else}}LDA{{/if}} #$10';

    it('renders the first branch when the param is truthy, else the else-branch', () => {
      for (const add of [true, 1, 'yes', [0]]) {
        expect(render(tpl, ctx({ add }))).toBe('ADC #$10');
      }
      for (const add of [false, 0, '', []]) {
        expect(render(tpl, ctx({ add }))).toBe('LDA #$10');
      }
    });

    it('renders nothing for a false condition without else', () => {
      expect(render('A{{#if flag}}B{{/if}}C', ctx({ flag: false }))).toBe('AC');
    });

    it('matches against an expected value when provided', () => {
      const tpl =
        '{{#if pos "above"}}ABOVE{{/if}}{{#if pos "below"}}BELOW{{/if}}{{#if pos "inside"}}INSIDE{{/if}}';
      expect(render(tpl, ctx({ pos: 'above' }))).toBe('ABOVE');
      expect(render(tpl, ctx({ pos: 'below' }))).toBe('BELOW');
      expect(render(tpl, ctx({ pos: 'inside' }))).toBe('INSIDE');
    });

    it('drops lines that hold only a block tag', () => {
      const tpl = [
        'LDA #$01',
        '  {{#if sound}}',
        '  STA $1DFC|!addr',
        '  {{else}}',
        '  STZ $1DFC|!addr',
        '  {{/if}}',
        'RTL',
      ].join('\r\n');
      expect(render(tpl, ctx({ sound: true }))).toBe('LDA #$01\r\n  STA $1DFC|!addr\r\nRTL');
      expect(render(tpl, ctx({ sound: false }))).toBe('LDA #$01\r\n  STZ $1DFC|!addr\r\nRTL');
    });

    it('drops a standalone block tag on the first and last line', () => {
      expect(render('{{#if a}}\nNOP\n{{/if}}', ctx({ a: true }))).toBe('NOP\n');
    });

    it('rejects an unknown param in the condition', () => {
      expect(() => render('\n{{#if flga}}B{{/if}}', ctx({ flag: true }))).toThrow(
        "line 2: unknown parameter 'flga'",
      );
    });
  });

  describe('#each', () => {
    it('repeats its body per item, with the item as {{this}}', () => {
      const tpl = 'extra:\n{{#each bytes}}\n  db {{hex this}}\n{{/each}}\nRTL';
      expect(render(tpl, ctx({ bytes: [1, 0x2a, 0xff] }))).toBe(
        'extra:\n  db $01\n  db $2A\n  db $FF\nRTL',
      );
    });

    it('exposes the fields of object items and still sees outer params', () => {
      const tpl = '{{#each writes}}LDA #{{hex value}} : STA {{hex addr 4}}{{mode}}\n{{/each}}';
      const writes = [
        { addr: 0x19, value: 2 },
        { addr: 0x1490, value: 0xff },
      ];
      expect(render(tpl, ctx({ writes, mode: '|!addr' }))).toBe(
        'LDA #$02 : STA $0019|!addr\nLDA #$FF : STA $1490|!addr\n',
      );
    });

    it('renders nothing for an empty list', () => {
      expect(render('A{{#each xs}}B{{/each}}C', ctx({ xs: [] }))).toBe('AC');
    });

    it('rejects a param that is not a list', () => {
      expect(() => render('{{#each n}}x{{/each}}', ctx({ n: 3 }))).toThrow(
        "line 1: 'n' must be a list, got 3",
      );
    });

    it('nests with #if and other #each blocks', () => {
      const tpl = [
        '{{#if enabled}}',
        '{{#each groups}}',
        '{{#if skip}}',
        '; skipped',
        '{{else}}',
        '{{#each bytes}}',
        'db {{hex this}}',
        '{{/each}}',
        '{{/if}}',
        '{{/each}}',
        '{{/if}}',
      ].join('\n');
      const groups = [
        { skip: false, bytes: [1, 2] },
        { skip: true, bytes: [] },
        { skip: false, bytes: [3] },
      ];
      expect(render(tpl, ctx({ enabled: true, groups }))).toBe(
        'db $01\ndb $02\n; skipped\ndb $03\n',
      );
      expect(render(tpl, ctx({ enabled: false, groups }))).toBe('');
    });

    it('rejects {{this}} outside #each', () => {
      expect(() => render('{{this}}', ctx())).toThrow(
        "line 1: 'this' is only available inside #each",
      );
    });
  });

  describe('malformed templates', () => {
    const cases: [string, string, RenderContext['params']][] = [
      ['NOP\n{{#if a}}\nNOP', 'line 2: {{#if a}} is never closed', { a: true }],
      ['{{#each xs}}', 'line 1: {{#each xs}} is never closed', { xs: [] }],
      ['NOP\n{{/if}}', 'line 2: {{/if}} has no matching {{#if}}', {}],
      ['{{else}}', 'line 1: {{else}} outside {{#if}}', {}],
      ['{{#if a}}\n{{/each}}', 'line 2: {{/each}} cannot close {{#if a}} from line 1', { a: true }],
      ['{{#each xs}}{{else}}{{/each}}', 'line 1: {{else}} outside {{#if}}', { xs: [] }],
      ['{{#if a}}1{{else}}2{{else}}3{{/if}}', 'line 1: second {{else}} in {{#if a}}', { a: true }],
      ['{{#if}}x{{/if}}', 'line 1: #if needs a parameter name', {}],
      ['{{hex}}', 'line 1: hex needs a parameter name', {}],
      ['{{hexx v}}', "line 1: unknown helper 'hexx'", { v: 1 }],
      ['{{hex v four}}', "line 1: hex digit count must be 1 to 8, got 'four'", { v: 1 }],
      ['NOP\nLDA {{v', 'line 2: {{ is never closed with }}', { v: 1 }],
      ['{{xs}}', "line 1: 'xs' is a list; use {{#each xs}}", { xs: [1] }],
      ['{{flag}}', "line 1: 'flag' is true/false; use {{#if flag}}", { flag: true }],
    ];

    it.each(cases)('%j → %s', (tpl, message, params) => {
      expect(() => render(tpl, ctx(params))).toThrow(message);
    });

    it('reports structure errors even in branches that are not rendered', () => {
      expect(() => render('{{#if a}}{{#each xs}}{{/if}}', ctx({ a: false, xs: [] }))).toThrow(
        'line 1: {{/if}} cannot close {{#each xs}} from line 1',
      );
      expect(() => render('{{#if a}}\n{{label skip}}\n{{/if}}', ctx({ a: false }))).toThrow(
        'line 2: label needs a quoted name',
      );
    });

    it('reports unknown params and {{false}} in an Action even in branches that are not rendered', () => {
      expect(() => render('{{#if a}}\nLDA {{typo}}\n{{/if}}', ctx({ a: false }))).toThrow(
        "line 2: unknown parameter 'typo'",
      );
      expect(() => render('{{#if a}}{{#each typo}}{{/each}}{{/if}}', ctx({ a: false }))).toThrow(
        "line 1: unknown parameter 'typo'",
      );
      expect(() => render('{{#if a}}\n\nBRA {{false}}\n{{/if}}', ctx({ a: false }))).toThrow(
        'line 3: {{false}} is only available in Conditions',
      );
    });

    it('rejects {{label}} inside #each, where every item would define the same label', () => {
      expect(() =>
        render('{{#each xs}}\n{{label "skip"}}:\n{{/each}}', ctx({ xs: [1, 2] })),
      ).toThrow('line 2: {{label}} cannot be used inside {{#each xs}}: the label would repeat');
    });
  });

  describe('false', () => {
    it('renders the false-target the generator passes to a Condition', () => {
      const tpl = 'LDA $14AF|!addr\n{{#if on}}BNE{{else}}BEQ{{/if}} {{false}}';
      expect(render(tpl, ctx({ on: true }, { falseLabel: 'bc3_else' }))).toBe(
        'LDA $14AF|!addr\nBNE bc3_else',
      );
    });

    it('is rejected when no false-target is given (Actions)', () => {
      expect(() => render('\nBRA {{false}}', ctx())).toThrow(
        'line 2: {{false}} is only available in Conditions',
      );
    });
  });

  describe('label', () => {
    const tpl = 'LDA $14AF|!addr : BNE {{label "off"}}\n  NOP\n{{label "off"}}:';

    it('asks the injected label factory for each name', () => {
      expect(render(tpl, ctx())).toBe('LDA $14AF|!addr : BNE L_off\n  NOP\nL_off:');
    });

    it('is unique across two Piece instances and stable within one', () => {
      const labels = createLabelAllocator();
      const first = render(tpl, { params: {}, label: labels.instance() });
      const second = render(tpl, { params: {}, label: labels.instance() });
      expect(first).toBe('LDA $14AF|!addr : BNE bc1_off\n  NOP\nbc1_off:');
      expect(second).toBe('LDA $14AF|!addr : BNE bc2_off\n  NOP\nbc2_off:');
    });

    it('numbers deterministically: a fresh allocator starts over', () => {
      const run = () => render(tpl, { params: {}, label: createLabelAllocator().instance() });
      expect(run()).toBe(run());
    });

    it('requires a quoted name made of letters, digits and _', () => {
      expect(() => render('{{label off}}', ctx())).toThrow(
        'line 1: label needs a quoted name, e.g. {{label "skip"}}',
      );
      expect(() => render('{{label "2nd"}}', ctx())).toThrow(
        "line 1: label name '2nd' must start with a letter and use only letters, digits and _",
      );
    });
  });
});
