// FileAccess for the desktop app: Tauri's dialog and fs plugins. Paths picked in a dialog are
// added to the fs scope by the dialog plugin, so no broad file permissions are needed.

import { isTauri } from '@tauri-apps/api/core';
import { confirm, open, save } from '@tauri-apps/plugin-dialog';
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { FileAccess } from './blockDocument';

const ASM_FILTER = [{ name: 'GPS block', extensions: ['asm'] }];

/** Undefined in a plain browser (`npm run dev`), where there are no native dialogs. */
export const tauriFiles: FileAccess | undefined = isTauri()
  ? {
      chooseOpenPath: async () => {
        const path = await open({ multiple: false, directory: false, filters: ASM_FILTER });
        return typeof path === 'string' ? path : null;
      },
      chooseSavePath: (suggestedName) => save({ defaultPath: suggestedName, filters: ASM_FILTER }),
      exists: (path) => exists(path),
      read: (path) => readTextFile(path),
      write: (path, text) => writeTextFile(path, text),
      confirm: (message) => confirm(message, { title: 'BlockCreator', kind: 'warning' }),
    }
  : undefined;
