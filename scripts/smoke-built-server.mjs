import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const port = process.env.SMOKE_PORT || '5180';
const origin = `http://127.0.0.1:${port}`;
const smokeRoot = mkdtempSync(join(tmpdir(), 'cgc-smoke-'));
const privateDataRoot = join(smokeRoot, 'private');
const mediaAssetRoot = join(smokeRoot, 'public-assets');
mkdirSync(privateDataRoot, { recursive: true });
mkdirSync(mediaAssetRoot, { recursive: true });
const child = spawn(process.execPath, ['dist/server.bundle.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: port,
    PRIVATE_DATA_ROOT: privateDataRoot,
    MEDIA_ASSET_ROOT: mediaAssetRoot,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

const deadline = Date.now() + 20_000;
let response;

try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}.\n${output}`);
    try {
      response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) break;
    } catch {
      // The server may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  if (!response?.ok) throw new Error(`Health check did not become ready.\n${output}`);
  const body = await response.json();
  const robots = response.headers.get('x-robots-tag');
  if (!robots?.includes('noindex')) throw new Error('Preview server did not emit the required X-Robots-Tag header.');
  const page = await fetch(`${origin}/login`);
  const html = await page.text();
  if (!page.ok) {
    throw new Error(`Server-rendered login page failed (status ${page.status}).\n${output}`);
  }
  if (html.includes('City Gate Capital is not operating as a bank in this environment')) {
    throw new Error(`The removed product-preview banner is still present on the login page.\n${output}`);
  }
  const dashboard = await fetch(`${origin}/dashboard/trading`);
  const dashboardHtml = await dashboard.text();
  if (
    !dashboard.ok ||
    dashboardHtml.includes('<!--$!-->') ||
    dashboardHtml.includes('Switched to client rendering')
  ) {
    throw new Error('A lazy dashboard route did not finish rendering on the server.');
  }
  const hero = await fetch(`${origin}/airo-assets/uploads/pages-home-hero-e6ece0b6.jpg`);
  if (!hero.ok || !hero.headers.get('content-type')?.startsWith('image/')) {
    throw new Error('Production media middleware did not serve the local hero asset.');
  }
  const logo = await fetch(`${origin}/assets/brand/city-gate-capital-seal.png`);
  if (!logo.ok || !logo.headers.get('content-type')?.startsWith('image/png')) {
    throw new Error('Bundled City Gate Capital logo is missing from the production build.');
  }
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/market`);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('Market WebSocket did not connect during the smoke test.'));
    }, 3_000);
    socket.once('open', () => {
      clearTimeout(timer);
      socket.terminate();
      resolve();
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  if (child.exitCode !== null) throw new Error(`Server exited after a WebSocket frame with code ${child.exitCode}.\n${output}`);
  console.log(JSON.stringify({
    ok: true,
    status: response.status,
    previewBannerRemoved: true,
    streamingSsr: true,
    noIndex: true,
    mediaAssets: true,
    marketWebSocket: true,
    health: body,
  }));
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2_000)),
    ]);
  }
  rmSync(smokeRoot, { recursive: true, force: true });
}
