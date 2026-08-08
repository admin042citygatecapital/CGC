/**
 * GET /api/settings/preview
 * Public, read-only projection of the admin-managed product-preview notice.
 * Operational platform mode remains server-controlled.
 */
import type { Request, Response } from 'express';
import { resolvePreviewNoticeSettings } from '../../../../lib/previewNotice.js';
import { isPreviewMode } from '../../../lib/platformMode.js';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';

export default function handler(_req: Request, res: Response) {
  const notice = resolvePreviewNoticeSettings(readWebsiteSettings(), isPreviewMode);
  return res
    .set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30')
    .json({ ok: true, data: notice });
}
