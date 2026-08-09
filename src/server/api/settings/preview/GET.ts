/**
 * GET /api/settings/preview
 * Public, read-only projection of the admin-managed product-preview notice.
 * Operational platform mode remains server-controlled.
 */
import type { Request, Response } from 'express';
import { resolvePreviewNoticeSettings } from '../../../../lib/previewNotice.js';
import { hasLiveFinancialReadiness, isPreviewMode } from '../../../lib/platformMode.js';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';

export default function handler(_req: Request, res: Response) {
  // The disclosure remains visible unless the deployment is both explicitly
  // live and backed by implemented, approved financial-provider adapters.
  const disclosureRequired = isPreviewMode || !hasLiveFinancialReadiness();
  const notice = resolvePreviewNoticeSettings(readWebsiteSettings(), disclosureRequired);
  return res
    .set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30')
    .json({ ok: true, data: notice });
}
