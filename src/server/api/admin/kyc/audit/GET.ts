import type { Request, Response } from "express";
import { getKYCAuditLog } from "../../../../lib/kycAuditStore";

export default async function handler(req: Request, res: Response) {
  try {
    const { userId, limit } = req.query as Record<string, string>;
    const entries = getKYCAuditLog({
      userId: userId || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return res.json({ ok: true, entries, total: entries.length });
  } catch (err) {
    console.error("KYC audit log error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
