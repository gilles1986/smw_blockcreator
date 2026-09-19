// Reads the custom sprites of the PIXI folder from the settings into the editor's names. Without
// the desktop app, a PIXI folder, or a readable list.txt there are no custom sprite names, and
// the custom sprites are then picked by number as before.

import { isTauri } from '@tauri-apps/api/core';
import { parsePixiSprites } from '../core/pixi';
import { setCustomSprites } from './names';
import { getFolder } from './settings';
import { readPixiList } from './tauriProject';

export async function loadPixiSprites(): Promise<void> {
  const folder = getFolder('pixiFolder');
  let sprites: ReturnType<typeof parsePixiSprites> = [];
  if (isTauri() && folder !== undefined) {
    try {
      const text = await readPixiList(folder);
      if (text !== null) sprites = parsePixiSprites(text);
    } catch {
      // Unreadable: no names, the Settings dialog says whether the folder is the right one.
    }
  }
  setCustomSprites(sprites);
}
