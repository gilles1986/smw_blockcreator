import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAsmOpen, getPiecesLocation, setAsmOpen, setPiecesLocation } from './settings';

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

  it('falls back to the defaults when the storage cannot be used', () => {
    const broken = () => {
      throw new Error('storage is blocked');
    };
    vi.stubGlobal('localStorage', { getItem: broken, setItem: broken, removeItem: broken });
    expect(getPiecesLocation()).toBe('appData');
    expect(getAsmOpen()).toBe(true);
    expect(() => setPiecesLocation('exe')).not.toThrow();
    expect(() => setAsmOpen(false)).not.toThrow();
  });
});
