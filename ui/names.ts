// The names the editor shows for sprite and sound numbers: the built-in ones plus the custom
// sprites read from the PIXI folder. Whoever loads the PIXI list hands it in here; the editor
// listens and shows the names again.

import { BUILT_IN_NAMES, type NameSource, type NamedNumber } from '../core/names';

let customSprites: readonly NamedNumber[] = [];
const listeners = new Set<() => void>();

export const nameSource: NameSource = {
  sprites: (custom) => (custom ? customSprites : BUILT_IN_NAMES.sprites(false)),
  sounds: (port) => BUILT_IN_NAMES.sounds(port),
};

export function setCustomSprites(sprites: readonly NamedNumber[]): void {
  customSprites = sprites;
  for (const listener of listeners) listener();
}

/** Calls `listener` whenever the names change; returns the function that stops that. */
export function onNamesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
