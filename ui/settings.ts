// Where the user's projects are: chosen once in the settings dialog and remembered in this
// WebView's local storage (storage may be unavailable, then the next use asks again).

export type FolderSetting = 'gpsFolder' | 'pixiFolder';

/** `gpsFolder` keeps the key the Asar check has always remembered its folder under. */
const key = (setting: FolderSetting) => `blockcreator.${setting}`;

export function getFolder(setting: FolderSetting): string | undefined {
  try {
    return localStorage.getItem(key(setting)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remembers a folder, or forgets it when `folder` is undefined. */
export function setFolder(setting: FolderSetting, folder: string | undefined): void {
  try {
    if (folder === undefined) localStorage.removeItem(key(setting));
    else localStorage.setItem(key(setting), folder);
  } catch {
    // Not remembered: the next use asks again.
  }
}
