// The desktop app's side of the GPS and PIXI folders: folder dialogs, the checks that a folder is
// the right one, and file access inside the GPS folder (src-tauri/src/project.rs).

import { invoke } from '@tauri-apps/api/core';
import { confirm, open } from '@tauri-apps/plugin-dialog';
import type { ProjectFiles } from './projectSave';

/** Whether a folder has the asar.dll and defines.asm of a GPS folder. */
export const gpsFolderOk = (gpsFolder: string) => invoke<boolean>('gps_folder_ok', { gpsFolder });

/** Whether a folder has PIXI and its list.txt. */
export const pixiFolderOk = (pixiFolder: string) =>
  invoke<boolean>('pixi_folder_ok', { pixiFolder });

/** The text of a PIXI folder's list.txt; null when it has none. */
export const readPixiList = (pixiFolder: string) =>
  invoke<string | null>('pixi_read_list', { pixiFolder });

/** A native "choose folder" dialog; undefined when cancelled. */
export async function pickFolder(title: string): Promise<string | undefined> {
  const picked = await open({ directory: true, title });
  return typeof picked === 'string' ? picked : undefined;
}

/** File access inside a GPS folder, for paths relative to it. */
export function projectFiles(gpsFolder: string): ProjectFiles {
  return {
    read: (path) => invoke<string | null>('project_read', { gpsFolder, path }),
    write: (path, text) => invoke<void>('project_write', { gpsFolder, path, text }),
    confirm: (message) => confirm(message, { title: 'BlockCreator', kind: 'warning' }),
  };
}
