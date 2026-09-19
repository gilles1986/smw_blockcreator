// Names for the numbers a Piece asks for: sprite numbers (vanilla and PIXI custom) and the sound
// effects of an SPC700 port. A number with no name stays usable, it is just shown without one.

import { SOUND_NAMES } from './sounds';
import { VANILLA_SPRITE_NAMES } from './sprites';

export interface NamedNumber {
  id: number;
  name: string;
}

/** Where a name field gets its names from; the app adds the custom sprites of the PIXI folder. */
export interface NameSource {
  /** Sprites with a name: the vanilla ones, or (`custom`) those of the project's PIXI list. */
  sprites(custom: boolean): readonly NamedNumber[];
  /** The sound effects of a port such as `$1DF9`; empty for a port that is not known. */
  sounds(port: string): readonly NamedNumber[];
}

export const VANILLA_SPRITES: readonly NamedNumber[] = VANILLA_SPRITE_NAMES.map((name, id) => ({
  id,
  name,
}));

export function soundsOf(port: string): readonly NamedNumber[] {
  return (SOUND_NAMES[port] ?? []).map(([id, name]) => ({ id, name }));
}

/**
 * The shells as Lunar Magic lists them, level sprite DA–DD and DF. The game loads level sprite
 * `n` ≥ DA as sprite `n − DA + 4` in status 09, a shell lying on the ground (SMWDisX, bank_02.asm,
 * sprite loading: "SUBTRACT DA, FIRST SHELL SPRITE"): DA–DD are the green, red, blue and yellow
 * Koopa (04–07). DF is sprite 09, a shell that takes two bounces before it is stunned, and that
 * the Special World colour swap (04 → 07, 05 → 06) leaves alone. The Pieces map these numbers
 * the same way.
 */
export const LEVEL_SHELLS: readonly NamedNumber[] = [
  ...[4, 5, 6, 7].map((sprite, i) => ({
    id: 0xda + i,
    name: `${VANILLA_SPRITE_NAMES[sprite]} shell`,
  })),
  { id: 0xdf, name: "Green shell, won't use special world graphic" },
];

const VANILLA_AND_SHELLS: readonly NamedNumber[] = [...VANILLA_SPRITES, ...LEVEL_SHELLS];

/** The names the game and the built-in Library know, without any PIXI sprites. */
export const BUILT_IN_NAMES: NameSource = {
  sprites: (custom) => (custom ? [] : VANILLA_AND_SHELLS),
  sounds: soundsOf,
};

/** A number as the field text shows it: two hex digits, upper case. */
export function hexId(id: number): string {
  return id.toString(16).toUpperCase().padStart(2, '0');
}

export interface NameChoice {
  /** The number as two hex digits, the value a field holds. */
  value: string;
  /** What the dropdown shows: the number and its name, if it has one. */
  label: string;
  named: boolean;
}

/**
 * Every number 00–FF as a choice, the named ones first (in number order), then the others. A
 * field always accepts any number, also one that no list names.
 */
export function nameChoices(named: readonly NamedNumber[]): NameChoice[] {
  const names = new Map<number, string>();
  for (const { id, name } of named) if (id >= 0 && id <= 0xff) names.set(id, name);
  const choice = (id: number): NameChoice => {
    const name = names.get(id);
    return {
      value: hexId(id),
      label: name === undefined ? hexId(id) : `${hexId(id)} · ${name}`,
      named: name !== undefined,
    };
  };
  const all = Array.from({ length: 256 }, (_, id) => choice(id));
  return [...all.filter((c) => c.named), ...all.filter((c) => !c.named)];
}

/** A typed number as field text: `da`, `$DA`, `0xda` or `4` (= 04); undefined for anything else. */
export function typedNumber(query: string): string | undefined {
  const match = /^(?:\$|0x)?([0-9a-f]{1,2})$/i.exec(query.trim());
  return match ? match[1]!.toUpperCase().padStart(2, '0') : undefined;
}

/**
 * The choices a search box shows for what was typed: those whose number or name contains it. A
 * typed number (two hex digits, or one digit) comes first, so typing `DA` and Enter picks DA; a
 * single letter such as `d` only searches the names.
 */
export function filterChoices(choices: readonly NameChoice[], query: string): NameChoice[] {
  const text = query
    .trim()
    .toLowerCase()
    .replace(/^(\$|0x)/, '');
  if (text === '') return [...choices];
  const matches = choices.filter((c) => c.label.toLowerCase().includes(text));
  const number = text.length >= 2 || /^\d$/.test(text) ? typedNumber(text) : undefined;
  const exact = matches.find((c) => c.value === number);
  return exact ? [exact, ...matches.filter((c) => c !== exact)] : matches;
}
