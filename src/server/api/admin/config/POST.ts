/**
 * POST /api/admin/config
 * Body: { section, patch }  — merge patch into that section
 *       { section, reset: true } — restore that section's defaults
 */
import type { Request, Response } from 'express';
import { updateSection, resetSection, type AppConfig } from '../../../lib/configStore.js';
import { appendAudit } from '../../../lib/auditLog.js';

const SECTIONS: (keyof Omit<AppConfig, 'updatedAt'>)[] = [
  'branding', 'theme', 'homepage', 'dashboardWidgets', 'notificationSettings',
  'maintenanceMode', 'featureToggles', 'exchangeRates', 'language', 'currency', 'timezone',
];

export default async function handler(req: Request, res: Response) {
  const { section, patch, reset } = req.body as { section?: string; patch?: Record<string, unknown>; reset?: boolean };
  if (!section || !SECTIONS.includes(section as keyof Omit<AppConfig, 'updatedAt'>)) {
    return res.status(400).json({ ok: false, error: `section must be one of: ${SECTIONS.join(', ')}` });
  }
  const key = section as keyof Omit<AppConfig, 'updatedAt'>;

  const config = reset === true
    ? resetSection(key)
    : updateSection(key, (patch ?? {}) as never);

  appendAudit({
    event: reset ? 'admin_config_section_reset' : 'admin_config_section_updated',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { section },
  });

  return res.json({ ok: true, section, data: config[key] });
}
