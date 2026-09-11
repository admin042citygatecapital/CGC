import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 5191);
const defaultBaseURL = `http://127.0.0.1:${port}`;
const baseURL = process.env.BASE_URL ?? defaultBaseURL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npx tsx scripts/start-e2e-server.ts',
    url: `${baseURL}/api/health`,
    timeout: 90_000,
    reuseExistingServer: false,
    env: { E2E_PORT: String(port) },
  },
});
