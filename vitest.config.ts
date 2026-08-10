import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Server-store tests load mocked persistence modules. Keep worker startup
    // deterministic on constrained CI runners instead of timing out while
    // several jsdom workers initialise at once.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.js',
        '*.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      'virtual:format-overrides': path.resolve(__dirname, './src/test/format-overrides-module.ts'),
      '@airo/content': path.resolve(__dirname, './content-lib/src/index.ts'),
      '@/': path.resolve(__dirname, './src/'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/api': path.resolve(__dirname, './src/server/api'),
      '@/db': path.resolve(__dirname, './src/server/db'),
      '@/layouts': path.resolve(__dirname, './src/layouts'),
      '@/patterns': path.resolve(__dirname, './src/patterns'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
  },
});
