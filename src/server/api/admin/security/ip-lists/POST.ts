/**
 * POST /api/admin/security/ip-lists
 * Body: { action, ...fields }
 *   action: 'add_blacklist' | 'remove_blacklist' | 'add_whitelist' |
 *           'remove_whitelist' | 'add_country_block' | 'remove_country_block' |
 *           'set_vpn_detection'
 *   add_blacklist/add_whitelist:       { ip, note? }
 *   remove_blacklist/remove_whitelist: { ip }
 *   add_country_block:                { code, name }
 *   remove_country_block:              { code }
 *   set_vpn_detection:                 { vpnDetection: 'off'|'flag'|'block' }
 */
import type { Request, Response } from 'express';
import {
  addToBlacklist, removeFromBlacklist, addToWhitelist, removeFromWhitelist,
  readIpLists, writeIpLists,
} from '../../../../lib/securityStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const ACTIONS = [
  'add_blacklist', 'remove_blacklist', 'add_whitelist', 'remove_whitelist',
  'add_country_block', 'remove_country_block', 'set_vpn_detection',
] as const;
const VPN_MODES = ['off', 'flag', 'block'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const action = isOneOf(raw.action, ACTIONS);
  if (!action) {
    return res.status(400).json({ ok: false, error: `action must be one of: ${ACTIONS.join(', ')}` });
  }

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';
  const targetIp = sanitizeString(raw.ip, 45); // IPv6 max length

  let lists;
  switch (action) {
    case 'add_blacklist': {
      if (!targetIp) return res.status(400).json({ ok: false, error: 'ip is required' });
      lists = addToBlacklist(targetIp, sanitizeString(raw.note, 500), adminEmail);
      break;
    }
    case 'remove_blacklist': {
      if (!targetIp) return res.status(400).json({ ok: false, error: 'ip is required' });
      lists = removeFromBlacklist(targetIp);
      break;
    }
    case 'add_whitelist': {
      if (!targetIp) return res.status(400).json({ ok: false, error: 'ip is required' });
      lists = addToWhitelist(targetIp, sanitizeString(raw.note, 500), adminEmail);
      break;
    }
    case 'remove_whitelist': {
      if (!targetIp) return res.status(400).json({ ok: false, error: 'ip is required' });
      lists = removeFromWhitelist(targetIp);
      break;
    }
    case 'add_country_block': {
      const code = sanitizeString(raw.code, 2).toUpperCase();
      const name = sanitizeString(raw.name, 100);
      if (!code || !name) return res.status(400).json({ ok: false, error: 'code and name are required' });
      lists = readIpLists();
      if (!lists.countryBlocks.find(c => c.code === code)) {
        lists.countryBlocks.push({ code, name, blockedAt: new Date().toISOString(), addedBy: adminEmail });
      }
      writeIpLists(lists);
      break;
    }
    case 'remove_country_block': {
      const code = sanitizeString(raw.code, 2).toUpperCase();
      if (!code) return res.status(400).json({ ok: false, error: 'code is required' });
      lists = readIpLists();
      lists.countryBlocks = lists.countryBlocks.filter(c => c.code !== code);
      writeIpLists(lists);
      break;
    }
    case 'set_vpn_detection': {
      const mode = isOneOf(raw.vpnDetection, VPN_MODES);
      if (!mode) return res.status(400).json({ ok: false, error: "vpnDetection must be 'off', 'flag', or 'block'" });
      lists = readIpLists();
      lists.vpnDetection = mode;
      writeIpLists(lists);
      break;
    }
  }

  appendAudit({ event: 'security_ip_lists_updated', adminId, email: adminEmail, ip, meta: { action } });
  return res.json({ ok: true, lists });
}
