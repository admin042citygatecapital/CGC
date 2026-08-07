/**
 * POST /api/admin/security/ip-lists
 * Actions: add_blacklist | remove_blacklist | add_whitelist | remove_whitelist
 *          add_country | remove_country | set_vpn_mode
 */
import type { Request, Response } from 'express';
import {
  addToBlacklist, removeFromBlacklist,
  addToWhitelist, removeFromWhitelist,
  readIpLists, writeIpLists,
} from '../../../../lib/securityStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { action, ip, note, code, name, mode } =
      req.body as { action: string; ip?: string; note?: string; code?: string; name?: string; mode?: string };
    const adminEmail = (req as unknown as { admin?: { email: string } }).admin?.email ?? 'admin';

    switch (action) {
      case 'add_blacklist':
        if (!ip) return res.status(400).json({ error: 'ip required' });
        return res.json({ ok: true, lists: addToBlacklist(ip, note ?? '', adminEmail) });

      case 'remove_blacklist':
        if (!ip) return res.status(400).json({ error: 'ip required' });
        return res.json({ ok: true, lists: removeFromBlacklist(ip) });

      case 'add_whitelist':
        if (!ip) return res.status(400).json({ error: 'ip required' });
        return res.json({ ok: true, lists: addToWhitelist(ip, note ?? '', adminEmail) });

      case 'remove_whitelist':
        if (!ip) return res.status(400).json({ error: 'ip required' });
        return res.json({ ok: true, lists: removeFromWhitelist(ip) });

      case 'add_country': {
        if (!code || !name) return res.status(400).json({ error: 'code and name required' });
        const lists = readIpLists();
        if (!lists.countryBlocks.find(c => c.code === code)) {
          lists.countryBlocks.push({ code, name, blockedAt: new Date().toISOString(), addedBy: adminEmail });
          writeIpLists(lists);
        }
        return res.json({ ok: true, lists });
      }

      case 'remove_country': {
        if (!code) return res.status(400).json({ error: 'code required' });
        const lists = readIpLists();
        lists.countryBlocks = lists.countryBlocks.filter(c => c.code !== code);
        writeIpLists(lists);
        return res.json({ ok: true, lists });
      }

      case 'set_vpn_mode': {
        if (!mode || !['off', 'flag', 'block'].includes(mode)) return res.status(400).json({ error: 'mode must be off|flag|block' });
        const lists = readIpLists();
        lists.vpnDetection = mode as 'off' | 'flag' | 'block';
        writeIpLists(lists);
        return res.json({ ok: true, lists });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    res.status(500).json({ error: 'IP list operation failed', message: String(err) });
  }
}
