// Which GPS offset runs which Slot (spec "Slots → offsets"). Slots are Block sides; several
// offsets can share one section, and some offsets split two Slots at runtime.

import { cornerFollowsTop, slotFilled, type BlockModel, type SlotId } from '../model';

/** GPS offsets in jump-table order; the last two exist only with the `db $37` header. */
export const OFFSETS = [
  'MarioBelow',
  'MarioAbove',
  'MarioSide',
  'SpriteV',
  'SpriteH',
  'MarioCape',
  'MarioFireball',
  'TopCorner',
  'BodyInside',
  'HeadInside',
  'WallFeet',
  'WallBody',
] as const;
export type Offset = (typeof OFFSETS)[number];

const WALL_RUN_OFFSETS: readonly Offset[] = ['WallFeet', 'WallBody'];

/** Offsets per jump-table line, as in GPS's template.asm. */
export const JUMP_TABLE_ROWS = [3, 4, 3, 2];

/** Two Slots on one offset, told apart at runtime: the test falls through to `first`. */
export interface Split {
  first: SlotId;
  second: SlotId;
  /** Label name (per Block, made unique) where `second` starts. */
  secondLabel: string;
  /** Lines before the test, e.g. `%sprite_block_position()`. */
  setup: string[];
  /** Loads the value to test; the branch goes to `second`. */
  test: string;
  branch: 'BNE' | 'BMI';
}

const SPLITS: Partial<Record<Offset, Split>> = {
  MarioSide: {
    first: 'marioLeft',
    second: 'marioRight',
    secondLabel: 'right',
    setup: [],
    // $93 (PlayerBlockXSide) is 0 when Mario's X & $0F < 8, i.e. he touches the block from
    // its left (disassembly CODE_00EB77; GPS hurt_death.asm SidePixelTable).
    test: 'LDA $93 ; 0: Mario is left of the block',
    branch: 'BNE',
  },
  SpriteV: {
    first: 'spriteTop',
    second: 'spriteBottom',
    secondLabel: 'bottom',
    setup: ['%sprite_block_position()'],
    test: 'LDA !AA,x ; negative: moving up, touches the bottom',
    branch: 'BMI',
  },
  SpriteH: {
    first: 'spriteLeft',
    second: 'spriteRight',
    secondLabel: 'right',
    setup: ['%sprite_block_position()'],
    test: 'LDA !B6,x ; negative: moving left, touches the right side',
    branch: 'BMI',
  },
};

export type Section =
  | { kind: 'slot'; offsets: Offset[]; slot: SlotId }
  | { kind: 'split'; offsets: Offset[]; split: Split };

export interface SectionPlan {
  /** `db $37`: a wall-run Slot is filled, so the table has WallFeet / WallBody. */
  wallRun: boolean;
  /** Offsets of the jump table, in order. */
  offsets: Offset[];
  /** Filled sections in jump-table order of their first offset. */
  sections: Section[];
  /** Offsets with nothing to do; they share one `RTL`. */
  empty: Offset[];
}

export function planSections(model: BlockModel): SectionPlan {
  const filled = (slot: SlotId) => slotFilled(model, slot);
  const wallRun = filled('marioWallFeet') || filled('marioWallBody');
  const offsets = OFFSETS.filter((offset) => wallRun || !WALL_RUN_OFFSETS.includes(offset));

  /** The Slot an offset runs, before checking whether that Slot has any statements. */
  const slotOf = (offset: Offset): SlotId | undefined => {
    switch (offset) {
      case 'MarioBelow':
        return 'marioBottom';
      case 'MarioAbove':
        return 'marioTop';
      case 'MarioCape':
        return 'marioCape';
      case 'MarioFireball':
        return 'marioFireball';
      case 'TopCorner':
        if (cornerFollowsTop(model)) return 'marioTop';
        return filled('marioTopCorner') ? 'marioTopCorner' : undefined;
      case 'BodyInside':
        return filled('marioBodyInside') ? 'marioBodyInside' : 'marioInside';
      case 'HeadInside':
        return filled('marioHeadInside') ? 'marioHeadInside' : 'marioInside';
      case 'WallFeet':
        return 'marioWallFeet';
      case 'WallBody':
        return 'marioWallBody';
      default:
        return undefined;
    }
  };

  // Keyed by what the section runs: a split's offset or a Slot shared by several offsets.
  const sections = new Map<Offset | SlotId, Section>();
  const empty: Offset[] = [];
  for (const offset of offsets) {
    const split = SPLITS[offset];
    if (split && (filled(split.first) || filled(split.second))) {
      sections.set(offset, { kind: 'split', offsets: [offset], split });
      continue;
    }
    const slot = slotOf(offset);
    if (slot === undefined || !filled(slot)) {
      empty.push(offset);
      continue;
    }
    // Offsets running the same Slot share one section (stacked labels).
    const shared = sections.get(slot);
    if (shared) shared.offsets.push(offset);
    else sections.set(slot, { kind: 'slot', offsets: [offset], slot });
  }
  return { wallRun, offsets, sections: [...sections.values()], empty };
}
