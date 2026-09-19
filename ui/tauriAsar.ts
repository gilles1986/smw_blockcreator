// Asar checks in the desktop app (ADR 4): the Rust commands in src-tauri/src/asar.rs load the
// GPS project's own asar.dll. Until projects exist (ticket 10) the GPS folder is asked for once
// and remembered in this browser profile.

import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { AsarReport, AsarRunner } from '../core/assemble';

const REMEMBERED = 'blockcreator.gpsFolder';

export interface GpsAsar {
  /** Routine names of the GPS project, for the check harness. */
  routines(): Promise<string[]>;
  run: AsarRunner;
}

/** The remembered GPS folder, or undefined; storage may be unavailable. */
function rememberedFolder(): string | undefined {
  try {
    return localStorage.getItem(REMEMBERED) ?? undefined;
  } catch {
    return undefined;
  }
}

function remember(folder: string): void {
  try {
    localStorage.setItem(REMEMBERED, folder);
  } catch {
    // Not remembered: the next check asks again.
  }
}

async function folderOk(folder: string): Promise<boolean> {
  return invoke<boolean>('gps_folder_ok', { gpsFolder: folder });
}

/**
 * Asar of the GPS project: the remembered folder if it still has asar.dll and defines.asm,
 * else the one the user picks. No `asar` outside the desktop app, when the user cancels, or when
 * the picked folder is not a GPS folder (`message` says why, unless the user cancelled).
 */
export async function gpsAsar(): Promise<{ asar?: GpsAsar; message?: string }> {
  if (!isTauri()) return { message: 'Asar checks run in the desktop app only.' };
  let folder = rememberedFolder();
  if (folder === undefined || !(await folderOk(folder))) {
    const picked = await open({
      directory: true,
      title: 'Choose the GPS folder (with asar.dll and defines.asm)',
    });
    if (typeof picked !== 'string') return {};
    if (!(await folderOk(picked))) {
      return { message: `${picked} has no asar.dll and defines.asm.` };
    }
    folder = picked;
    remember(folder);
  }
  const gpsFolder = folder;
  return {
    asar: {
      routines: () => invoke<string[]>('gps_routines', { gpsFolder }),
      run: (files, entry) => invoke<AsarReport>('asar_check', { gpsFolder, files, entry }),
    },
  };
}
