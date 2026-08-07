/** Central, metadata-only audit coverage for every authenticated admin write. */
import type { NextFunction, Request, Response } from 'express';
import { appendAudit } from './auditLog.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function auditAdminMutation(req: Request, res: Response, next: NextFunction): void {
  const session = req.adminSession;
  if (!session || SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const startedAt = Date.now();
  res.once('finish', () => {
    appendAudit({
      event: 'admin_api_mutation',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      meta: {
        method: req.method.toUpperCase(),
        path: req.originalUrl?.split('?')[0] ?? req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
    });
  });

  next();
}
