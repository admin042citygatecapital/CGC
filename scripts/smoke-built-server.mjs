import { spawn } from 'node:child_process';

const port = process.env.SMOKE_PORT || '5180';
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/server.bundle.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: port,
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
  if (!page.ok || !html.includes('Product preview')) {
    throw new Error('Server-rendered preview disclosure is missing from the login page.');
  }
  console.log(JSON.stringify({ ok: true, status: response.status, previewDisclosure: true, noIndex: true, health: body }));
} finally {
  if (child.exitCode === null) child.kill();
}
