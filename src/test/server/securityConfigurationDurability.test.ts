import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readSecurityIpLists, validateIpAddress } = vi.hoisted(() => ({
  readSecurityIpLists: vi.fn(),
  validateIpAddress: vi.fn((value: string) => value.replace(/^::ffff:/, '')),
}));

vi.mock('../../server/lib/securityConfigStore.js', () => ({
  readSecurityIpLists,
  validateIpAddress,
}));

import { enforceSecurityNetworkPolicy } from '../../server/lib/securityNetworkPolicyMiddleware.js';

function responseDouble() {
  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    status: vi.fn((status: number) => { response.statusCode = status; return response; }),
    json: vi.fn((payload: unknown) => { response.payload = payload; return response; }),
    getHeader: vi.fn(() => 'req-test'),
  };
  return response;
}

describe('durable security configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('routes IP and 2FA administration through PostgreSQL-backed documents', () => {
    const files = [
      'src/server/api/admin/security/ip-lists/GET.ts',
      'src/server/api/admin/security/ip-lists/POST.ts',
      'src/server/api/admin/security/two-fa/GET.ts',
      'src/server/api/admin/security/two-fa/POST.ts',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('securityConfigStore.js');
      expect(source, file).not.toContain('securityStore.js');
    }
    const store = readFileSync('src/server/lib/securityConfigStore.ts', 'utf8');
    expect(store).toContain("const IP_LISTS_KEY = 'security_ip_lists'");
    expect(store).toContain("const TWO_FACTOR_KEY = 'security_two_factor_policy'");
    expect(store).toContain('readConfigDocument');
    expect(store).toContain('writeConfigDocument');
  });

  it('blocks a listed network before protected routes execute', async () => {
    readSecurityIpLists.mockResolvedValue({
      blacklist: [{ ip: '203.0.113.8', addedAt: new Date().toISOString() }],
      whitelist: [], countryBlocks: [], vpnDetection: 'flag', updatedAt: new Date().toISOString(),
    });
    const response = responseDouble();
    const next = vi.fn();
    await enforceSecurityNetworkPolicy({
      ip: '203.0.113.8', socket: { remoteAddress: '203.0.113.8' },
      get: vi.fn(() => undefined), originalUrl: '/api/admin/auth/login',
    } as never, response as never, next);
    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets an explicit allowlist entry override a block', async () => {
    readSecurityIpLists.mockResolvedValue({
      blacklist: [{ ip: '203.0.113.8', addedAt: new Date().toISOString() }],
      whitelist: [{ ip: '203.0.113.8', addedAt: new Date().toISOString() }],
      countryBlocks: [], vpnDetection: 'flag', updatedAt: new Date().toISOString(),
    });
    const response = responseDouble();
    const next = vi.fn();
    await enforceSecurityNetworkPolicy({
      ip: '203.0.113.8', socket: { remoteAddress: '203.0.113.8' },
      get: vi.fn(() => undefined), originalUrl: '/api/users/login',
    } as never, response as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('registers network enforcement before administration authentication', () => {
    const entry = readFileSync('src/server/entry.ts', 'utf8');
    expect(entry.indexOf("app.use(['/api/admin', '/api/users'], enforceSecurityNetworkPolicy)"))
      .toBeLessThan(entry.indexOf("app.use('/api/admin', (req: Request"));
  });
});
