import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    environment: 'node',
    globals: true,
  },
});
