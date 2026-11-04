import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    isolate: false,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    testTimeout: 30000,
  },
});
