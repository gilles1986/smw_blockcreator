// Test support: reads the real built-in Library folder with node:fs (the app reads it via Tauri).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadLibrary, type Library } from '../library';

const libraryDir = join(import.meta.dirname, '..', '..', 'library');

function readFolder(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else files[relative(dir, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(dir);
  return files;
}

export function builtInLibrary(): Library {
  return loadLibrary(readFolder(libraryDir), 'builtin');
}
