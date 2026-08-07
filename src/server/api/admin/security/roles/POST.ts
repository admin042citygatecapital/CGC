/**
 * POST /api/admin/security/roles
 * Actions: update_permissions | create | delete
 */
import type { Request, Response } from 'express';
import {
  updateRolePermissions, createCustomRole, deleteCustomRole,
  type PermissionKey,
} from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { action, roleId, permissions, name, label, description, color } =
      req.body as {
        action: string; roleId?: string;
        permissions?: PermissionKey[];
        name?: string; label?: string; description?: string; color?: string;
      };

    if (action === 'update_permissions') {
      if (!roleId || !permissions) return res.status(400).json({ error: 'roleId and permissions required' });
      const updated = updateRolePermissions(roleId, permissions);
      if (!updated) return res.status(404).json({ error: 'Role not found' });
      return res.json({ ok: true, role: updated });
    }

    if (action === 'create') {
      if (!name || !label) return res.status(400).json({ error: 'name and label required' });
      const role = createCustomRole({ name, label, description: description ?? '', permissions: permissions ?? [], color: color ?? '#6B7280' });
      return res.status(201).json({ ok: true, role });
    }

    if (action === 'delete') {
      if (!roleId) return res.status(400).json({ error: 'roleId required' });
      const ok = deleteCustomRole(roleId);
      if (!ok) return res.status(400).json({ error: 'Cannot delete system role or role not found' });
      return res.json({ ok: true });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    res.status(500).json({ error: 'Role operation failed', message: String(err) });
  }
}
