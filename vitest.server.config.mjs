import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { contentPlugin } from './export-plugins/content-plugin/index.ts';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  plugins: [contentPlugin()],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/server/setup.ts'],
    environment: 'node',
    globals: true,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 20_000,
  },
});
