import type { Request, Response } from 'express';
import { desc, sql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../../../db/db.js';
import { admins, adminSessions } from '../../../db/schema.js';

export default async function handler(_req: Request, res: Response) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Administrator directory is unavailable.', code: 'DATABASE_REQUIRED' });
  }

  const [records, activeSessionCounts] = await Promise.all([
    getDb().select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      isActive: admins.isActive,
      mustChangePassword: admins.mustChangePassword,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt,
    }).from(admins).orderBy(desc(admins.createdAt)),
    getDb().select({
      adminId: adminSessions.adminId,
      count: sql<number>`count(*)::int`,
    }).from(adminSessions)
      .where(sql`${adminSessions.expiresAt} > now()`)
      .groupBy(adminSessions.adminId),
  ]);

  const sessionsByAdmin = new Map(activeSessionCounts.map((row) => [row.adminId, row.count]));
  return res.json({
    administrators: records.map((record) => ({
      ...record,
      activeSessions: sessionsByAdmin.get(record.id) ?? 0,
    })),
    summary: {
      total: records.length,
      active: records.filter((record) => record.isActive).length,
      superAdmins: records.filter((record) => record.role === 'SUPER_ADMIN' && record.isActive).length,
      activeSessions: activeSessionCounts.reduce((total, row) => total + row.count, 0),
    },
  });
}
