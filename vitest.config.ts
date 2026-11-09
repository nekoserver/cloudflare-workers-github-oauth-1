import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Several DOM integration tests render the data-heavy heritage and airline
    // pages.  Five seconds is no longer enough on a contended CI worker even
    // though the same assertions complete successfully in isolation.
    testTimeout: 20_000,
    // scripts/*.test.mjs は node:test で書かれている(vitestのテストではない)。npm run test:node で実行する。
    exclude: ['node_modules/**', '.claude/**', 'scripts/**/*.test.mjs'],
  },
});
