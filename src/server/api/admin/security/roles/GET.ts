/** GET /api/admin/security/roles — list all roles with permission catalogue */
import type { Request, Response } from 'express';
import { PERMISSION_CATALOGUE, readRoles } from '../../../../lib/securityCenterStore.js';

export default async function handler(_req: Request, res: Response) {
  const roles = await readRoles();
  return res.json({ roles, permissions: PERMISSION_CATALOGUE });
}
