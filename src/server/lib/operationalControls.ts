import type { Response } from 'express';
import { getSection } from './configStore.js';

export type IntakeToggle = 'accountApplicationsEnabled' | 'contactFormsEnabled' | 'newsletterSignupEnabled' | 'supportTicketsEnabled' | 'cardRequestsEnabled';

export function requireIntakeEnabled(res: Response, toggle: IntakeToggle): boolean {
  const enabled = getSection('featureToggles')[toggle] !== false;
  if (!enabled) res.status(503).json({ error: 'This service is temporarily unavailable. Please try again later.', code: 'SERVICE_DISABLED' });
  return enabled;
}
