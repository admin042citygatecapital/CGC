import type { NextFunction, Request, Response } from 'express';
import { readSecurityIpLists, validateIpAddress } from './securityConfigStore.js';

/** Enforce administrator-managed IP and country blocks on authentication surfaces. */
export async function enforceSecurityNetworkPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lists = await readSecurityIpLists();
    let requestIp = '';
    try { requestIp = validateIpAddress(req.ip ?? req.socket.remoteAddress ?? ''); }
    catch {
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ error: 'Security validation is temporarily unavailable' });
        return;
      }
      next();
      return;
    }

    const explicitlyAllowed = lists.whitelist.some(entry => entry.ip === requestIp);
    const blockedByIp = !explicitlyAllowed && lists.blacklist.some(entry => entry.ip === requestIp);
    const countryCode = String(req.get('cf-ipcountry') ?? '').trim().toUpperCase();
    const blockedByCountry = !explicitlyAllowed && /^[A-Z]{2}$/.test(countryCode)
      && lists.countryBlocks.some(entry => entry.code === countryCode);
    if (blockedByIp || blockedByCountry) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'security-network-policy',
        event: 'security.network_request_blocked',
        requestId: res.getHeader('X-Request-ID') ?? undefined,
        route: req.originalUrl,
        ip: requestIp,
        country: countryCode || undefined,
        reason: blockedByIp ? 'ip_blocklist' : 'country_blocklist',
      }));
      res.status(403).json({ error: 'Access is not permitted from this network' });
      return;
    }
    next();
  } catch {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'Security validation is temporarily unavailable' });
      return;
    }
    next();
  }
}
