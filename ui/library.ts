// The built-in Library, bundled by Vite from the repo's library/ folder (the user Library is
// loaded from disk later, ticket 16).

import { loadLibrary, type Library } from '../core/library';

const files = import.meta.glob('/library/**/*.{json,asm}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const builtInLibrary: Library = loadLibrary(
  Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path.replace(/^\/library\//, ''), text]),
  ),
  'builtin',
);

if (builtInLibrary.errors.length > 0) {
  console.error('Built-in Library errors', builtInLibrary.errors);
}
