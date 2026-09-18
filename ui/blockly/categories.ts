// Toolbox categories: display name, order and colour (hue) per Piece category.

/** A Blockly colour: hue (0–360) or hex string. */
export type Colour = number | string;

interface CategoryStyle {
  name: string;
  colour: Colour;
}

/** Built-in categories in toolbox order. Community categories follow, sorted by id. */
export const KNOWN_CATEGORIES: Readonly<Record<string, CategoryStyle>> = {
  conditions: { name: 'Conditions', colour: 260 },
  physics: { name: 'Physics', colour: 210 },
  damage: { name: 'Damage', colour: 0 },
  effects: { name: 'Effects', colour: 40 },
  sound: { name: 'Sound', colour: 120 },
  sprites: { name: 'Sprites', colour: 290 },
  level: { name: 'Level', colour: 170 },
  advanced: { name: 'Advanced', colour: '#5b6770' },
};

export function categoryColour(category: string): Colour {
  return KNOWN_CATEGORIES[category]?.colour ?? hueOf(category);
}

export function categoryName(category: string): string {
  const known = KNOWN_CATEGORIES[category]?.name;
  if (known) return known;
  const words = category.split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A stable hue for a community category, derived from its id. */
function hueOf(category: string): number {
  let hash = 0;
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
