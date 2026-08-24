import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['node_modules/**', '.claude/**'],
    setupFiles: ['./src/test-setup-heritage-journey-city-cookies.ts'],
  },
});
