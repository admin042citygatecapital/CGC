import type { Request, Response } from 'express';
import { readChatbotConfig } from '../../../lib/chatbotStore.js';

export default async function handler(_req: Request, res: Response) {
  res.json({ config: await readChatbotConfig() });
}
