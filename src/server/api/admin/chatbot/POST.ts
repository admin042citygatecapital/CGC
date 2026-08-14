import type { Request, Response } from 'express';
import { writeChatbotConfig } from '../../../lib/chatbotStore.js';
import { appendCriticalAudit } from '../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { config } = req.body;
  if (!config || typeof config !== 'object') return res.status(400).json({ error: 'config required' });
  const adminId = req.adminSession?.adminId ?? 'admin';
  await appendCriticalAudit({ event: 'admin_chatbot_settings_updated', adminId, ip: req.ip, meta: { fields: Object.keys(config) } });
  await writeChatbotConfig(config, adminId);
  res.json({ ok: true });
}
