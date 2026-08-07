/** GET /api/admin/security/roles — list all roles with permission catalogue */
import type { Request, Response } from 'express';
import { readRoles, PERMISSION_CATALOGUE } from '../../../../lib/securityCenterStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json({ roles: readRoles(), permissions: PERMISSION_CATALOGUE });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load roles', message: String(err) });
  }
}
