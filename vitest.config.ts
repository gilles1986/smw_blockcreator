import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['core/**/*.test.ts', 'ui/**/*.test.ts'],
    environment: 'node',
  },
});
