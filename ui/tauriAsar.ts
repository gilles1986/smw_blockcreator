// Asar checks in the desktop app (ADR 4): the Rust commands in src-tauri/src/asar.rs load the
// GPS project's own asar.dll. The GPS folder is the one from the settings; until one is set, it is
// asked for the first time it is needed.

import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AsarReport, AsarRunner } from '../core/assemble';
import { getFolder, setFolder } from './settings';
import { gpsFolderOk, pickFolder } from './tauriProject';

export interface GpsAsar {
  /** Routine names of the GPS project, for the check harness. */
  routines(): Promise<string[]>;
  run: AsarRunner;
}

/**
 * The GPS folder: the remembered one if it still has asar.dll and defines.asm, else one the user
 * picks (and which is then remembered). Nothing when the user cancels or picks a folder that is
 * not a GPS folder (`message` says why, unless the user cancelled).
 */
export async function gpsFolder(): Promise<{ folder?: string; message?: string }> {
  const known = getFolder('gpsFolder');
  if (known !== undefined && (await gpsFolderOk(known))) return { folder: known };
  const picked = await pickFolder('Choose the GPS folder (with asar.dll and defines.asm)');
  if (picked === undefined) return {};
  if (!(await gpsFolderOk(picked)))
    return { message: `${picked} has no asar.dll and defines.asm.` };
  setFolder('gpsFolder', picked);
  return { folder: picked };
}

/**
 * Asar of the GPS project. No `asar` outside the desktop app, when the user cancels, or when the
 * picked folder is not a GPS folder (`message` says why, unless the user cancelled).
 */
export async function gpsAsar(): Promise<{ asar?: GpsAsar; message?: string }> {
  if (!isTauri()) return { message: 'Asar checks run in the desktop app only.' };
  const { folder, message } = await gpsFolder();
  if (folder === undefined) return message === undefined ? {} : { message };
  return {
    asar: {
      routines: () => invoke<string[]>('gps_routines', { gpsFolder: folder }),
      run: (files, entry) => invoke<AsarReport>('asar_check', { gpsFolder: folder, files, entry }),
    },
  };
}
