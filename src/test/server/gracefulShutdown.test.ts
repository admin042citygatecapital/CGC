import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production process handover', () => {
  const entry = readFileSync('src/server/entry.ts', 'utf8');

  it('stops accepting HTTP work before closing the database pool', () => {
    const closeServer = entry.indexOf('httpServer.close((error)');
    const closeDatabase = entry.indexOf('await closeConnection()', closeServer);
    expect(closeServer).toBeGreaterThan(-1);
    expect(closeDatabase).toBeGreaterThan(closeServer);
  });

  it('drains background WebSocket timers and clients during shutdown', () => {
    expect(entry).toContain('clearInterval(wsBroadcastTimer)');
    expect(entry).toContain('clearInterval(wsCleanupTimer)');
    expect(entry).toContain("client.close(1001, 'Service restarting')");
  });

  it('uses a bounded shutdown below the Render termination window', () => {
    const render = readFileSync('render.yaml', 'utf8');
    expect(entry).toContain('}, 25_000)');
    expect(render).toContain('maxShutdownDelaySeconds: 30');
  });
});
