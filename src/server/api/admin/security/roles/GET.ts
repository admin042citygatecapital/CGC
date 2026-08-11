/** GET /api/admin/security/roles — list all roles with permission catalogue */
import type { Request, Response } from 'express';
export default async function handler(_req: Request, res: Response) {
  return res.status(410).json({ error: 'Role administration has been retired. The control center supports SUPER_ADMIN only.', code: 'SUPER_ADMIN_ONLY' });
}
