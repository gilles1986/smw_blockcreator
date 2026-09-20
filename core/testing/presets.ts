// The Presets of the built-in Library as models: what `library/presets/<name>.asm` is generated
// from (`npm run presets` rewrites the files). The app only reads the files; a Preset is an
// ordinary Block that "New from preset…" opens as a copy.

import type { BlockModel, PieceRef, Statement } from '../model';
import type { Value } from '../template';
import { builtInLibrary } from './library';

/** Written into the Presets' header, so regenerating them gives the same bytes. */
export const PRESET_TOOL_VERSION = 'preset';

const library = builtInLibrary();

/** A use of a Piece as the editor saves it: the Library's version and every parameter given. */
function piece(id: string, params: Record<string, Value> = {}): PieceRef {
  const found = library.pieces.get(id);
  if (!found) throw new Error(`Preset: Piece '${id}' is not in the Library`);
  const { manifest } = found;
  const defaults = Object.fromEntries(manifest.params.map((param) => [param.name, param.default]));
  return { id, version: manifest.version, params: { ...defaults, ...params } };
}

const action = (id: string, params?: Record<string, Value>): Statement => ({
  type: 'action',
  piece: piece(id, params),
});

/** `if condition { then } else { otherwise }`. */
const when = (condition: PieceRef, then: Statement[], otherwise?: Statement[]): Statement => ({
  type: 'if',
  branches: [{ condition: { type: 'condition', piece: condition }, body: then }],
  ...(otherwise && { else: otherwise }),
});

const AIR = 0x25;
const SOLID = 0x130;
/** The Map16 tile the game turns a block into once it has given its item. */
const USED_BLOCK = 0x132;

const actAs = (tile: number) => action('act_as', { tile });

const properties = (name: string, description: string) => ({
  name,
  description,
  author: 'BlockCreator',
  defaultActAs: SOLID,
});

const hurt = (sideHitbox: boolean) => action('hurt_mario', { side_hitbox: sideHitbox });
const kill = (sideHitbox: boolean) => action('kill_mario', { side_hitbox: sideHitbox });

// Built as in GPS's hurt_death.asm: the sides go through the edge pixel test, one Slot for all
// of them; Top and Bottom hurt outright. Solid for sprites through act as 130.
const muncher: BlockModel = {
  properties: properties(
    'muncher',
    'Hurts Mario like a vanilla muncher, from every side, but not when he only touches the edge pixel of a side. Solid for sprites.',
  ),
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
};

/** Solid (130) while the switch is ON, air (025) while it is OFF. */
const onOffRule = () => [when(piece('c_onoff', { position: 0 }), [actAs(SOLID)], [actAs(AIR)])];

// The Blocks of the archive survey (ticket 24): built from the new Pieces.

/** The bounce of a ? block, which turns into a used block afterwards. */
const bounceUsed = () => action('bounce_block', { bounce: 3, becomes: 13, direction: 0 });
const spawnAbove = (sprite: number) =>
  action('spawn_sprite', { custom: false, sprite_number: sprite, position: 'above' });
/** Solid unless Mario pays: he needs 5 coins, which are taken, and the block is gone. */
const tollRule = () => [
  when(piece('c_coins', { comparison: 'greater_equal', value: 5 }), [
    action('take_coins', { amount: 5 }),
    action('erase_block'),
  ]),
];
/** Solid unless Mario carries a key (sprite 80): the key is used up and the block is gone. */
const lockRule = () => [
  when(piece('c_holding_sprite_id', { custom: false, sprite_number: 0x80 }), [
    action('remove_carried', { mode: 'delete' }),
    action('erase_block'),
  ]),
];
/** Passable once the level's five Yoshi coins are collected. */
const yoshiCoinRule = () => [
  when(piece('c_yoshi_coins', { source: 'this_attempt', count: 5 }), [actAs(AIR)], [actAs(SOLID)]),
];

export const PRESETS: Readonly<Record<string, BlockModel>> = {
  muncher,
  death_block: {
    properties: properties(
      'death_block',
      'Kills Mario instantly from every side, but not when he only touches the edge pixel of a side. Solid for sprites.',
    ),
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
  // Sprites die on it, as on nothing else in the game. The four sprite Slots share one Slot.
  muncher_sprite_killer: {
    ...muncher,
    properties: properties(
      'muncher_sprite_killer',
      'Hurts Mario like a vanilla muncher, from every side, but not when he only touches the edge pixel of a side. Every sprite that touches it dies.',
    ),
    slots: { ...muncher.slots, spriteTop: [action('kill_touching_sprite', { style: 0 })] },
    slotLinks: {
      ...muncher.slotLinks,
      spriteBottom: 'spriteTop',
      spriteLeft: 'spriteTop',
      spriteRight: 'spriteTop',
    },
  },
  // Every side, for Mario and for sprites; Right is Left's twin, and the Top corner follows Top.
  onoff_solid: {
    properties: properties(
      'onoff_solid',
      'Solid for Mario and sprites while the ON/OFF switch is ON, and passable while it is OFF.',
    ),
    slots: {
      marioTop: onOffRule(),
      marioBottom: onOffRule(),
      marioLeft: onOffRule(),
      spriteTop: onOffRule(),
      spriteBottom: onOffRule(),
      spriteLeft: onOffRule(),
    },
    slotLinks: { marioRight: 'marioLeft', spriteRight: 'spriteLeft' },
  },
  mario_passable: {
    properties: properties(
      'mario_passable',
      'Mario walks through it from every side, sprites cannot.',
    ),
    slots: {
      marioTop: [actAs(AIR)],
      marioBottom: [actAs(AIR)],
      marioLeft: [actAs(AIR)],
      marioInside: [actAs(AIR)],
    },
    slotLinks: { marioRight: 'marioLeft' },
  },
  sprite_passable: {
    properties: properties(
      'sprite_passable',
      'Sprites pass through it from every side, Mario cannot.',
    ),
    slots: {
      spriteTop: [actAs(AIR)],
      spriteBottom: [actAs(AIR)],
      spriteLeft: [actAs(AIR)],
    },
    slotLinks: { spriteRight: 'spriteLeft' },
  },
  // Mario is only stopped by the top when he really stands on it (not rising, not grazing the
  // corner from the side), which is what lets him jump up through it.
  one_way: {
    properties: properties(
      'one_way',
      'A platform that is solid from above only: Mario and sprites stand on it, and pass it from below and from the sides.',
    ),
    slots: {
      marioTop: [when(piece('c_really_on_top'), [actAs(SOLID)], [actAs(AIR)])],
      marioBottom: [actAs(AIR)],
      marioLeft: [actAs(AIR)],
      marioInside: [actAs(AIR)],
      spriteTop: [actAs(SOLID)],
      spriteBottom: [actAs(AIR)],
      spriteLeft: [actAs(AIR)],
    },
    slotLinks: { marioRight: 'marioLeft', spriteRight: 'spriteLeft' },
  },
  // The same Piece in every Slot: "away from the block" is worked out from the Slot.
  boost_away: {
    properties: properties(
      'boost_away',
      'Pushes Mario away from the side he touches it from: up from the top, down from the bottom, sideways from the sides.',
    ),
    slots: {
      marioTop: [boostAway()],
      marioBottom: [boostAway()],
      marioLeft: [boostAway()],
    },
    slotLinks: { marioRight: 'marioLeft' },
  },
  // A green shell (Lunar Magic number DA) in the kicked state, up and to the right.
  kicked_shell_spawner: {
    properties: properties(
      'kicked_shell_spawner',
      'Hit it from below: a green shell shoots off up and to the right, and the block becomes a used block.',
    ),
    slots: {
      marioBottom: [
        action('spawn_sprite', {
          custom: false,
          sprite_number: 0xda,
          position: 'above',
          state: 0x0a,
          x_speed: 32,
          y_speed: -48,
          facing: 'right',
        }),
        action('change_to_tile', { tile: USED_BLOCK }),
      ],
    },
  },
  coin_once: {
    properties: properties(
      'coin_once',
      'Hit it from below for a coin, and it turns into a used block.',
    ),
    slots: {
      marioBottom: [
        action('give_coins', { amount: 1 }),
        action('change_to_tile', { tile: USED_BLOCK }),
      ],
    },
  },
  // Up is pressed once per press, so the flag flips once and not every frame Mario stands there.
  water_toggle: {
    properties: properties(
      'water_toggle',
      'Stand on it and press Up to flood the level; press Up again to drain it.',
    ),
    slots: {
      marioTop: [
        when(piece('c_button', { button: 'up', mode: 'pressed' }), [
          when(
            piece('c_ram', { address: 0x85, comparison: 'equal', value: 0 }),
            [action('write_ram', { address: 0x85, value: 1 })],
            [action('write_ram', { address: 0x85, value: 0 })],
          ),
        ]),
      ],
    },
  },
  sticky_ceiling: {
    properties: properties(
      'sticky_ceiling',
      'Jump against it from below to cling to the ceiling while holding B. Release B to drop. Solid from all sides.',
    ),
    slots: {
      marioBottom: [action('stick_to_ceiling', { button: 'b' })],
    },
  },
  question_block_coin: {
    properties: properties(
      'question_block_coin',
      'Hit it from below for a coin: the block bounces like a ? block and turns into a used block.',
    ),
    slots: { marioBottom: [action('give_coins', { amount: 1 }), bounceUsed()] },
  },
  // Small Mario gets a mushroom (sprite 74), the others a fire flower (75).
  question_block_powerup: {
    properties: properties(
      'question_block_powerup',
      'Hit it from below: small Mario gets a mushroom, bigger Mario a fire flower. The block bounces and turns into a used block.',
    ),
    slots: {
      marioBottom: [
        when(
          piece('c_mario_powerup', { powerup: 0 }),
          [spawnAbove(0x74), bounceUsed()],
          [spawnAbove(0x75), bounceUsed()],
        ),
      ],
    },
  },
  // A turn block (11E) again after the bounce: only big Mario breaks it.
  brick_block: {
    properties: properties(
      'brick_block',
      'Hit it from below: small Mario makes it bounce, bigger Mario shatters it.',
    ),
    slots: {
      marioBottom: [
        when(
          piece('c_mario_powerup', { powerup: 0 }),
          [action('bounce_block', { bounce: 1, becomes: 12, direction: 0 })],
          [action('shatter', { rainbow: false })],
        ),
      ],
    },
  },
  // Landed on from above, the note block bounces down, and Mario flies up.
  note_block: {
    properties: properties(
      'note_block',
      'Land on it to bounce high: the block sinks and comes back as a note block, and Mario is thrown up.',
    ),
    slots: {
      marioTop: [
        action('bounce_block', { bounce: 2, becomes: 14, direction: 3 }),
        action('boost_mario', {
          mode: 0,
          x_direction: 'none',
          y_direction: 'up',
          y_strength: 112,
        }),
      ],
    },
  },
  toll_block: {
    properties: properties(
      'toll_block',
      'Solid until Mario has 5 coins: touching it then takes the 5 coins and removes the block.',
    ),
    slots: { marioTop: tollRule(), marioBottom: tollRule(), marioLeft: tollRule() },
    slotLinks: { marioRight: 'marioLeft' },
  },
  key_lock: {
    properties: properties(
      'key_lock',
      'Solid, until Mario touches it with a key in his hands: the key is used up and the block is gone.',
    ),
    slots: { marioTop: lockRule(), marioBottom: lockRule(), marioLeft: lockRule() },
    slotLinks: { marioRight: 'marioLeft' },
  },
  midway_block: {
    properties: properties(
      'midway_block',
      'Touch it to pass the midway point: the flag is set with the midway sound, and the block is gone.',
    ),
    slots: {
      marioTop: [action('set_midway', { state: 'set', sound: true }), action('erase_block')],
      marioBottom: [action('set_midway', { state: 'set', sound: true }), action('erase_block')],
      marioLeft: [action('set_midway', { state: 'set', sound: true }), action('erase_block')],
    },
    slotLinks: { marioRight: 'marioLeft' },
  },
  bonus_star_goal: {
    properties: properties(
      'bonus_star_goal',
      'Touch it to end the level with one more bonus star: the block shatters and the normal exit is taken.',
    ),
    slots: {
      marioTop: bonusStarGoal(),
      marioBottom: bonusStarGoal(),
      marioLeft: bonusStarGoal(),
    },
    slotLinks: { marioRight: 'marioLeft' },
  },
  yoshi_coin_gate: {
    properties: properties(
      'yoshi_coin_gate',
      'Solid until the five Yoshi coins of the level are collected, then Mario walks through it.',
    ),
    slots: {
      marioTop: yoshiCoinRule(),
      marioBottom: yoshiCoinRule(),
      marioLeft: yoshiCoinRule(),
      marioInside: yoshiCoinRule(),
    },
    slotLinks: { marioRight: 'marioLeft' },
  },
  no_yoshi: {
    properties: properties(
      'no_yoshi',
      'Yoshi does not get past it: Mario riding Yoshi who touches it loses Yoshi in a puff of smoke.',
    ),
    slots: {
      marioTop: [action('kill_yoshi', { sound: true })],
      marioBottom: [action('kill_yoshi', { sound: true })],
      marioLeft: [action('kill_yoshi', { sound: true })],
    },
    slotLinks: { marioRight: 'marioLeft' },
  },
  // Like the lava of Super Mario 64: it hurts, and throws Mario up; small Mario dies.
  lava_bounce: {
    properties: properties(
      'lava_bounce',
      'Land on it and it hurts (small Mario dies) and throws Mario high into the air.',
    ),
    slots: {
      marioTop: [
        hurt(false),
        action('boost_mario', { mode: 0, x_direction: 'none', y_direction: 'up', y_strength: 100 }),
      ],
    },
  },
};

/** One more bonus star, and the level ends through the normal exit as the block shatters. */
function bonusStarGoal(): Statement[] {
  return [
    action('add_bonus_stars', { amount: 1 }),
    action('end_level', { secret: false }),
    action('shatter', { rainbow: false }),
  ];
}

function boostAway(): Statement {
  return action('boost_mario', {
    mode: 0,
    x_direction: 'away',
    x_strength: 48,
    y_direction: 'away',
    y_strength: 96,
  });
}
