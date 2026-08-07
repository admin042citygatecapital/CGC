import type { Request, Response } from 'express';
import { writeChatbotConfig } from '../../../lib/chatbotStore.js';

export default function handler(req: Request, res: Response) {
  const { config } = req.body;
  if (!config || typeof config !== 'object') return res.status(400).json({ error: 'config required' });
  writeChatbotConfig(config);
  res.json({ ok: true });
}
