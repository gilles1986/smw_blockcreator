import { describe, expect, it } from 'vitest';
import { SLOT_IDS, slotKind, type SlotId } from '../core/model';
import { SLOT_GLYPHS, SLOT_HINTS } from './slots';

const SIDES = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' } as const;
/** Word a hint uses for each side: "from above", "from below", "from the left", … */
const SIDE_WORDS = { top: 'above', bottom: 'below', left: 'left', right: 'right' } as const;

/** The Slots named after a side, e.g. marioLeft -> 'left'. */
const sideSlots = SLOT_IDS.flatMap((slot): [SlotId, keyof typeof SIDE_WORDS][] => {
  const name = slot.replace(/^(mario|sprite)/, '');
  return name in SIDES ? [[slot, SIDES[name as keyof typeof SIDES]]] : [];
});

describe('Slot hints and pictograms', () => {
  it('has a sentence and a pictogram for every Slot', () => {
    for (const slot of SLOT_IDS) {
      expect(SLOT_HINTS[slot].length, slot).toBeGreaterThan(0);
      expect(SLOT_GLYPHS[slot], slot).toBeDefined();
    }
  });

  it('names who touches the block', () => {
    for (const slot of SLOT_IDS) {
      const who = slotKind(slot) === 'mario' ? /Mario/ : /sprite/i;
      expect(SLOT_HINTS[slot], slot).toMatch(who);
    }
  });

  it('draws and describes the same side the Slot is named after', () => {
    expect(sideSlots).toHaveLength(8);
    for (const [slot, side] of sideSlots) {
      expect(SLOT_GLYPHS[slot], slot).toEqual({ kind: 'side', side });
      expect(SLOT_HINTS[slot], slot).toContain(SIDE_WORDS[side]);
    }
  });
});
