import type { Response } from 'express';

export const platformMode = (process.env.PLATFORM_MODE ?? 'preview').toLowerCase();
export const isPreviewMode = platformMode !== 'live';

/** Production preview deployments must never accept money-moving requests. */
export function requireFinancialOperations(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (platformMode === 'live' && process.env.ENABLE_FINANCIAL_OPERATIONS === '1') return true;
  res.status(503).json({
    error: 'Financial operations are disabled in this product-preview environment.',
    code: 'PREVIEW_MODE',
  });
  return false;
}

export function requirePaperTrading(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (process.env.ENABLE_PAPER_TRADING === '1') return true;
  res.status(503).json({
    error: 'Paper trading is disabled in this product-preview environment.',
    code: 'PREVIEW_MODE',
  });
  return false;
}
