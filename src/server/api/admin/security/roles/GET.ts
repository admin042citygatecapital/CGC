/**
 * GET /api/admin/security/roles
 * RBAC roles (the 5 system roles enforced by rbacMiddleware.ts/sessionStore.ts
 * are fixed and cannot be renamed/deleted, but their permission sets are
 * editable) plus the full permission catalogue for building a permissions
 * matrix UI.
 */
import type { Request, Response } from 'express';
import { readRoles, PERMISSION_CATALOGUE } from '../../../../lib/securityCenterStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, roles: readRoles(), permissions: PERMISSION_CATALOGUE });
  } catch (err) {
    console.error('[admin/security/roles GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load roles' });
  }
}
