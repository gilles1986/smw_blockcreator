// The Presets of the built-in Library as models: what `library/presets/<name>.asm` is generated
// from (`npm run presets` rewrites the files). The app only reads the files; a Preset is an
// ordinary Block that "New from preset…" opens as a copy.

import type { BlockModel, Statement } from '../model';

/** Written into the Presets' header, so regenerating them gives the same bytes. */
export const PRESET_TOOL_VERSION = 'preset';

const hurt = (sideHitbox: boolean): Statement => ({
  type: 'action',
  piece: { id: 'hurt_mario', version: 2, params: { side_hitbox: sideHitbox } },
});

const kill = (sideHitbox: boolean): Statement => ({
  type: 'action',
  piece: { id: 'kill_mario', version: 2, params: { side_hitbox: sideHitbox } },
});

export const PRESETS: Readonly<Record<string, BlockModel>> = {
  // Built as in GPS's hurt_death.asm: the sides go through the edge pixel test, one Slot for all
  // of them; Top and Bottom hurt outright. Solid for sprites through act as 130.
  muncher: {
    properties: {
      name: 'muncher',
      description:
        'Hurts Mario like a vanilla muncher, from every side, but not when he only touches the edge pixel of a side. Solid for sprites.',
      author: 'BlockCreator',
      defaultActAs: 0x130,
    },
    slots: {
      marioLeft: [hurt(true)],
      marioTop: [hurt(false)],
      marioBottom: [hurt(false)],
    },
    slotLinks: {
      marioRight: 'marioLeft',
      marioTopCorner: 'marioLeft',
      marioInside: 'marioLeft',
    },
  },
  death_block: {
    properties: {
      name: 'death_block',
      description:
        'Kills Mario instantly from every side, but not when he only touches the edge pixel of a side. Solid for sprites.',
      author: 'BlockCreator',
      defaultActAs: 0x130,
    },
    slots: {
      marioLeft: [kill(true)],
      marioTop: [kill(false)],
      marioBottom: [kill(false)],
    },
    slotLinks: {
      marioRight: 'marioLeft',
      marioTopCorner: 'marioLeft',
      marioInside: 'marioLeft',
    },
  },
};
