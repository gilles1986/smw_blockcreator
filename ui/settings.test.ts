import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecentFile,
  clearRecentFiles,
  getAsmOpen,
  getPiecesLocation,
  getRecentFiles,
  removeRecentFile,
  setAsmOpen,
  setPiecesLocation,
} from './settings';

/** A local storage that lives in a Map. */
function fakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('settings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('looks for the user Pieces in the app data folder until the user chooses otherwise', () => {
    expect(getPiecesLocation()).toBe('appData');
    setPiecesLocation('exe');
    expect(getPiecesLocation()).toBe('exe');
    setPiecesLocation('appData');
    expect(getPiecesLocation()).toBe('appData');
  });

  it('takes anything but "exe" for the app data folder', () => {
    localStorage.setItem('blockcreator.piecesLocation', 'somewhere');
    expect(getPiecesLocation()).toBe('appData');
  });

  it('keeps the ASM pane open unless the user folded it away', () => {
    expect(getAsmOpen()).toBe(true);
    setAsmOpen(false);
    expect(getAsmOpen()).toBe(false);
    setAsmOpen(true);
    expect(getAsmOpen()).toBe(true);
  });

  it('manages the list of 5 recent files in MRU order', () => {
    expect(getRecentFiles()).toEqual([]);

    addRecentFile('C:\\games\\blocks\\block1.asm');
    expect(getRecentFiles()).toEqual([
      { path: 'C:\\games\\blocks\\block1.asm', name: 'block1.asm' },
    ]);

    addRecentFile('C:\\games\\blocks\\block2.asm');
    addRecentFile('C:\\games\\blocks\\block3.asm');
    addRecentFile('C:\\games\\blocks\\block4.asm');
    addRecentFile('C:\\games\\blocks\\block5.asm');
    expect(getRecentFiles().map((f) => f.name)).toEqual([
      'block5.asm',
      'block4.asm',
      'block3.asm',
      'block2.asm',
      'block1.asm',
    ]);

    // Adding a 6th file pushes out the oldest (block1.asm)
    addRecentFile('C:\\games\\blocks\\block6.asm');
    expect(getRecentFiles().map((f) => f.name)).toEqual([
      'block6.asm',
      'block5.asm',
      'block4.asm',
      'block3.asm',
      'block2.asm',
    ]);

    // Opening an existing file bumps it to the top
    addRecentFile('C:\\games\\blocks\\block3.asm');
    expect(getRecentFiles().map((f) => f.name)).toEqual([
      'block3.asm',
      'block6.asm',
      'block5.asm',
      'block4.asm',
      'block2.asm',
    ]);

    // Removing a file removes it from the list
    removeRecentFile('C:\\games\\blocks\\block6.asm');
    expect(getRecentFiles().map((f) => f.name)).toEqual([
      'block3.asm',
      'block5.asm',
      'block4.asm',
      'block2.asm',
    ]);
    // Clearing removes all files
    clearRecentFiles();
    expect(getRecentFiles()).toEqual([]);
  });

  it('falls back to the defaults when the storage cannot be used', () => {
    const broken = () => {
      throw new Error('storage is blocked');
    };
    vi.stubGlobal('localStorage', { getItem: broken, setItem: broken, removeItem: broken });
    expect(getPiecesLocation()).toBe('appData');
    expect(getAsmOpen()).toBe(true);
    expect(getRecentFiles()).toEqual([]);
    expect(() => setPiecesLocation('exe')).not.toThrow();
    expect(() => setAsmOpen(false)).not.toThrow();
    expect(() => addRecentFile('C:\\test.asm')).not.toThrow();
    expect(() => removeRecentFile('C:\\test.asm')).not.toThrow();
    expect(() => clearRecentFiles()).not.toThrow();
  });
});

