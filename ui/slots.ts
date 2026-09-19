// Slot rows of the sidebar: labels, groups and the Top corner link rule.

import type { SlotId } from '../core/model';

/** Row labels; a Record so a new Slot in the model cannot be forgotten here. */
export const SLOT_LABELS: Record<SlotId, string> = {
  marioTop: 'Top',
  marioBottom: 'Bottom',
  marioLeft: 'Left',
  marioRight: 'Right',
  marioInside: 'Inside',
  marioTopCorner: 'Top corner',
  marioHeadInside: 'Head inside',
  marioBodyInside: 'Body inside',
  marioCape: 'Cape',
  marioFireball: 'Fireball',
  marioWallFeet: 'Wall-run feet',
  marioWallBody: 'Wall-run body',
  spriteTop: 'Top',
  spriteBottom: 'Bottom',
  spriteLeft: 'Left',
  spriteRight: 'Right',
};

/** In plain words when a Slot fires; shown as tooltip and in the editor header. */
export const SLOT_HINTS: Record<SlotId, string> = {
  marioTop: 'Mario touches the block from above (he lands or stands on it).',
  marioBottom: 'Mario touches the block from below (he bumps it with his head).',
  marioLeft: 'Mario touches the block from the left (he is left of it).',
  marioRight: 'Mario touches the block from the right (he is right of it).',
  marioInside: 'Mario is inside the block.',
  marioTopCorner: "Mario's feet catch the block's top corner, e.g. when he drops in at an angle.",
  marioHeadInside: "Mario's head is inside the block.",
  marioBodyInside: "Mario's body is inside the block.",
  marioCape: "Mario's cape swing hits the block.",
  marioFireball: "One of Mario's fireballs hits the block.",
  marioWallFeet: 'Mario wall-runs along the block, at his feet.',
  marioWallBody: 'Mario wall-runs along the block, at his body.',
  spriteTop: 'A sprite touches the block from above (falling onto it or resting on it).',
  spriteBottom: 'A sprite touches the block from below (moving up into it).',
  spriteLeft: 'A sprite touches the block from the left (moving right into it).',
  spriteRight: 'A sprite touches the block from the right (moving left into it).',
};

/** What a Slot's pictogram draws: the block with the touched side (or spot) marked. */
export type Glyph =
  | { kind: 'side'; side: 'top' | 'bottom' | 'left' | 'right' }
  | { kind: 'inside'; part: 'whole' | 'head' | 'body' }
  | { kind: 'corner' }
  | { kind: 'cape' }
  | { kind: 'fireball' }
  | { kind: 'wall' };

export const SLOT_GLYPHS: Record<SlotId, Glyph> = {
  marioTop: { kind: 'side', side: 'top' },
  marioBottom: { kind: 'side', side: 'bottom' },
  marioLeft: { kind: 'side', side: 'left' },
  marioRight: { kind: 'side', side: 'right' },
  marioInside: { kind: 'inside', part: 'whole' },
  marioTopCorner: { kind: 'corner' },
  marioHeadInside: { kind: 'inside', part: 'head' },
  marioBodyInside: { kind: 'inside', part: 'body' },
  marioCape: { kind: 'cape' },
  marioFireball: { kind: 'fireball' },
  marioWallFeet: { kind: 'wall' },
  marioWallBody: { kind: 'wall' },
  spriteTop: { kind: 'side', side: 'top' },
  spriteBottom: { kind: 'side', side: 'bottom' },
  spriteLeft: { kind: 'side', side: 'left' },
  spriteRight: { kind: 'side', side: 'right' },
};

export type GroupName = 'Mario' | 'Sprite';

export interface Group {
  name: GroupName;
  slots: SlotId[];
  /** Behind the "advanced" toggle unless filled. */
  advanced?: SlotId[];
}

export const GROUPS: Group[] = [
  {
    name: 'Mario',
    slots: ['marioTop', 'marioBottom', 'marioLeft', 'marioRight', 'marioInside'],
    advanced: [
      'marioTopCorner',
      'marioHeadInside',
      'marioBodyInside',
      'marioCape',
      'marioFireball',
      'marioWallFeet',
      'marioWallBody',
    ],
  },
  { name: 'Sprite', slots: ['spriteTop', 'spriteBottom', 'spriteLeft', 'spriteRight'] },
];

export function groupName(slot: SlotId): GroupName {
  return GROUPS.find((group) => [...group.slots, ...(group.advanced ?? [])].includes(slot))!.name;
}
