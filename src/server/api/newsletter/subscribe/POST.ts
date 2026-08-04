import type { Request, Response } from 'express';
import { addSubscriber, findSubscriberByEmail } from '../../../lib/subscriberStore.js';

const VALID_SOURCES = new Set<string>([
  'footer', 'homepage_hero', 'accounts_page', 'contact_page', 'unknown',
]);

export default async function handler(req: Request, res: Response) {
  try {
    const { email, name, source } = req.body as {
      email?: string;
      name?: string;
      source?: string;
    };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email is required' });
    }

    const safeSource = VALID_SOURCES.has(source ?? '') ? source! : 'unknown';

    // Re-subscribe if previously unsubscribed
    const existing = await findSubscriberByEmail(email);
    if (existing?.status === 'active') {
      return res.status(200).json({ ok: true, alreadySubscribed: true });
    }

    const subscriber = await addSubscriber(
      email.trim().toLowerCase(),
      name ? String(name).slice(0, 100).trim() : undefined,
      safeSource,
    );

    return res.status(201).json({ ok: true, id: subscriber.id });
  } catch (err) {
    console.error('newsletter.subscribe.error', err);
    return res.status(500).json({ ok: false, error: 'Failed to subscribe' });
  }
}
