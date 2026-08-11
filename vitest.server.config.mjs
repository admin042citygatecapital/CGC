import { defineConfig } from 'vitest/config';
import { contentPlugin } from './export-plugins/content-plugin/index.ts';

export default defineConfig({
  plugins: [contentPlugin()],
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
