/**
 * POST /api/admin/security/roles
 * Body: { action: 'delete', id } to remove a custom role;
 *       { id, permissions } to update an existing role's permission set
 *       (works for both system and custom roles — system roles keep their
 *       name/label/description/isSystem, only permissions change);
 *       { name, label, description, permissions, color } (no id) to create
 *       a new custom role.
 */
import type { Request, Response } from 'express';
import {
  readRoles, updateRolePermissions, createCustomRole, deleteCustomRole,
  appendAlert, PERMISSION_CATALOGUE, type PermissionKey,
} from '../../../../lib/securityCenterStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

const VALID_PERMISSIONS = new Set(PERMISSION_CATALOGUE.map(p => p.key));

function sanitizePermissions(input: unknown): PermissionKey[] | null {
  if (!Array.isArray(input)) return null;
  const perms = input.filter((p): p is PermissionKey => typeof p === 'string' && VALID_PERMISSIONS.has(p as PermissionKey));
  return perms;
}

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const adminId = req.adminSession?.adminId;
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  if (raw.action === 'delete') {
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return res.status(400).json({ ok: false, error: 'id is required to delete a role' });
    const ok = deleteCustomRole(id);
    if (!ok) return res.status(400).json({ ok: false, error: 'Role not found, or is a system role and cannot be deleted' });

    appendAudit({ event: 'security_role_deleted', adminId, email: adminEmail, ip, meta: { id } });
    return res.json({ ok: true });
  }

  if (typeof raw.id === 'string' && raw.id) {
    const permissions = sanitizePermissions(raw.permissions);
    if (!permissions) return res.status(400).json({ ok: false, error: 'permissions must be an array of valid permission keys' });

    const role = updateRolePermissions(raw.id, permissions);
    if (!role) return res.status(404).json({ ok: false, error: 'Role not found' });

    appendAudit({ event: 'security_role_permissions_updated', adminId, email: adminEmail, ip, meta: { id: raw.id, permissionCount: permissions.length } });
    appendAlert({
      type: 'permission_change', severity: 'medium',
      title: `Role permissions updated: ${role.label}`,
      detail: `${adminEmail} changed permissions for role "${role.label}".`,
      adminId, resolved: false,
    });

    return res.json({ ok: true, role });
  }

  const name = sanitizeString(raw.name, 50).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const label = sanitizeString(raw.label, 100);
  const description = sanitizeString(raw.description, 500);
  const permissions = sanitizePermissions(raw.permissions) ?? [];
  const color = /^#[0-9A-Fa-f]{6}$/.test(String(raw.color)) ? String(raw.color) : '#6B7280';

  if (!name || !label) {
    return res.status(400).json({ ok: false, error: 'name and label are required' });
  }
  if (readRoles().some(r => r.name === name)) {
    return res.status(409).json({ ok: false, error: 'A role with this name already exists' });
  }

  const role = createCustomRole({ name, label, description, permissions, color });

  appendAudit({ event: 'security_role_created', adminId, email: adminEmail, ip, meta: { id: role.id, name } });
  return res.status(201).json({ ok: true, role });
}
