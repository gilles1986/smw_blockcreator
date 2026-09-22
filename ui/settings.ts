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

/**
 * Where the folder of the user's own Pieces is: in the app's data folder (`appData`, where they
 * have always been) or next to BlockCreator.exe (`exe`), so they travel with the program.
 */
export type PiecesLocation = 'appData' | 'exe';

const PIECES_LOCATION_KEY = 'blockcreator.piecesLocation';

export function getPiecesLocation(): PiecesLocation {
  try {
    return localStorage.getItem(PIECES_LOCATION_KEY) === 'exe' ? 'exe' : 'appData';
  } catch {
    return 'appData';
  }
}

/** Remembers where the user's Pieces are. */
export function setPiecesLocation(location: PiecesLocation): void {
  try {
    localStorage.setItem(PIECES_LOCATION_KEY, location);
  } catch {
    // Not remembered: the Pieces are looked for in the app's data folder next time.
  }
}

const ASM_OPEN_KEY = 'blockcreator.asmOpen';

/** Whether the ASM pane is open; it is, unless the user has folded it away. */
export function getAsmOpen(): boolean {
  try {
    return localStorage.getItem(ASM_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Remembers whether the ASM pane is open. */
export function setAsmOpen(open: boolean): void {
  try {
    localStorage.setItem(ASM_OPEN_KEY, String(open));
  } catch {
    // Not remembered: the pane opens again next time.
  }
}

// ---- Recent files (desktop only, up to 5 entries) ----------------------------------------

const RECENT_FILES_KEY = 'blockcreator.recentFiles';
const MAX_RECENT = 5;

export interface RecentFile {
  /** Absolute file path on disk. */
  path: string;
  /** Just the file name (last segment), for display. */
  name: string;
}

/**
 * Returns the most-recently-opened file paths, newest first. Paths that no longer exist are not
 * pruned here (checking the file system is async); they are pruned when the user opens one.
 */
export function getRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentFile =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentFile).path === 'string' &&
        typeof (entry as RecentFile).name === 'string',
    );
  } catch {
    return [];
  }
}

/** Puts `path` at the top of the recent list, pushing older entries out past `MAX_RECENT`. */
export function addRecentFile(path: string): void {
  try {
    const name = path.replace(/\\/g, '/').split('/').pop() ?? path;
    const list = getRecentFiles().filter((entry) => entry.path !== path);
    list.unshift({ path, name });
    if (list.length > MAX_RECENT) list.length = MAX_RECENT;
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list));
  } catch {
    // Not remembered.
  }
}

/** Removes a single path from the recent list (e.g. when the file no longer exists). */
export function removeRecentFile(path: string): void {
  try {
    const list = getRecentFiles().filter((entry) => entry.path !== path);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list));
  } catch {
    // Not remembered.
  }
}

/** Clears all recent files. */
export function clearRecentFiles(): void {
  try {
    localStorage.removeItem(RECENT_FILES_KEY);
  } catch {
    // Not remembered.
  }
}

