import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    include: ['core/**/*.test.ts', 'ui/**/*.test.ts'],
    environment: 'node',
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
});
