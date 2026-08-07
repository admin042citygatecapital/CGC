import crypto from 'node:crypto';
import type { Request, Response } from 'express';

export interface IdempotencyDescriptor {
  key: string;
  fingerprint: string;
}

/** Validate and scope a client idempotency key, then fingerprint normalized input. */
export function requireIdempotency(
  req: Request,
  res: Response,
  namespace: string,
  normalizedInput: Record<string, unknown>,
): IdempotencyDescriptor | null {
  const raw = req.get('Idempotency-Key')?.trim() ?? '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(raw)) {
    res.status(400).json({
      error: 'A valid Idempotency-Key header (8-128 letters, numbers, dots, underscores, colons, or hyphens) is required.',
    });
    return null;
  }

  return {
    key: `${namespace}:${raw}`,
    fingerprint: crypto.createHash('sha256').update(JSON.stringify(normalizedInput)).digest('hex'),
  };
}
