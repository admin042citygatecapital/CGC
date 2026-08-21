/** Central, metadata-only audit coverage for every authenticated admin write. */
import type { NextFunction, Request, Response } from 'express';
import { appendAudit, appendCriticalAudit } from './auditLog.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function auditAdminMutation(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = req.adminSession;
  if (!session || SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const startedAt = Date.now();
  const path = req.originalUrl?.split('?')[0] ?? req.path;
  try {
    await appendCriticalAudit({
      event: 'admin_api_mutation_intent',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      meta: { method: req.method.toUpperCase(), path },
    });
  } catch {
    res.status(503).json({ error: 'The privileged action could not be recorded and was not executed.', code: 'AUDIT_UNAVAILABLE' });
    return;
  }
  res.once('finish', () => {
    appendAudit({
      event: 'admin_api_mutation',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      meta: {
        method: req.method.toUpperCase(),
        path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
    });
  });

  next();
}
