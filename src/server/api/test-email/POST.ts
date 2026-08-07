/**
 * POST /api/test-email
 * Public endpoint — no auth required.
 * Sends a test email via the Zoho Mail HTTP API and returns JSON.
 *
 * Body:    { email: string }
 * Returns: { success: boolean; messageId?: string; error?: string; durationMs: number }
 *
 * Rate-limited by the global express-rate-limit middleware (10 req/hr per IP).
 */
import type { Request, Response } from 'express';
import { sendMail } from '../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      error:   'A valid email address is required in the request body: { "email": "you@example.com" }',
    });
  }

  const result = await sendMail({
    to:      email,
    subject: 'City Gate Capital — SMTP Test',
    html:    '<h1 style="font-family:Arial,sans-serif;color:#C9A84C;">SMTP Working Successfully</h1><p style="font-family:Arial,sans-serif;">This test email was sent from citygate.capital via the Zoho Mail HTTP API.</p>',
  });

  if (!result.success) {
    return res.status(502).json({
      success:    false,
      error:      result.error ?? 'Delivery failed',
      attempts:   result.attempts,
      durationMs: result.durationMs,
    });
  }

  return res.status(200).json({
    success:    true,
    messageId:  result.messageId,
    attempts:   result.attempts,
    durationMs: result.durationMs,
  });
}
