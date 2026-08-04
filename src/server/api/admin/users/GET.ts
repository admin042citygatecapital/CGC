import type { Request, Response } from 'express';
import { loadAllUsers } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const { status, kyc, search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  let users = await loadAllUsers();

  // Filters
  if (status) users = users.filter(u => u.status === status);
  if (kyc)    users = users.filter(u => u.kycStatus === kyc);
  if (search) {
    const q = search.toLowerCase();
    users = users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.includes(q)
    );
  }

  // Sort newest first
  users = users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = users.length;
  const data  = users.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    country: u.country,
    status: u.status,
    kycStatus: u.kycStatus,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    approvedAt: u.approvedAt,
    rejectedAt: u.rejectedAt,
    rejectionReason: u.rejectionReason,
    lastLoginAt: u.lastLoginAt,
    lastLoginIp: u.lastLoginIp,
  }));

  return res.json({ ok: true, data, total, page: pageNum, limit: limitNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
}
