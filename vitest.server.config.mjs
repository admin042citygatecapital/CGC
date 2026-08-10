import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 20_000,
  },
});
