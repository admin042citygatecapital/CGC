/** POST /api/admin/security/ip-lists — update durable network-security controls. */
import type { Request, Response } from 'express';
import { appendCriticalAudit } from '../../../../lib/auditLog.js';
import {
  readSecurityIpLists,
  validateIpAddress,
  writeSecurityIpLists,
  type IpLists,
} from '../../../../lib/securityConfigStore.js';

type Action = 'add_blacklist' | 'remove_blacklist' | 'add_whitelist' | 'remove_whitelist'
  | 'add_country' | 'remove_country' | 'set_vpn_mode';

const actions = new Set<Action>([
  'add_blacklist', 'remove_blacklist', 'add_whitelist', 'remove_whitelist',
  'add_country', 'remove_country', 'set_vpn_mode',
]);

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  try {
    const body = req.body as Record<string, unknown>;
    const action = String(body?.action ?? '') as Action;
    if (!actions.has(action)) return res.status(400).json({ error: 'A valid security action is required' });

    const previous = await readSecurityIpLists();
    const next: IpLists = {
      ...previous,
      blacklist: [...previous.blacklist],
      whitelist: [...previous.whitelist],
      countryBlocks: [...previous.countryBlocks],
      updatedAt: new Date().toISOString(),
    };
    const note = String(body.note ?? '').trim().slice(0, 200);

    if (action.includes('blacklist') || action.includes('whitelist')) {
      let ip: string;
      try { ip = validateIpAddress(body.ip); }
      catch { return res.status(400).json({ error: 'A valid IPv4 or IPv6 address is required' }); }
      if (action === 'add_blacklist') {
        if (next.whitelist.some(entry => entry.ip === ip)) return res.status(409).json({ error: 'Remove this address from the allowlist before blocking it' });
        if (!next.blacklist.some(entry => entry.ip === ip)) next.blacklist.push({ ip, note: note || undefined, addedBy: session.email, addedAt: new Date().toISOString() });
      } else if (action === 'remove_blacklist') {
        next.blacklist = next.blacklist.filter(entry => entry.ip !== ip);
      } else if (action === 'add_whitelist') {
        if (next.blacklist.some(entry => entry.ip === ip)) return res.status(409).json({ error: 'Remove this address from the blocklist before allowing it' });
        if (!next.whitelist.some(entry => entry.ip === ip)) next.whitelist.push({ ip, note: note || undefined, addedBy: session.email, addedAt: new Date().toISOString() });
      } else {
        next.whitelist = next.whitelist.filter(entry => entry.ip !== ip);
      }
    } else if (action === 'add_country') {
      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!/^[A-Z]{2}$/.test(code) || name.length < 2 || name.length > 80) return res.status(400).json({ error: 'A valid ISO country code and name are required' });
      if (!next.countryBlocks.some(entry => entry.code === code)) next.countryBlocks.push({ code, name, blockedAt: new Date().toISOString(), addedBy: session.email });
    } else if (action === 'remove_country') {
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) return res.status(400).json({ error: 'A valid ISO country code is required' });
      next.countryBlocks = next.countryBlocks.filter(entry => entry.code !== code);
    } else {
      const mode = String(body.mode ?? '');
      if (!['off', 'flag', 'block'].includes(mode)) return res.status(400).json({ error: 'VPN mode must be off, flag, or block' });
      next.vpnDetection = mode as IpLists['vpnDetection'];
    }

    await appendCriticalAudit({
      event: 'admin_security_network_policy_change_authorized',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      reason: note || `Security control action: ${action}`,
      meta: {
        action,
        previousCounts: { blacklist: previous.blacklist.length, whitelist: previous.whitelist.length, countries: previous.countryBlocks.length },
        resultingCounts: { blacklist: next.blacklist.length, whitelist: next.whitelist.length, countries: next.countryBlocks.length },
        previousVpnMode: previous.vpnDetection,
        resultingVpnMode: next.vpnDetection,
      },
    });
    const lists = await writeSecurityIpLists(next, session.adminId);
    return res.json({ ok: true, lists });
  } catch {
    return res.status(503).json({ error: 'Security configuration could not be updated' });
  }
}
