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

export interface Group {
  name: string;
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

export function groupName(slot: SlotId): string {
  return GROUPS.find((group) => [...group.slots, ...(group.advanced ?? [])].includes(slot))!.name;
}
