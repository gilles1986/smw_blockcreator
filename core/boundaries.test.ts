import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// core/ is framework-free: no UI framework, no Tauri, no Blockly, no DOM.
const FORBIDDEN = [/^react(-dom)?(\/|$)/, /^@tauri-apps\//, /^blockly(\/|$)/, /^\.\.\/ui(\/|$)/];

const coreDir = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

function importsOf(source: string): string[] {
  const specifiers = source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g);
  return [...specifiers].map((m) => m[1]!);
}

describe('core', () => {
  const files = sourceFiles(coreDir);

  it('has source modules', () => {
    expect(files.map((f) => relative(coreDir, f))).toContain('index.ts');
  });

  it('imports no UI framework, Tauri or Blockly code', () => {
    const violations = files.flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((spec) => FORBIDDEN.some((re) => re.test(spec)))
        .map((spec) => `${relative(coreDir, file)} imports ${spec}`),
    );
    expect(violations).toEqual([]);
  });
});
