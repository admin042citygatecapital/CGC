/**
 * POST /api/admin/security/roles
 * Actions: update_permissions | create | delete
 */
import type { Request, Response } from 'express';
import { appendCriticalAudit } from '../../../../lib/auditLog.js';
import { PERMISSION_CATALOGUE, readRoles, updateRolePermissions, type PermissionKey } from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  const body = req.body as { action?: unknown; roleId?: unknown; permissions?: unknown };
  if (body.action !== 'update_permissions' || typeof body.roleId !== 'string' || !Array.isArray(body.permissions)) {
    return res.status(400).json({ error: 'action, roleId, and permissions are required.', code: 'INVALID_ROLE_UPDATE' });
  }
  if (body.roleId === 'role_super_admin') {
    return res.status(409).json({ error: 'The super-administrator policy is immutable.', code: 'IMMUTABLE_SUPER_ADMIN' });
  }
  const existingRole = (await readRoles()).find(role => role.id === body.roleId);
  if (!existingRole?.isSystem) return res.status(404).json({ error: 'System role not found.', code: 'ROLE_NOT_FOUND' });
  const allowed = new Set(PERMISSION_CATALOGUE.map(item => item.key));
  const permissions = [...new Set(body.permissions.filter((item): item is PermissionKey => typeof item === 'string' && allowed.has(item as PermissionKey)))];
  if (permissions.length !== body.permissions.length) {
    return res.status(400).json({ error: 'One or more permissions are invalid.', code: 'INVALID_PERMISSION' });
  }
  const actor = req.adminSession;
  await appendCriticalAudit({
    event: 'admin_role_permissions_update_intent',
    adminId: actor?.adminId ?? 'unknown',
    email: actor?.email,
    ip: req.ip,
    meta: { roleId: body.roleId, permissions },
  });
  const role = await updateRolePermissions(body.roleId, permissions, actor?.email ?? actor?.adminId ?? 'admin');
  if (!role) return res.status(404).json({ error: 'System role not found.', code: 'ROLE_NOT_FOUND' });
  return res.json({ success: true, role });
}
