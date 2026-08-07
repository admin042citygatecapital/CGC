import type { Request, Response } from 'express';
import { unsubscribe } from '../../../lib/subscriberStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const email = String(req.query.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).send('<p>Invalid unsubscribe link.</p>');
    }
    const removed = await unsubscribe(email);
    const message = removed
      ? `You've been unsubscribed from City Gate Capital emails.`
      : `Email not found — you may already be unsubscribed.`;

    // Simple HTML response — no React needed for this one-shot page
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribed — City Gate Capital</title>
  <style>
    body { background: #0A0A0A; color: #fff; font-family: Inter, Arial, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #111; border: 1px solid rgba(201,168,76,0.2); border-radius: 16px;
            padding: 48px 40px; max-width: 420px; text-align: center; }
    h1 { color: #C9A84C; font-size: 22px; margin: 0 0 12px; }
    p  { color: #888; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    a  { color: #C9A84C; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>${message}</p>
    <a href="https://citygate.capital">← Back to City Gate Capital</a>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('newsletter.unsubscribe.error', err);
    return res.status(500).send('<p>Something went wrong. Please try again.</p>');
  }
}
