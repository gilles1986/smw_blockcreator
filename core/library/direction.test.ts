// Ticket 12: Boost Mario and Push sprite push in a direction, or away from the block. The speeds are
// signed bytes: $7B / !B6 are positive to the right, $7D / !AA positive downwards (RAM map).
import { describe, expect, it } from 'vitest';
import { SLOT_IDS, slotKind, type SlotId } from '../model';
import { render, type Value } from '../template';
import { builtInLibrary } from '../testing/library';

const library = builtInLibrary();

function piece(id: string, slot: SlotId, params: Record<string, Value> = {}): string {
  const found = library.pieces.get(id);
  if (!found) throw new Error(`Piece '${id}' not loaded`);
  const defaults = Object.fromEntries(found.manifest.params.map((p) => [p.name, p.default]));
  return render(found.template, {
    params: { ...defaults, ...params },
    label: (name) => `L_${name}`,
    slot,
  });
}

const lines = (...text: string[]) => (text.length === 0 ? '' : `${text.join('\n')}\n`);

describe.each([
  { id: 'boost_mario', slot: 'marioTop' as SlotId, x: '$7B', y: '$7D' },
  { id: 'push_sprite', slot: 'spriteTop' as SlotId, x: '!B6,x', y: '!AA,x' },
])('$id in a direction', ({ id, slot, x, y }) => {
  const push = (params: Record<string, Value>) => piece(id, slot, params);
  const set = (value: string, at: string) => `LDA #${value} : STA ${at}`;
  const add = (value: string, at: string) => `LDA ${at} : CLC : ADC #${value} : STA ${at}`;

  it('does the same as before by default: an upward push on Y only', () => {
    const strength = id === 'boost_mario' ? '$60' : '$40';
    expect(push({})).toBe(lines(set(`-${strength}`, y)));
  });

  it('pushes left or right, up or down, one axis or both, by the strength', () => {
    const both = { x_strength: 0x30, y_strength: 0x50 };
    expect(push({ ...both, x_direction: 'left', y_direction: 'none' })).toBe(lines(set('-$30', x)));
    expect(push({ ...both, x_direction: 'right', y_direction: 'none' })).toBe(lines(set('$30', x)));
    expect(push({ ...both, x_direction: 'none', y_direction: 'down' })).toBe(lines(set('$50', y)));
    expect(push({ ...both, x_direction: 'right', y_direction: 'up' })).toBe(
      lines(set('$30', x), set('-$50', y)),
    );
    expect(push({ ...both, x_direction: 'left', y_direction: 'down' })).toBe(
      lines(set('-$30', x), set('$50', y)),
    );
    expect(push({ ...both, x_direction: 'none', y_direction: 'none' })).toBe('');
  });

  it('adds to the speed instead, when asked', () => {
    const params = { mode: 1, x_strength: 0x18, y_strength: 0x7f };
    expect(push({ ...params, x_direction: 'left', y_direction: 'down' })).toBe(
      lines(add('-$18', x), add('$7F', y)),
    );
    expect(push({ ...params, x_direction: 'right', y_direction: 'up' })).toBe(
      lines(add('$18', x), add('-$7F', y)),
    );
  });

  it('takes strengths from 0 to 127, and the four directions of each axis', () => {
    const { params } = library.pieces.get(id)!.manifest;
    const named = (name: string) => params.find((p) => p.name === name)!;
    expect([named('x_strength').min, named('x_strength').max]).toEqual([0, 127]);
    expect([named('y_strength').min, named('y_strength').max]).toEqual([0, 127]);
    expect(named('x_direction').options!.map((o) => o.value)).toEqual([
      'none',
      'left',
      'right',
      'away',
    ]);
    expect(named('y_direction').options!.map((o) => o.value)).toEqual([
      'none',
      'up',
      'down',
      'away',
    ]);
    expect(library.pieces.get(id)!.manifest.version).toBe(2);
  });
});

describe('Boost Mario away from the block', () => {
  const away = (slot: SlotId, params: Record<string, Value> = {}) =>
    piece('boost_mario', slot, {
      x_direction: 'away',
      y_direction: 'away',
      x_strength: 0x30,
      y_strength: 0x60,
      ...params,
    });
  // $93 is 0 while Mario is left of the block, so he is pushed left, and right otherwise.
  const sideways = (...after: string[]) => [
    'LDA $93',
    'BEQ L_x_left',
    'LDA #$30',
    'BRA L_x_set',
    'L_x_left:',
    'LDA #-$30',
    'L_x_set:',
    ...after,
  ];
  const up = 'LDA #-$60 : STA $7D';
  const down = 'LDA #$60 : STA $7D';

  const perSlot: [SlotId, string[]][] = [
    // Top: up. Bottom: down. Nothing sideways, there is no side.
    ['marioTop', [up]],
    ['marioBottom', [down]],
    // Left and Right, and code shared by them: away from the side Mario is on, by $93.
    ['marioLeft', sideways('STA $7B')],
    ['marioRight', sideways('STA $7B')],
    // Inside, and the corner: the same, and the corner also pushes up.
    ['marioInside', sideways('STA $7B')],
    ['marioHeadInside', sideways('STA $7B')],
    ['marioBodyInside', sideways('STA $7B')],
    ['marioTopCorner', [...sideways('STA $7B'), up]],
    // No side to be away from.
    ['marioCape', []],
    ['marioFireball', []],
    ['marioWallFeet', []],
    ['marioWallBody', []],
  ];

  it.each(perSlot)('in %s', (slot, expected) => {
    expect(away(slot)).toBe(lines(...expected));
  });

  it('says what it does in every Mario Slot', () => {
    expect(perSlot.map(([slot]) => slot).sort()).toEqual(
      SLOT_IDS.filter((slot) => slotKind(slot) === 'mario').sort(),
    );
  });

  it('adds to the speed when asked: the pushed speed first, then $7B plus it', () => {
    expect(away('marioLeft', { mode: 1 })).toBe(lines(...sideways('CLC', 'ADC $7B', 'STA $7B')));
    expect(away('marioBottom', { mode: 1 })).toBe(lines('LDA $7D : CLC : ADC #$60 : STA $7D'));
    expect(away('marioTop', { mode: 1 })).toBe(lines('LDA $7D : CLC : ADC #-$60 : STA $7D'));
  });

  it('uses the strength of its own axis, and can be away on one axis only', () => {
    expect(away('marioLeft', { x_strength: 0x10 })).toContain('LDA #-$10\n');
    expect(away('marioTop', { y_strength: 0x20, x_direction: 'left', x_strength: 0x08 })).toBe(
      lines('LDA #-$08 : STA $7B', 'LDA #-$20 : STA $7D'),
    );
    expect(away('marioLeft', { y_direction: 'none' })).toBe(lines(...sideways('STA $7B')));
  });
});

describe('Push sprite away from the block', () => {
  const away = (slot: SlotId, params: Record<string, Value> = {}) =>
    piece('push_sprite', slot, {
      x_direction: 'away',
      y_direction: 'away',
      x_strength: 0x30,
      y_strength: 0x40,
      ...params,
    });

  const perSlot: [SlotId, string[]][] = [
    // The sprite touches the top: it is sent up. Top and Bottom are vertical, Left and Right sideways.
    ['spriteTop', ['LDA #-$40 : STA !AA,x']],
    ['spriteBottom', ['LDA #$40 : STA !AA,x']],
    ['spriteLeft', ['LDA #-$30 : STA !B6,x']],
    ['spriteRight', ['LDA #$30 : STA !B6,x']],
  ];

  it.each(perSlot)('in %s', (slot, expected) => {
    expect(away(slot)).toBe(lines(...expected));
  });

  it('says what it does in every sprite Slot', () => {
    expect(perSlot.map(([slot]) => slot).sort()).toEqual(
      SLOT_IDS.filter((slot) => slotKind(slot) === 'sprite').sort(),
    );
  });

  it('adds to the speed when asked', () => {
    expect(away('spriteTop', { mode: 1 })).toBe(lines('LDA !AA,x : CLC : ADC #-$40 : STA !AA,x'));
    expect(away('spriteRight', { mode: 1 })).toBe(lines('LDA !B6,x : CLC : ADC #$30 : STA !B6,x'));
  });
});
