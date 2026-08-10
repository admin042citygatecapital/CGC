import type { Request, Response } from 'express';
import { getFaq } from '../../../../lib/smartsuppStore.js';

export default function handler(req: Request, res: Response) {
  const { category } = req.query as Record<string, string>;
  res.json({ faq: getFaq({ category }), dataClassification: 'preview_support_knowledge_base' });
}
